/**
 * PUT /api/public/comments/edit
 * Allows users to edit their own comments (based on identity hash match)
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../../utils/core/supabaseClient.js';
import { normalizeContent, isValidContent } from '../../../../utils/comments/contentNormalization';
import { scoreComment } from '../../../../utils/comments/abuseScoring';
import { computeIdentity } from '../../../../utils/comments/identityTracking.server';
import { evaluateBanDecision } from '../../../../utils/comments/banSystem';
import type { AbuseHistory } from '../../../../utils/comments/banSystem';

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { commentId, content, sessionId, localStorageId } = body;

    if (!commentId || !content) {
      return new Response(
        JSON.stringify({ error: 'commentId and content are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (content.length > 10000) {
      return new Response(
        JSON.stringify({ error: 'Comment exceeds maximum length of 10,000 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { normalized, original } = normalizeContent(content);

    if (!isValidContent(content)) {
      return new Response(
        JSON.stringify({ error: 'Comment cannot be empty or contain only whitespace' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (/https?:\/\//i.test(content) || /www\./i.test(content)) {
      return new Response(
        JSON.stringify({ error: 'Comments cannot contain links' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const condensed = normalized.replace(/[^a-z0-9]/gi, '');
    if (condensed.length >= 12 && /^([a-z0-9])\1+$/i.test(condensed)) {
      return new Response(
        JSON.stringify({ error: 'Please avoid repetitive or low-effort comments.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const identity = computeIdentity(request, sessionId, localStorageId);
    const supabase = getSupabaseAdminClientFromContext({ request });

    const { data: existingComment, error: commentError } = await supabase
      .from('comments')
      .select(
        'id, identity_hash, abuse_score, is_admin_removed, content, content_normalized, page_type, page_slug, parent_comment_id, session_id, local_storage_id, user_agent_hash, author_username, created_at, updated_at, edited_at'
      )
      .eq('id', commentId)
      .single();

    if (commentError || !existingComment) {
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (existingComment.is_admin_removed || existingComment.content === '[Comment deleted]') {
      return new Response(
        JSON.stringify({ error: 'Deleted comments cannot be edited.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (existingComment.identity_hash !== identity.identityHash) {
      return new Response(
        JSON.stringify({ error: 'You can only edit your own comments' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let { data: identityRecord, error: identityError } = await supabase
      .from('comment_identities')
      .select('*')
      .eq('identity_hash', identity.identityHash)
      .single();

    if (identityError || !identityRecord) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify identity' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (identityRecord.is_admin_banned && !identityRecord.is_admin_unbanned) {
      return new Response(
        JSON.stringify({ error: 'Unable to edit. Your account has been restricted.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (identityRecord.is_auto_banned && !identityRecord.is_admin_unbanned) {
      return new Response(
        JSON.stringify({ error: 'Unable to edit. Your account has been restricted due to policy violations.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const abuseScore = scoreComment(original);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentComments } = await supabase
      .from('comments')
      .select('abuse_score, created_at')
      .eq('identity_hash', identity.identityHash)
      .gte('created_at', oneHourAgo.toISOString());

    const recentAbuse = recentComments || [];

    const abuseHistory: AbuseHistory = {
      totalComments: identityRecord.total_comments,
      totalAbuseScore: identityRecord.total_abuse_score,
      hateSpeechCount: identityRecord.flagged_comment_count,
      threatCount: abuseScore.breakdown.threats > 0 ? 1 : 0,
      recentComments: recentAbuse.map((c: any) => ({
        timestamp: new Date(c.created_at),
        abuseScore: c.abuse_score,
      })),
      reportCount: 0,
      lastCommentAt: identityRecord.last_comment_at ? new Date(identityRecord.last_comment_at) : null,
    };

    const banDecision = evaluateBanDecision(abuseScore, abuseHistory);

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
        JSON.stringify({ error: 'Unable to edit. Your account has been restricted due to policy violations.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    await supabase.from('comments_admin_archives').insert({
      comment_id: existingComment.id,
      page_type: existingComment.page_type,
      page_slug: existingComment.page_slug,
      content: existingComment.content,
      content_normalized: existingComment.content_normalized,
      parent_comment_id: existingComment.parent_comment_id,
      identity_hash: existingComment.identity_hash,
      session_id: existingComment.session_id,
      local_storage_id: existingComment.local_storage_id,
      user_agent_hash: existingComment.user_agent_hash,
      author_username: existingComment.author_username,
      action_type: 'edited',
      is_edited: true,
      done_by_admin: false,
      archived_at: now,
      created_at: existingComment.created_at,
      updated_at: existingComment.updated_at,
      edited_at: existingComment.edited_at,
    });
    const abuseDelta = abuseScore.total - (existingComment.abuse_score ?? 0);

    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({
        content: original,
        content_normalized: normalized,
        abuse_score: abuseScore.total,
        updated_at: now,
        edited_at: now,
        is_shadow_banned: banDecision.shouldShadowBan,
      })
      .eq('id', commentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating comment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to edit comment' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('comment_identities')
      .update({
        total_abuse_score: Math.max(0, identityRecord.total_abuse_score + abuseDelta),
        ...(banDecision.shouldShadowBan
          ? {
              is_shadow_banned: true,
              shadow_ban_reason: banDecision.reason,
              shadow_banned_at: now,
            }
          : {}),
      })
      .eq('identity_hash', identity.identityHash);

    if (abuseScore.total > 0) {
      await supabase.from('comment_abuse_log').insert({
        comment_id: updatedComment.id,
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

    return new Response(
      JSON.stringify({ success: true, comment: updatedComment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in PUT /api/public/comments/edit:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
