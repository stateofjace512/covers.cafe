/**
 * Comments API - GET (fetch) and POST (submit) comments
 *
 * GET /api/public/comments?pageType=song&pageSlug=song-slug-here
 * POST /api/public/comments
 *
 * Implements anonymous commenting with aggressive filtering, abuse detection,
 * shadow banning, and rate limiting.
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../utils/core/supabaseClient.js';
import { normalizeContent, isValidContent } from '../../../utils/comments/contentNormalization';
import { scoreComment } from '../../../utils/comments/abuseScoring';
import { computeIdentity } from '../../../utils/comments/identityTracking.server';
import {
  getCooldownState,
  applyCooldown,
  isRepeatedAbuse,
  COOLDOWN_LEVELS,
} from '../../../utils/comments/cooldownSystem';
import { evaluateBanDecision } from '../../../utils/comments/banSystem';
import type { AbuseHistory } from '../../../utils/comments/banSystem';
import { generateUsernameFromIdentity } from '../../../utils/comments/usernameGenerator';
import { validateUserSession } from '../../../utils/userSession.js';
import {
  normalizeCommentsForClient,
  normalizeAuthorUsername,
  OFFICIAL_ADMIN_MARKER,
} from '../../../utils/comments/displayName.server';

// ============================================================================
// GET COMMENTS
// ============================================================================

export const GET: APIRoute = async ({ url, request }) => {
  const pageType = url.searchParams.get('pageType');
  const pageSlug = url.searchParams.get('pageSlug');
  const parentId = url.searchParams.get('parentId');

  if (!pageType || !pageSlug) {
    return new Response(
      JSON.stringify({ error: 'pageType and pageSlug are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate pageType
  const validPageTypes = ['artist', 'article', 'music', 'song'];
  if (!validPageTypes.includes(pageType)) {
    return new Response(
      JSON.stringify({ error: 'Invalid pageType' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = getSupabaseAdminClientFromContext({ request });

    // Build query
    let query = supabase
      .from('comments')
      .select('*')
      .eq('page_type', pageType)
      .eq('page_slug', pageSlug)
      .eq('is_shadow_banned', false) // Don't show shadow-banned comments
      .order('created_at', { ascending: true });

    // Filter by parent if specified, otherwise return full thread
    if (parentId) {
      query = query.eq('parent_comment_id', parentId);
    }

    const { data: comments, error } = await query;

    if (error) {
      console.error('Error fetching comments:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch comments' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize admin usernames to the official marker for client rendering
    const normalizedComments = normalizeCommentsForClient(comments || []);

    return new Response(
      JSON.stringify({ comments: normalizedComments }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in GET /api/public/comments:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// ============================================================================
// POST COMMENT
// ============================================================================

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const body = await request.json();
    const {
      pageType,
      pageSlug,
      content,
      parentCommentId = null,
      sessionId,
      localStorageId,
      recaptchaToken,
      anonKey = null,
    } = body;

    // Validate required fields
    if (!pageType || !pageSlug || !content) {
      return new Response(
        JSON.stringify({ error: 'pageType, pageSlug, and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate pageType
    const validPageTypes = ['artist', 'article', 'music', 'song'];
    if (!validPageTypes.includes(pageType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid pageType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate content length
    if (content.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Comment exceeds maximum length of 10,000 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Normalize content
    const { normalized, original } = normalizeContent(content);

    // Check if content is valid (not empty after normalization)
    if (!isValidContent(content)) {
      return new Response(
        JSON.stringify({ error: 'Comment cannot be empty or contain only whitespace' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check for URLs (not allowed)
    if (/https?:\/\//i.test(content) || /www\./i.test(content)) {
      return new Response(
        JSON.stringify({ error: 'Comments cannot contain links' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2.5: Block low-effort spam (single-character repetition)
    const condensed = normalized.replace(/[^a-z0-9]/gi, '');
    if (condensed.length >= 12 && /^([a-z0-9])\1+$/i.test(condensed)) {
      return new Response(
        JSON.stringify({ error: 'Please avoid repetitive or low-effort comments.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Compute identity
    const identity = computeIdentity(request, sessionId, localStorageId);

    console.log('[POST Comment] Identity computed:', {
      identityHash: identity.identityHash.substring(0, 10) + '...',
      sessionId,
      localStorageId
    });

    // Step 4: Get Supabase client
    const user = await validateUserSession(cookies, locals);
    const supabase = getSupabaseAdminClientFromContext({ request });

    // Step 5: Get or create identity record
    let { data: identityRecord, error: identityError } = await supabase
      .from('comment_identities')
      .select('*')
      .eq('identity_hash', identity.identityHash)
      .single();

    if (identityError && identityError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('Error fetching identity:', identityError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify identity' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create identity if doesn't exist
    if (!identityRecord) {
      const { data: newIdentity, error: createError } = await supabase
        .from('comment_identities')
        .insert({
          identity_hash: identity.identityHash,
          total_comments: 0,
          total_abuse_score: 0,
          cooldown_level: COOLDOWN_LEVELS.NONE,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating identity:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create identity' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      identityRecord = newIdentity;
    }

    // Step 6: Check if user is banned
    if (identityRecord.is_admin_banned && !identityRecord.is_admin_unbanned) {
      return new Response(
        JSON.stringify({ error: 'Unable to post. Your account has been restricted.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (identityRecord.is_auto_banned && !identityRecord.is_admin_unbanned) {
      return new Response(
        JSON.stringify({ error: 'Unable to post. Your account has been restricted due to policy violations.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 7: Check cooldown
    const cooldownState = getCooldownState(
      identityRecord.cooldown_level,
      identityRecord.cooldown_end_at
    );

    if (cooldownState.isActive) {
      return new Response(
        JSON.stringify({
          error: 'Please wait before posting again',
          cooldownRemaining: cooldownState.remainingMs,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 8: Score the comment for abuse
    const abuseScore = scoreComment(original);


    // Step 9: Get recent abuse history
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentComments } = await supabase
      .from('comments')
      .select('abuse_score, created_at')
      .eq('identity_hash', identity.identityHash)
      .gte('created_at', oneHourAgo.toISOString());

    const recentAbuse = recentComments || [];
    const isRepeated = isRepeatedAbuse(
      recentAbuse.length,
      recentAbuse.reduce((sum, c) => sum + c.abuse_score, 0)
    );

    // Step 10: Evaluate ban decision
    const abuseHistory: AbuseHistory = {
      totalComments: identityRecord.total_comments,
      totalAbuseScore: identityRecord.total_abuse_score,
      hateSpeechCount: identityRecord.flagged_comment_count,
      threatCount: abuseScore.breakdown.threats > 0 ? 1 : 0,
      recentComments: recentAbuse.map((c: any) => ({
        timestamp: new Date(c.created_at),
        abuseScore: c.abuse_score,
      })),
      reportCount: 0, // Would need to query comment_reports
      lastCommentAt: identityRecord.last_comment_at ? new Date(identityRecord.last_comment_at) : null,
    };

    const banDecision = evaluateBanDecision(abuseScore, abuseHistory);

    // Apply bans to identity if needed
    if (banDecision.shouldAutoBan) {
      await supabase
        .from('comment_identities')
        .update({
          is_auto_banned: true,
          auto_ban_reason: banDecision.reason,
          auto_banned_at: new Date().toISOString(),
        })
        .eq('identity_hash', identity.identityHash);

      return new Response(
        JSON.stringify({ error: 'Unable to post. Your account has been restricted due to policy violations.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 11: Apply cooldown if needed
    let newCooldownLevel = identityRecord.cooldown_level;
    let cooldownEnd: Date | null = null;

    if (abuseScore.total >= 3) {
      const cooldownUpdate = applyCooldown(
        identityRecord.cooldown_level,
        abuseScore.total,
        isRepeated
      );
      newCooldownLevel = cooldownUpdate.newLevel;
      cooldownEnd = cooldownUpdate.newEndTime;
    }

    // Step 12: Insert comment
    // Generate deterministic username from identity hash
    // If user is admin, normalize to official marker for client rendering
    const rawUsername = user?.displayUsername?.trim() || generateUsernameFromIdentity(identity.identityHash);
    const username = normalizeAuthorUsername(rawUsername) ?? rawUsername;

    // Sanitize content to ensure valid UTF-8 encoding for database
    // Use TextEncoder/TextDecoder to guarantee valid UTF-8
    const sanitizeForDb = (str: string): string => {
      if (!str) return '';
      try {
        // Encode to UTF-8 bytes and back to filter any invalid sequences
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const bytes = encoder.encode(str);
        const cleaned = decoder.decode(bytes);
        // Double-check JSON serialization works
        JSON.stringify(cleaned);
        return cleaned;
      } catch {
        // If encoding fails, strip all non-ASCII as last resort
        return str.replace(/[^\x00-\x7F]/g, '');
      }
    };

    const isAnon = !user;

    const commentData = {
      page_type: pageType,
      page_slug: pageSlug,
      content: sanitizeForDb(original),
      content_normalized: sanitizeForDb(normalized),
      parent_comment_id: parentCommentId,
      identity_hash: identity.identityHash,
      session_id: identity.sessionId,
      local_storage_id: identity.localStorageId,
      user_agent_hash: identity.userAgentHash,
      author_username: username,
      abuse_score: abuseScore.total,
      is_shadow_banned: banDecision.shouldShadowBan,
      is_auto_banned: false, // Handled above
      is_admin_removed: false,
      is_anon: isAnon ? 'YES' : 'NO',
      anon_key: isAnon ? (anonKey ?? null) : null,
    };

    // Debug: Log sanitized content for troubleshooting
    console.log('[POST Comment] Inserting with content length:', commentData.content.length, 'normalized length:', commentData.content_normalized.length);
    console.log('[POST Comment] Content preview:', JSON.stringify(commentData.content.substring(0, 50)));

    // Try explicit JSON serialization to catch any issues before Supabase
    let serializedData: string;
    try {
      serializedData = JSON.stringify(commentData);
      console.log('[POST Comment] JSON serialization successful, length:', serializedData.length);
    } catch (jsonError) {
      console.error('[POST Comment] JSON serialization failed:', jsonError);
      return new Response(
        JSON.stringify({ error: 'Invalid content encoding' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: newComment, error: insertError } = await supabase
      .from('comments')
      .insert(commentData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting comment:', insertError);
      console.error('[POST Comment] Failed commentData:', JSON.stringify({
        contentLength: commentData.content?.length,
        normalizedLength: commentData.content_normalized?.length,
        hasContent: Boolean(commentData.content),
        hasNormalized: Boolean(commentData.content_normalized),
      }));
      return new Response(
        JSON.stringify({ error: 'Failed to post comment' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[POST Comment] Comment inserted successfully:', {
      commentId: newComment?.id,
      identityHash: newComment?.identity_hash?.substring(0, 10) + '...',
      username: newComment?.author_username
    });


    // Step 13: Update identity record
    await supabase
      .from('comment_identities')
      .update({
        last_comment_at: new Date().toISOString(),
        cooldown_level: newCooldownLevel,
        cooldown_end_at: cooldownEnd?.toISOString() || null,
        total_comments: identityRecord.total_comments + 1,
        total_abuse_score: identityRecord.total_abuse_score + abuseScore.total,
        is_shadow_banned: banDecision.shouldShadowBan,
        shadow_ban_reason: banDecision.shouldShadowBan ? banDecision.reason : null,
        shadow_banned_at: banDecision.shouldShadowBan ? new Date().toISOString() : null,
      })
      .eq('identity_hash', identity.identityHash);

    // Step 14: Log abuse if detected
    if (abuseScore.total > 0) {
      await supabase.from('comment_abuse_log').insert({
        comment_id: newComment.id,
        identity_hash: identity.identityHash,
        event_type: abuseScore.breakdown.threats > 0 ? 'threats'
          : abuseScore.breakdown.tier3 > 0 ? 'hate_speech'
          : abuseScore.breakdown.sexual > 0 ? 'sexual_content'
          : abuseScore.breakdown.tier2 > 0 ? 'profanity_tier_2'
          : 'profanity_tier_1',
        abuse_score_added: abuseScore.total,
        matched_words: abuseScore.matchedWords,
        details: { breakdown: abuseScore.breakdown },
      });
    }

    // Return success (even if shadow banned - user doesn't know)
    // Include anon metadata so the client can surface the key modal on first post
    const isFirstAnonPost = isAnon && identityRecord.total_comments === 0;

    return new Response(
      JSON.stringify({
        success: true,
        comment: banDecision.shouldShadowBan ? null : newComment, // Don't return comment if shadow banned
        message: 'Comment posted successfully',
        isFirstAnonPost,
        anonUsername: isAnon ? username : null,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in POST /api/public/comments:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
