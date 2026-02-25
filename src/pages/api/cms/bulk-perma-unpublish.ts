/**
 * POST /api/cms/bulk-perma-unpublish
 * Body: { userId: string; enabled: boolean; reason?: string }
 * Perma-unpublishes (or restores) ALL covers by a user.
 * When enabling, sends one cover_removed notification to the user.
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { userId?: string; enabled?: boolean; reason?: string } | null;
  if (!body?.userId || typeof body.enabled !== 'boolean') {
    return json({ error: 'userId and enabled are required' }, 400);
  }

  const patch = body.enabled
    ? { perma_unpublished: true, is_public: false }
    : { perma_unpublished: false };

  const { data: updated, error } = await sb
    .from('covers_cafe_covers')
    .update(patch)
    .eq('user_id', body.userId)
    .select('id');

  if (error) return json({ error: error.message }, 500);

  const count = updated?.length ?? 0;

  // When enabling perma-unpublish, send one summary notification to the owner
  if (body.enabled && count > 0) {
    const adminSb = getSupabaseServer();
    if (adminSb) {
      const reason = (typeof body.reason === 'string' && body.reason.trim())
        ? body.reason.trim()
        : 'DMCA/compliance';

      await adminSb.from('covers_cafe_notifications').insert({
        user_id: body.userId,
        actor_user_id: null,
        actor_identity_hash: null,
        type: 'cover_removed',
        cover_id: null,
        cover_title: `${count} cover${count !== 1 ? 's' : ''}`,
        cover_artist: '',
        actor_name: 'covers.cafe',
        actor_username: null,
        content: reason,
      });
    }
  }

  return json({ ok: true, count });
};
