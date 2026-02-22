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

  const expectedAuthor = userData.user.email?.split('@')[0] ?? userData.user.id.slice(0, 8);
  if (comment.author_username !== expectedAuthor) return json({ error: 'You can only delete your own comments' }, 403);

  const { error: deleteErr } = await supabase.from('comments').delete().eq('id', commentId);
  if (deleteErr) return json({ error: 'Failed to delete comment' }, 500);

  return json({ success: true });
};
