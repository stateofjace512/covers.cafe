/**
 * GET /api/cms/review-queue
 * Operator-only. Returns covers pending moderation review.
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const { data: covers, error } = await sb
    .from('covers_cafe_covers')
    .select('id, title, artist, year, tags, phash, storage_path, created_at, user_id, moderation_reason, matched_cover_id, matched_official_id')
    .eq('moderation_status', 'under_review')
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (covers ?? []) as Array<{
    id: string;
    title: string;
    artist: string;
    year: number | null;
    tags: string[] | null;
    phash: string | null;
    storage_path: string;
    created_at: string;
    user_id: string;
    moderation_reason: string | null;
    matched_cover_id: string | null;
    matched_official_id: string | null;
  }>;

  // Resolve uploaders
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await sb.from('covers_cafe_profiles').select('id, username').in('id', userIds)
    : { data: [] };
  const usernameMap = new Map((profiles ?? []).map((p: { id: string; username: string | null }) => [p.id, p.username]));

  return new Response(
    JSON.stringify({
      covers: rows.map((r) => ({
        ...r,
        uploader_username: usernameMap.get(r.user_id) ?? null,
        cf_image_id: r.storage_path.startsWith('cf:') ? r.storage_path.slice(3) : null,
      })),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
