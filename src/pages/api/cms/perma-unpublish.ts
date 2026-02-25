import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { coverId?: string; enabled?: boolean } | null;
  if (!body?.coverId || typeof body.enabled !== 'boolean') {
    return new Response('coverId and enabled are required', { status: 400 });
  }

  const patch = body.enabled
    ? { perma_unpublished: true, is_public: false }
    : { perma_unpublished: false };

  const { error } = await sb.from('covers_cafe_covers').update(patch).eq('id', body.coverId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
