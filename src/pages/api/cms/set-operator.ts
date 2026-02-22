import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  // Verify operator — returns 403 if not
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  // Use service-role client to bypass RLS on covers_cafe_operator_roles
  const adminSb = getSupabaseServer();
  if (!adminSb) return new Response('Server misconfigured', { status: 503 });

  const body = await request.json().catch(() => null) as { userId?: string; promote?: boolean } | null;
  const userId = body?.userId;
  const promote = body?.promote;
  if (!userId || promote === undefined) return new Response('userId and promote are required', { status: 400 });

  if (promote) {
    const { error } = await adminSb
      .from('covers_cafe_operator_roles')
      .upsert({ user_id: userId, role: 'operator' });
    if (error) return new Response(error.message, { status: 500 });
  } else {
    const { error } = await adminSb
      .from('covers_cafe_operator_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', 'operator');
    if (error) return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
