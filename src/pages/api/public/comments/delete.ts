import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../_supabase';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const getBearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabaseServer();
  if (!supabase) return json({ error: 'Supabase is not configured' }, 500);

  const token = getBearer(request);
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Authentication required' }, 401);

  const { commentId } = await request.json();
  if (!commentId) return json({ error: 'commentId is required' }, 400);

  const { data: comment, error: fetchErr } = await supabase
    .from('comments')
    .select('id, author_username')
    .eq('id', commentId)
    .single();

  if (fetchErr || !comment) return json({ error: 'Comment not found' }, 404);

  const userId = userData.user.id;

  // Resolve the caller's username the same way the POST handler does
  const { data: authorProfile } = await supabase
    .from('covers_cafe_profiles')
    .select('username')
    .eq('id', userId)
    .single();
  const callerUsername = authorProfile?.username ?? userData.user.email?.split('@')[0] ?? userId.slice(0, 8);
  const isOwner = comment.author_username === callerUsername;

  // Operators can delete any comment for moderation purposes
  const { data: opRole } = await supabase
    .from('covers_cafe_operator_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role', 'operator')
    .maybeSingle();
  const isOperator = Boolean(opRole);

  if (!isOwner && !isOperator) return json({ error: 'You can only delete your own comments' }, 403);

  const { error: deleteErr } = await supabase.from('comments').delete().eq('id', commentId);
  if (deleteErr) return json({ error: 'Failed to delete comment' }, 500);

  return json({ success: true });
};
