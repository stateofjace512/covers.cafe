import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../_supabase';
import { normalizeContent, isValidContent } from '../../../../lib/comments/contentNormalization';
import { scoreComment } from '../../../../lib/comments/abuseScoring';
import { computeIdentity } from '../../../../lib/comments/identityTracking.server';
import { getCooldownState, applyCooldown, isRepeatedAbuse, COOLDOWN_LEVELS } from '../../../../lib/comments/cooldownSystem';
import { evaluateBanDecision, type AbuseHistory } from '../../../../lib/comments/banSystem';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const getBearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

const requireUser = async (request: Request) => {
  const supabase = getSupabaseServer();
  if (!supabase) return { error: json({ error: 'Supabase is not configured' }, 500), user: null as null };
  const token = getBearer(request);
  if (!token) return { error: json({ error: 'Authentication required' }, 401), user: null as null };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: json({ error: 'Authentication required' }, 401), user: null as null };
  return { error: null as Response | null, user: data.user };
};

export const GET: APIRoute = async ({ url }) => {
  const pageType = url.searchParams.get('pageType');
  const pageSlug = url.searchParams.get('pageSlug');

  if (!pageType || !pageSlug) return json({ error: 'pageType and pageSlug are required' }, 400);

  const supabase = getSupabaseServer();
  if (!supabase) return json({ error: 'Supabase is not configured' }, 500);

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('page_type', pageType)
    .eq('page_slug', pageSlug)
    .eq('is_shadow_banned', false)
    .order('created_at', { ascending: true });

  if (error) return json({ error: 'Failed to fetch comments' }, 500);
  return json({ comments: data ?? [] });
};

export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabaseServer();
  if (!supabase) return json({ error: 'Supabase is not configured' }, 500);

  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth.error!;

  const { pageType, pageSlug, content, parentCommentId = null, sessionId, localStorageId } = await request.json();
  if (!pageType || !pageSlug || !content) return json({ error: 'pageType, pageSlug, and content are required' }, 400);

  if (!isValidContent(content)) return json({ error: 'Comment cannot be empty or whitespace only' }, 400);
  if (/https?:\/\//i.test(content) || /www\./i.test(content)) return json({ error: 'Comments cannot contain links' }, 400);

  const { normalized, original } = normalizeContent(content);
  const identity = computeIdentity(request, sessionId, localStorageId);

  let { data: identityRow } = await supabase
    .from('comment_identities')
    .select('*')
    .eq('identity_hash', identity.identityHash)
    .maybeSingle();

  if (!identityRow) {
    const { data: created, error: createErr } = await supabase
      .from('comment_identities')
      .insert({ identity_hash: identity.identityHash, total_comments: 0, total_abuse_score: 0, cooldown_level: COOLDOWN_LEVELS.NONE })
      .select('*')
      .single();
    if (createErr || !created) return json({ error: 'Failed to create identity' }, 500);
    identityRow = created;
  }

  if (identityRow.is_admin_banned && !identityRow.is_admin_unbanned) return json({ error: 'Unable to post. Your account has been restricted.' }, 403);
  if (identityRow.is_auto_banned && !identityRow.is_admin_unbanned) return json({ error: 'Unable to post. Your account has been restricted due to policy violations.' }, 403);

  const cooldownState = getCooldownState(identityRow.cooldown_level, identityRow.cooldown_end_at);
  if (cooldownState.isActive) return json({ error: 'Please wait before posting again', cooldownRemaining: cooldownState.remainingMs }, 429);

  const abuseScore = scoreComment(original);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentComments } = await supabase
    .from('comments')
    .select('abuse_score, created_at')
    .eq('identity_hash', identity.identityHash)
    .gte('created_at', oneHourAgo);

  const recentAbuse = recentComments ?? [];
  const isRepeated = isRepeatedAbuse(recentAbuse.length, recentAbuse.reduce((s, c) => s + (c.abuse_score ?? 0), 0));

  const abuseHistory: AbuseHistory = {
    totalComments: identityRow.total_comments ?? 0,
    totalAbuseScore: identityRow.total_abuse_score ?? 0,
    hateSpeechCount: identityRow.flagged_comment_count ?? 0,
    threatCount: abuseScore.breakdown.threats > 0 ? 1 : 0,
    recentComments: recentAbuse.map((c) => ({ timestamp: new Date(c.created_at), abuseScore: c.abuse_score ?? 0 })),
    reportCount: 0,
    lastCommentAt: identityRow.last_comment_at ? new Date(identityRow.last_comment_at) : null,
  };

  const banDecision = evaluateBanDecision(abuseScore, abuseHistory);
  if (banDecision.shouldAutoBan) {
    await supabase.from('comment_identities').update({ is_auto_banned: true, auto_ban_reason: banDecision.reason, auto_banned_at: new Date().toISOString() }).eq('identity_hash', identity.identityHash);
    return json({ error: 'Unable to post. Your account has been restricted due to policy violations.' }, 403);
  }

  let newCooldownLevel = identityRow.cooldown_level;
  let cooldownEnd: Date | null = null;
  if (abuseScore.total >= 3) {
    const cooldownUpdate = applyCooldown(identityRow.cooldown_level, abuseScore.total, isRepeated);
    newCooldownLevel = cooldownUpdate.newLevel;
    cooldownEnd = cooldownUpdate.newEndTime;
  }

  const { data: authorProfile } = await supabase
    .from('covers_cafe_profiles')
    .select('username')
    .eq('id', auth.user.id)
    .single();
  const authorUsername = authorProfile?.username ?? auth.user.email?.split('@')[0] ?? auth.user.id.slice(0, 8);
  const { data: inserted, error: insertError } = await supabase
    .from('comments')
    .insert({
      page_type: pageType,
      page_slug: pageSlug,
      content: original,
      content_normalized: normalized,
      parent_comment_id: parentCommentId,
      identity_hash: identity.identityHash,
      session_id: identity.sessionId,
      local_storage_id: identity.localStorageId,
      user_agent_hash: identity.userAgentHash,
      author_username: authorUsername,
      abuse_score: abuseScore.total,
      is_shadow_banned: banDecision.shouldShadowBan,
      report_count: 0,
      like_count: 0,
    })
    .select('*')
    .single();

  if (insertError || !inserted) return json({ error: 'Failed to create comment' }, 500);

  await supabase.from('comment_identities').update({
    total_comments: (identityRow.total_comments ?? 0) + 1,
    total_abuse_score: (identityRow.total_abuse_score ?? 0) + abuseScore.total,
    last_comment_at: new Date().toISOString(),
    cooldown_level: newCooldownLevel,
    cooldown_end_at: cooldownEnd ? cooldownEnd.toISOString() : null,
    flagged_comment_count: (identityRow.flagged_comment_count ?? 0) + (abuseScore.total >= 3 ? 1 : 0),
  }).eq('identity_hash', identity.identityHash);

  return json({ success: true, comment: inserted, isShadowBanned: banDecision.shouldShadowBan });
};
