/**
 * POST /api/delete-cover
 * Authenticated endpoint. Lets a user delete their own cover.
 * Handles both Cloudflare Images (cf:...) and legacy Supabase storage paths.
 *
 * Body: { cover_id: string }
 * Returns: { ok: true }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { isCfPath, cfImageIdFromPath, deleteFromCf } from '../../lib/cloudflare';

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });
  const userId = userData.user.id;

  const body = await request.json().catch(() => null) as { cover_id?: string } | null;
  const coverId = body?.cover_id;
  if (!coverId) return new Response('cover_id is required', { status: 400 });

  // Fetch the cover; verify ownership
  const { data: cover, error: fetchErr } = await sb
    .from('covers_cafe_covers')
    .select('id, storage_path, thumbnail_path, user_id')
    .eq('id', coverId)
    .maybeSingle();

  if (fetchErr || !cover) return new Response('Cover not found', { status: 404 });
  if (cover.user_id !== userId) return new Response('Forbidden', { status: 403 });

  // Delete from storage (CF or Supabase)
  if (isCfPath(cover.storage_path)) {
    await deleteFromCf(cfImageIdFromPath(cover.storage_path)).catch((err) => {
      console.error('[delete-cover] CF delete error:', err);
    });
  } else if (cover.storage_path) {
    const paths = [cover.storage_path, cover.thumbnail_path].filter(Boolean) as string[];
    if (paths.length) {
      await sb.storage.from('covers_cafe_covers').remove(paths);
    }
  }

  // Delete DB record
  const { error: deleteErr } = await sb.from('covers_cafe_covers').delete().eq('id', coverId);
  if (deleteErr) return new Response(deleteErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
