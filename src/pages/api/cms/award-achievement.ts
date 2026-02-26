/**
 * POST /api/cms/award-achievement
 * Operator-only endpoint for granting or revoking achievement badges.
 *
 * Body: { userId: string, type: string, action: 'grant' | 'revoke', note?: string }
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

const OPERATOR_GRANTABLE_TYPES = new Set([
  'og', 'staff', 'verified',
  'acotw', 'poh',
  'milestone_1', 'milestone_50', 'milestone_100', 'milestone_250', 'milestone_500', 'milestone_1000',
  'certified_loner', 'contributor',
  'first_friend', 'friends_5', 'friends_25',
  'first_collection',
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const adminSb = getSupabaseServer();
  if (!adminSb) return json({ error: 'Server misconfigured' }, 503);

  const body = await request.json().catch(() => null) as {
    userId?: string;
    type?: string;
    action?: 'grant' | 'revoke';
    note?: string;
  } | null;

  const { userId, type, action, note } = body ?? {};
  if (!userId || !type || !action) return json({ error: 'userId, type, and action are required' }, 400);
  if (!OPERATOR_GRANTABLE_TYPES.has(type)) return json({ error: `type must be one of: ${[...OPERATOR_GRANTABLE_TYPES].join(', ')}` }, 400);
  if (action !== 'grant' && action !== 'revoke') return json({ error: 'action must be grant or revoke' }, 400);

  if (action === 'grant') {
    const { error } = await adminSb
      .from('covers_cafe_achievements')
      .insert({
        user_id: userId,
        type,
        reference_id: null,
        metadata: note ? { note } : {},
        awarded_at: new Date().toISOString(),
      });
    if (error) {
      // 23505 = unique_violation — already has the badge
      if (error.code === '23505') return json({ ok: true, already_granted: true });
      return json({ error: error.message }, 500);
    }
    return json({ ok: true });
  }

  // revoke
  const { error } = await adminSb
    .from('covers_cafe_achievements')
    .delete()
    .eq('user_id', userId)
    .eq('type', type)
    .is('reference_id', null);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
