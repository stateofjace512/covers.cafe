/**
 * GET  /api/friends?userId=<uuid>     → { friends, pendingReceived, pendingSent, status }
 * POST /api/friends                   → toggle friend request / accept / remove
 *
 * POST body: { userId: string, action: 'request' | 'accept' | 'remove' }
 *
 * Self-friend easter egg: if userId === own id, auto-accepts and awards 'certified_loner'.
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ── GET ───────────────────────────────────────────────────────────────────────
export const GET: APIRoute = async ({ url, request }) => {
  // Extract token FIRST so it can be passed to getSupabaseServer.
  // Without it, anon-key clients have auth.uid()=null and RLS blocks every read.
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const sb = getSupabaseServer(token ?? undefined);
  if (!sb) return json({ error: 'Supabase not configured' }, 500);

  const targetUserId = url.searchParams.get('userId');
  if (!targetUserId) return json({ error: 'userId required' }, 400);

  // Get authenticated user (optional — unauthenticated users just see the friend list)
  let viewerId: string | null = null;
  if (token) {
    const { data } = await sb.auth.getUser(token);
    viewerId = data?.user?.id ?? null;
  }

  // Fetch accepted friends of the target user
  const { data: friendRows } = await sb
    .from('covers_cafe_friends')
    .select('user_id, friend_id, status, created_at')
    .or(`user_id.eq.${targetUserId},friend_id.eq.${targetUserId}`)
    .eq('status', 'accepted');

  // Collect friend user IDs (the "other" side of each row)
  const friendIds: string[] = (friendRows ?? []).map((r: { user_id: string; friend_id: string }) =>
    r.user_id === targetUserId ? r.friend_id : r.user_id,
  );

  // Fetch profiles for those friends
  let friendProfiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] = [];
  if (friendIds.length > 0) {
    const { data: profiles } = await sb
      .from('covers_cafe_profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', friendIds);
    friendProfiles = (profiles ?? []) as typeof friendProfiles;
  }

  // If viewer is authenticated, also tell them their friendship status with targetUser
  let viewerStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
  if (viewerId && viewerId !== targetUserId) {
    const { data: statusRow } = await sb
      .from('covers_cafe_friends')
      .select('status, user_id, friend_id')
      .or(
        `and(user_id.eq.${viewerId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${viewerId})`,
      )
      .maybeSingle();
    if (statusRow) {
      if (statusRow.status === 'accepted') viewerStatus = 'accepted';
      else if (statusRow.user_id === viewerId) viewerStatus = 'pending_sent';
      else viewerStatus = 'pending_received';
    }
  }

  // If viewer is looking at their own profile, return incoming and outgoing pending requests
  let pendingReceived: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] = [];
  let pendingSent: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] = [];
  if (viewerId && viewerId === targetUserId) {
    const [{ data: receivedRows }, { data: sentRows }] = await Promise.all([
      sb.from('covers_cafe_friends').select('user_id').eq('friend_id', targetUserId).eq('status', 'pending'),
      sb.from('covers_cafe_friends').select('friend_id').eq('user_id', targetUserId).eq('status', 'pending'),
    ]);

    const receivedIds = (receivedRows as { user_id: string }[] ?? []).map((r) => r.user_id);
    const sentIds = (sentRows as { friend_id: string }[] ?? []).map((r) => r.friend_id);
    const allIds = [...new Set([...receivedIds, ...sentIds])];

    let allProfiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] = [];
    if (allIds.length > 0) {
      const { data } = await sb.from('covers_cafe_profiles').select('id, username, display_name, avatar_url').in('id', allIds);
      allProfiles = (data ?? []) as typeof allProfiles;
    }

    pendingReceived = allProfiles.filter((p) => receivedIds.includes(p.id));
    pendingSent = allProfiles.filter((p) => sentIds.includes(p.id));
  }

  return json({ friends: friendProfiles, viewerStatus, friendCount: friendProfiles.length, pendingReceived, pendingSent });
};

// ── POST ──────────────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Supabase not configured' }, 500);

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const viewerId = userData.user.id;

  let body: { userId: string; action: 'request' | 'accept' | 'remove' };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { userId: targetId, action } = body;
  if (!targetId || !action) return json({ error: 'userId and action required' }, 400);

  // ── Self-friend easter egg ──────────────────────────────────────────────────
  if (targetId === viewerId) {
    // Check if already awarded (NULL reference_id means the standard unique constraint
    // won't prevent duplicates — must check explicitly).
    const { data: existingLoner } = await sb
      .from('covers_cafe_achievements')
      .select('id')
      .eq('user_id', viewerId)
      .eq('type', 'certified_loner')
      .is('reference_id', null)
      .maybeSingle();

    if (!existingLoner) {
      await sb.from('covers_cafe_achievements').insert({
        user_id: viewerId,
        type: 'certified_loner',
        reference_id: null,
        metadata: { note: 'You have friended yourself.' },
        awarded_at: new Date().toISOString(),
      });
    }

    return json({
      ok: true,
      easter_egg: true,
      already_loner: !!existingLoner,
      message: existingLoner
        ? 'Still a certified loner.'
        : 'You have friended yourself, auto approved!',
      achievement: 'certified_loner',
    });
  }

  if (action === 'request') {
    // Check if a row already exists either direction
    const { data: existing } = await sb
      .from('covers_cafe_friends')
      .select('id, status, user_id')
      .or(
        `and(user_id.eq.${viewerId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${viewerId})`,
      )
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') return json({ ok: true, status: 'accepted' });
      // If the other person already sent a request, auto-accept
      if (existing.user_id === targetId) {
        await sb
          .from('covers_cafe_friends')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        return json({ ok: true, status: 'accepted' });
      }
      return json({ ok: true, status: 'pending_sent' });
    }

    // Insert new request
    const { error } = await sb
      .from('covers_cafe_friends')
      .insert({ user_id: viewerId, friend_id: targetId, status: 'pending' });
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, status: 'pending_sent' });
  }

  if (action === 'accept') {
    // Accept an incoming request (where viewer is the friend_id)
    const { error } = await sb
      .from('covers_cafe_friends')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('user_id', targetId)
      .eq('friend_id', viewerId)
      .eq('status', 'pending');
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, status: 'accepted' });
  }

  if (action === 'remove') {
    // Remove friendship / cancel request (either direction)
    await sb
      .from('covers_cafe_friends')
      .delete()
      .or(
        `and(user_id.eq.${viewerId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${viewerId})`,
      );
    return json({ ok: true, status: 'none' });
  }

  return json({ error: 'Unknown action' }, 400);
};
