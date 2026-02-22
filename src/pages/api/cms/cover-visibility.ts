import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { coverId?: string; isPublic?: boolean } | null;
  if (!body?.coverId || typeof body.isPublic !== 'boolean') {
    return new Response('coverId and isPublic are required', { status: 400 });
  }

  const { error } = await sb.from('covers_cafe_covers').update({ is_public: body.isPublic }).eq('id', body.coverId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
