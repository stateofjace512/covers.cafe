import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

/**
 * POST /api/cms/set-operator
 * Operator-only. Assign or remove a role for a user.
 *
 * Body:
 *   userId  — target user id (required)
 *   role    — 'operator' | 'moderator' | 'helper' (required when promote=true)
 *   promote — true to assign, false to remove (required)
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const adminSb = getSupabaseServer();
  if (!adminSb) return new Response('Server misconfigured', { status: 503 });

  const body = await request.json().catch(() => null) as {
    userId?: string;
    role?: string;
    promote?: boolean;
  } | null;

  const userId = body?.userId;
  const promote = body?.promote;
  const role = body?.role ?? 'operator';

  if (!userId || promote === undefined) {
    return new Response('userId and promote are required', { status: 400 });
  }

  const validRoles = ['operator', 'moderator', 'helper'];
  if (!validRoles.includes(role)) {
    return new Response(`role must be one of: ${validRoles.join(', ')}`, { status: 400 });
  }

  if (promote) {
    const { error } = await adminSb
      .from('covers_cafe_operator_roles')
      .upsert({ user_id: userId, role });
    if (error) return new Response(error.message, { status: 500 });
  } else {
    // Block removal of permanently-locked operators
    const { data: existing } = await adminSb
      .from('covers_cafe_operator_roles')
      .select('can_be_removed')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.can_be_removed === false) {
      return new Response('This operator is permanently locked and cannot be removed.', { status: 403 });
    }

    const { error } = await adminSb
      .from('covers_cafe_operator_roles')
      .delete()
      .eq('user_id', userId);
    if (error) return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
