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

  const { commentId, reason, details, sessionId, localStorageId } = await request.json();
  if (!commentId || !reason) return json({ error: 'commentId and reason are required' }, 400);

  const identity = computeIdentity(request, sessionId, localStorageId);

  const { error } = await supabase.from('comment_reports').insert({
    comment_id: commentId,
    reporter_identity_hash: identity.identityHash,
    reason,
    details: details || null,
  });

  if (error?.code === '23505') return json({ error: 'You have already reported this comment' }, 400);
  if (error) return json({ error: 'Failed to submit report' }, 500);

  return json({ success: true, message: 'Report submitted successfully' });
};
