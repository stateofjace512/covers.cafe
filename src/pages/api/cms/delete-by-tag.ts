import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

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
  if (!covers || covers.length === 0) return new Response(JSON.stringify({ ok: true, deletedCount: 0 }), { status: 200 });

  const paths = covers
    .flatMap((cover) => [cover.storage_path, cover.thumbnail_path])
    .filter(Boolean) as string[];

  if (paths.length) {
    const { error: storageError } = await sb.storage.from('covers_cafe_covers').remove(paths);
    if (storageError) return new Response(storageError.message, { status: 500 });
  }

  const ids = covers.map((cover) => cover.id);
  const { error: deleteError } = await sb.from('covers_cafe_covers').delete().in('id', ids);
  if (deleteError) return new Response(deleteError.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true, deletedCount: ids.length }), { status: 200 });
};
