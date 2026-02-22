import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { coverId?: string; isAcotw?: boolean } | null;
  if (!body?.coverId || typeof body.isAcotw !== 'boolean') {
    return new Response('coverId and isAcotw are required', { status: 400 });
  }

  const update: Record<string, unknown> = { is_acotw: body.isAcotw };
  if (body.isAcotw) {
    update.acotw_since = new Date().toISOString().slice(0, 10);
  }

  const { error } = await sb.from('covers_cafe_covers').update(update).eq('id', body.coverId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
