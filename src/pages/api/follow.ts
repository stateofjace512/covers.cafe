/**
 * GET  /api/follow?userId=<uuid>   — check follow status + counts (auth optional)
 * POST /api/follow                 — follow or unfollow (auth required)
 *   body: { userId: string; follow: boolean }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function getAuthedUserId(request: Request): Promise<string | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? null;
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export const GET: APIRoute = async ({ request, url }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Server misconfigured' }, 500);

  const targetUserId = url.searchParams.get('userId');
  if (!targetUserId) return json({ error: 'userId is required' }, 400);

  const myUserId = await getAuthedUserId(request);

  // follower count for target user
  const { count: followerCount } = await sb
    .from('covers_cafe_follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('following_id', targetUserId);

  // following count for target user
  const { count: followingCount } = await sb
    .from('covers_cafe_follows')
    .select('following_id', { count: 'exact', head: true })
    .eq('follower_id', targetUserId);

  let following = false;
  if (myUserId && myUserId !== targetUserId) {
    const { data } = await sb
      .from('covers_cafe_follows')
      .select('follower_id')
      .eq('follower_id', myUserId)
      .eq('following_id', targetUserId)
      .maybeSingle();
    following = !!data;
  }

  return json({ following, followerCount: followerCount ?? 0, followingCount: followingCount ?? 0 });
};

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Server misconfigured' }, 500);

  const myUserId = await getAuthedUserId(request);
  if (!myUserId) return json({ error: 'Authentication required' }, 401);

  const body = await request.json().catch(() => null) as { userId?: string; follow?: boolean } | null;
  if (!body?.userId || typeof body.follow !== 'boolean') {
    return json({ error: 'userId and follow are required' }, 400);
  }

  if (body.userId === myUserId) return json({ error: 'Cannot follow yourself' }, 400);

  if (body.follow) {
    const { error } = await sb
      .from('covers_cafe_follows')
      .insert({ follower_id: myUserId, following_id: body.userId });
    if (error && error.code !== '23505') { // ignore duplicate key
      return json({ error: error.message }, 500);
    }
  } else {
    const { error } = await sb
      .from('covers_cafe_follows')
      .delete()
      .eq('follower_id', myUserId)
      .eq('following_id', body.userId);
    if (error) return json({ error: error.message }, 500);
  }

  return json({ ok: true });
};
