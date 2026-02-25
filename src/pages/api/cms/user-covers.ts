/**
 * GET /api/cms/user-covers?userId=<uuid>&page=<int>
 * Returns all covers by a user (50 per page), ordered newest first.
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const PAGE_SIZE = 50;

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const userId = url.searchParams.get('userId');
  if (!userId) return json({ error: 'userId is required' }, 400);

  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await sb
    .from('covers_cafe_covers')
    .select('id, page_slug, title, artist, is_public, is_private, perma_unpublished, created_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return json({ error: error.message }, 500);

  return json({ covers: data ?? [], total: count ?? 0, page, pageSize: PAGE_SIZE });
};
