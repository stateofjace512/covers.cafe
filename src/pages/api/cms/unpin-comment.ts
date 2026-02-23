import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const getBearer = (req: Request) =>
  req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? null;

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Supabase is not configured' }, 500);

  const token = getBearer(request);
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Authentication required' }, 401);

  // Operator check
  const { data: opRow } = await sb
    .from('covers_cafe_operator_roles')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .eq('role', 'operator')
    .maybeSingle();
  if (!opRow) return json({ error: 'Forbidden' }, 403);

  const { pinId } = await request.json() as { pinId: string };
  if (!pinId) return json({ error: 'pinId is required' }, 400);

  // Fetch pin to get author info for removing achievement
  const { data: pin } = await sb
    .from('covers_cafe_poh_pins')
    .select('id, author_user_id')
    .eq('id', pinId)
    .maybeSingle();

  if (!pin) return json({ error: 'Pin not found' }, 404);

  // Remove the pin
  await sb.from('covers_cafe_poh_pins').delete().eq('id', pinId);

  // Remove associated achievement
  if (pin.author_user_id) {
    await sb
      .from('covers_cafe_achievements')
      .delete()
      .eq('user_id', pin.author_user_id)
      .eq('type', 'poh')
      .eq('reference_id', pinId);
  }

  return json({ success: true });
};
