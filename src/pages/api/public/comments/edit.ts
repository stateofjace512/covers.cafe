import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../_supabase';
import { normalizeContent, isValidContent } from '../../../../lib/comments/contentNormalization';
import { scoreComment } from '../../../../lib/comments/abuseScoring';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const getBearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabaseServer();
  if (!supabase) return json({ error: 'Supabase is not configured' }, 500);

  const token = getBearer(request);
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Authentication required' }, 401);

  const { commentId, content } = await request.json();
  if (!commentId || !content) return json({ error: 'commentId and content are required' }, 400);

  if (!isValidContent(content)) return json({ error: 'Comment cannot be empty or whitespace only' }, 400);
  if (/https?:\/\//i.test(content) || /www\./i.test(content)) return json({ error: 'Comments cannot contain links' }, 400);

  const { normalized, original } = normalizeContent(content);
  const abuseScore = scoreComment(original);

  const { data: comment, error: fetchErr } = await supabase
    .from('comments')
    .select('id, author_username')
    .eq('id', commentId)
    .single();

  if (fetchErr || !comment) return json({ error: 'Comment not found' }, 404);

  // Resolve the caller's username the same way the POST handler does
  const { data: authorProfile } = await supabase
    .from('covers_cafe_profiles')
    .select('username')
    .eq('id', userData.user.id)
    .single();
  const callerUsername = authorProfile?.username ?? userData.user.email?.split('@')[0] ?? userData.user.id.slice(0, 8);

  if (comment.author_username !== callerUsername) return json({ error: 'You can only edit your own comments' }, 403);

  const { data: updated, error: updateErr } = await supabase
    .from('comments')
    .update({
      content: original,
      content_normalized: normalized,
      abuse_score: abuseScore.total,
      edited_at: new Date().toISOString(),
    })
    .eq('id', commentId)
    .select('*')
    .single();

  if (updateErr || !updated) return json({ error: 'Failed to update comment' }, 500);

  return json({ success: true, comment: updated });
};
