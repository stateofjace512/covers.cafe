/**
 * POST /api/collection-delete
 * Authenticated. Deletes a collection (and all its items) owned by the requesting user.
 *
 * Body: { collection_id: string }
 * Returns: { ok: true }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });
  const userId = userData.user.id;

  const body = await request.json().catch(() => null) as { collection_id?: string } | null;
  const collectionId = body?.collection_id;
  if (!collectionId) return new Response('collection_id is required', { status: 400 });

  // Verify ownership
  const { data: col, error: fetchErr } = await sb
    .from('covers_cafe_collections')
    .select('id, owner_id')
    .eq('id', collectionId)
    .maybeSingle();

  if (fetchErr || !col) return new Response('Collection not found', { status: 404 });
  if (col.owner_id !== userId) return new Response('Forbidden', { status: 403 });

  // Delete all items first (FK constraint)
  await sb.from('covers_cafe_collection_items').delete().eq('collection_id', collectionId);

  // Delete the collection
  const { error: deleteErr } = await sb
    .from('covers_cafe_collections')
    .delete()
    .eq('id', collectionId);

  if (deleteErr) return new Response(deleteErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
