import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { userId?: string; promote?: boolean } | null;
  const userId = body?.userId;
  const promote = body?.promote;
  if (!userId || promote === undefined) return new Response('userId and promote are required', { status: 400 });

  if (promote) {
    const { error } = await sb
      .from('covers_cafe_operator_roles')
      .upsert({ user_id: userId, role: 'operator' });
    if (error) return new Response(error.message, { status: 500 });
  } else {
    const { error } = await sb
      .from('covers_cafe_operator_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'operator');
    if (error) return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
