import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { id?: string } | null;

  if (!body?.id) {
    return json({ error: 'id is required' }, 400);
  }

  const { error } = await sb
    .from('covers_cafe_official_covers')
    .delete()
    .eq('id', body.id);

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
};
