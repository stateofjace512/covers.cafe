import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../_supabase';
import { computeIdentity } from '../../../../lib/comments/identityTracking.server';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const getBearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabaseServer();
  if (!supabase) return json({ error: 'Supabase is not configured' }, 500);

  const token = getBearer(request);
  if (!token) return json({ error: 'Authentication required' }, 401);
  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Authentication required' }, 401);

  const { commentId, sessionId, localStorageId } = await request.json();
  if (!commentId) return json({ error: 'commentId is required' }, 400);

  const identity = computeIdentity(request, sessionId, localStorageId);

  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('identity_hash', identity.identityHash)
    .maybeSingle();

  const { data: comment } = await supabase.from('comments').select('like_count').eq('id', commentId).single();
  if (!comment) return json({ error: 'Comment not found.' }, 404);
  const currentCount = comment.like_count ?? 0;

  if (existing) {
    await supabase.from('comment_likes').delete().eq('id', existing.id);
    const next = Math.max(0, currentCount - 1);
    await supabase.from('comments').update({ like_count: next }).eq('id', commentId);
    return json({ success: true, liked: false, likeCount: next });
  }

  await supabase.from('comment_likes').insert({ comment_id: commentId, identity_hash: identity.identityHash });
  const next = currentCount + 1;
  await supabase.from('comments').update({ like_count: next }).eq('id', commentId);
  return json({ success: true, liked: true, likeCount: next });
};
