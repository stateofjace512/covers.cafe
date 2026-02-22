import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { coverId?: string } | null;
  const coverId = body?.coverId;
  if (!coverId) return new Response('coverId is required', { status: 400 });

  const { data: cover, error: coverError } = await sb
    .from('covers_cafe_covers')
    .select('id, storage_path, thumbnail_path')
    .eq('id', coverId)
    .maybeSingle();

  if (coverError || !cover) return new Response('Cover not found', { status: 404 });

  const paths = [cover.storage_path, cover.thumbnail_path].filter(Boolean) as string[];
  if (paths.length) await sb.storage.from('covers_cafe_covers').remove(paths);

  const { error: deleteErr } = await sb.from('covers_cafe_covers').delete().eq('id', coverId);
  if (deleteErr) return new Response(deleteErr.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
