/**
 * POST /api/cms/lock-operator
 * Operator-only. Permanently lock a staff member so their role and
 * staff status can never be changed or removed via the CMS.
 * This action cannot be undone through the interface.
 *
 * Body: { userId: string }
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  if (auth.role !== 'operator') return new Response('Forbidden', { status: 403 });

  const adminSb = getSupabaseServer();
  if (!adminSb) return new Response('Server misconfigured', { status: 503 });

  const body = await request.json().catch(() => null) as { userId?: string } | null;
  const userId = body?.userId;
  if (!userId) return new Response('userId is required', { status: 400 });

  const { error } = await adminSb
    .from('covers_cafe_operator_roles')
    .update({ can_be_removed: false })
    .eq('user_id', userId);

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
