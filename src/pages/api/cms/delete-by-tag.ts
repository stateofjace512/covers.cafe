import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { isCfPath, cfImageIdFromPath, deleteFromCf } from '../../../lib/cloudflare';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { tag?: string } | null;
  const tag = body?.tag?.trim().toLowerCase();
  if (!tag) return new Response('tag is required', { status: 400 });

  const { data: covers, error: coversError } = await sb
    .from('covers_cafe_covers')
    .select('id, storage_path, thumbnail_path')
    .contains('tags', [tag]);

  if (coversError) return new Response(coversError.message, { status: 500 });
  if (!covers || covers.length === 0) {
    return new Response(JSON.stringify({ ok: true, deletedCount: 0 }), { status: 200 });
  }

  // Delete from storage (CF or Supabase)
  const cfIds = covers
    .filter((c) => isCfPath(c.storage_path))
    .map((c) => cfImageIdFromPath(c.storage_path));

  const supabasePaths = covers
    .filter((c) => !isCfPath(c.storage_path))
    .flatMap((c) => [c.storage_path, c.thumbnail_path])
    .filter(Boolean) as string[];

  await Promise.all(cfIds.map((id) => deleteFromCf(id).catch((err) => {
    console.error('[cms/delete-by-tag] CF delete error:', id, err);
  })));

  if (supabasePaths.length) {
    const { error: storageError } = await sb.storage.from('covers_cafe_covers').remove(supabasePaths);
    if (storageError) return new Response(storageError.message, { status: 500 });
  }

  const ids = covers.map((c) => c.id);
  const { error: deleteError } = await sb.from('covers_cafe_covers').delete().in('id', ids);
  if (deleteError) return new Response(deleteError.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true, deletedCount: ids.length }), { status: 200 });
};
