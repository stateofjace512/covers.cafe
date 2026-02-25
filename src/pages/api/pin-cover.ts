/**
 * POST /api/pin-cover
 * Authenticated. Pins or unpins a cover on the user's profile.
 * Body: { cover_id: string, action: 'pin' | 'unpin' }
 * Max 6 pinned covers per user.
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const MAX_PINS = 6;
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ ok: false, message: 'Unauthorized' }, 401);

  const sb = getSupabaseServer();
  if (!sb) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, message: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { cover_id?: string; action?: string };
  try { body = await request.json(); } catch { return json({ ok: false, message: 'Invalid JSON' }, 400); }

  const { cover_id, action } = body;
  if (!cover_id || (action !== 'pin' && action !== 'unpin')) {
    return json({ ok: false, message: 'Missing cover_id or invalid action' }, 400);
  }

  if (action === 'unpin') {
    await sb.from('covers_cafe_pinned_covers').delete().eq('user_id', userId).eq('cover_id', cover_id);
    return json({ ok: true, pinned: false });
  }

  // Check current pin count
  const { count } = await sb
    .from('covers_cafe_pinned_covers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) >= MAX_PINS) {
    return json({ ok: false, message: `You can pin at most ${MAX_PINS} covers.` });
  }

  // Get next position
  const { data: existing } = await sb
    .from('covers_cafe_pinned_covers')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1);
  const nextPos = ((existing?.[0]?.position ?? -1) as number) + 1;

  const { error } = await sb
    .from('covers_cafe_pinned_covers')
    .insert({ user_id: userId, cover_id, position: nextPos });

  if (error) {
    if (error.code === '23505') return json({ ok: true, pinned: true }); // already pinned
    return json({ ok: false, message: 'Failed to pin cover' }, 500);
  }

  return json({ ok: true, pinned: true });
};
