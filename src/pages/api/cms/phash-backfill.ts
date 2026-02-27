/**
 * GET  /api/cms/phash-backfill?limit=N
 *   Returns covers whose phash is NULL or empty, up to limit (default 100).
 *
 * POST /api/cms/phash-backfill
 *   Body: { coverId: string, phash: string }
 *   Writes the computed phash back to covers_cafe_covers.
 *
 * Both require operator auth.
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireOperator(request);
  if (auth.error) return auth.error;

  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') ?? '100', 10)));

  // Use service-role client so we see every cover regardless of RLS.
  const admin = getSupabaseServer();
  if (!admin) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const { data, error } = await admin
    .from('covers_cafe_covers')
    .select('id, storage_path')
    .or('phash.is.null,phash.eq.')
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[phash-backfill] list error:', error.message);
    return json({ ok: false, message: error.message }, 500);
  }

  return json({ ok: true, covers: data ?? [] }, 200);
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if (auth.error) return auth.error;

  let body: { coverId?: string; phash?: string };
  try {
    body = await request.json() as { coverId?: string; phash?: string };
  } catch {
    return json({ ok: false, message: 'Invalid JSON' }, 400);
  }

  const { coverId, phash } = body;
  if (!coverId || typeof phash !== 'string') {
    return json({ ok: false, message: 'coverId and phash required' }, 400);
  }

  const admin = getSupabaseServer();
  if (!admin) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const { error } = await admin
    .from('covers_cafe_covers')
    .update({ phash: phash || null })
    .eq('id', coverId);

  if (error) {
    console.error('[phash-backfill] update error:', error.message);
    return json({ ok: false, message: error.message }, 500);
  }

  return json({ ok: true }, 200);
};
