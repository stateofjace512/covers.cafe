import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb, user } = auth;

  const body = await request.json().catch(() => null) as { userId?: string; reason?: string | null } | null;
  const userId = body?.userId;
  if (!userId) return new Response('userId is required', { status: 400 });

  const { error } = await sb.from('covers_cafe_user_bans').upsert({
    user_id: userId,
    reason: body?.reason ?? null,
    banned_by: user.id,
  });

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
