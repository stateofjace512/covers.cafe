/**
 * GET /api/cms/recent-comments?limit=30
 * Returns recent cover comments enriched with cover metadata and pin status.
 * For use in the CMS POH (Pin of Honor) management UI.
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10)));

  // Recent cover comments
  const { data: comments, error: commentsErr } = await sb
    .from('comments')
    .select('id, content, author_username, user_id, page_slug, created_at')
    .eq('page_type', 'music')
    .eq('is_shadow_banned', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (commentsErr) return json({ error: commentsErr.message }, 500);
  if (!comments || comments.length === 0) return json([]);

  // Batch fetch cover metadata
  const coverIds = [...new Set(comments.map((c: { page_slug: string }) => c.page_slug))];
  const { data: covers } = await sb
    .from('covers_cafe_covers')
    .select('id, title, artist, storage_path, image_url')
    .in('id', coverIds);

  // Check which comments are already pinned
  const commentIds = comments.map((c: { id: string }) => c.id);
  const { data: pins } = await sb
    .from('covers_cafe_poh_pins')
    .select('comment_id')
    .in('comment_id', commentIds);

  const coverMap = Object.fromEntries(
    (covers ?? []).map((c: { id: string; title: string; artist: string; storage_path: string; image_url: string }) => [c.id, c]),
  );
  const pinnedSet = new Set((pins ?? []).map((p: { comment_id: string }) => p.comment_id));

  const result = (comments as Array<{ id: string; content: string; author_username: string; user_id: string | null; page_slug: string; created_at: string }>).map((c) => {
    const cov = coverMap[c.page_slug];
    return {
      id: c.id,
      content: c.content,
      author_username: c.author_username,
      user_id: c.user_id,
      page_slug: c.page_slug,
      created_at: c.created_at,
      cover_id: cov?.id ?? null,
      cover_title: cov?.title ?? null,
      cover_artist: cov?.artist ?? null,
      cover_storage_path: cov?.storage_path ?? null,
      cover_image_url: cov?.image_url ?? null,
      is_already_pinned: pinnedSet.has(c.id),
    };
  });

  return json(result);
};
