import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const GET: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const userId = userData.user.id;

  // Get user's profile (for username, needed to filter own comments)
  const { data: profile } = await sb
    .from('covers_cafe_profiles')
    .select('username')
    .eq('id', userId)
    .single();

  const username = profile?.username ?? null;

  // Get user's cover IDs and titles
  const { data: userCovers } = await sb
    .from('covers_cafe_covers')
    .select('id, title, artist')
    .eq('user_id', userId)
    .eq('is_public', true);

  const coverIds = (userCovers ?? []).map((c: { id: string }) => c.id);
  const coverMap: Record<string, { title: string; artist: string }> = {};
  for (const c of userCovers ?? []) {
    coverMap[c.id] = { title: c.title, artist: c.artist };
  }

  if (!coverIds.length) {
    return new Response(JSON.stringify({ notifications: [], total: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent favorites on user's covers by other users
  const { data: favRows } = await sb
    .from('covers_cafe_favorites')
    .select('id, cover_id, user_id, created_at')
    .in('cover_id', coverIds)
    .neq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  // Fetch actor profiles for favorites
  const favUserIds = [...new Set((favRows ?? []).map((f: { user_id: string }) => f.user_id))];
  const profileMap: Record<string, string> = {};
  if (favUserIds.length > 0) {
    const { data: actorProfiles } = await sb
      .from('covers_cafe_profiles')
      .select('id, username, display_name')
      .in('id', favUserIds);
    for (const p of actorProfiles ?? []) {
      profileMap[p.id] = p.display_name ?? p.username ?? 'Someone';
    }
  }

  // Fetch recent comments on user's covers by other users
  const { data: commentRows } = await sb
    .from('comments')
    .select('id, page_slug, content, created_at, author_username')
    .in('page_slug', coverIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  const filteredComments = (commentRows ?? []).filter(
    (c: { author_username: string }) => !username || c.author_username !== username
  );

  // Combine and sort
  const notifications = [
    ...(favRows ?? []).map((f: { id: string; cover_id: string; user_id: string; created_at: string }) => ({
      id: `fav-${f.id}`,
      type: 'favorite' as const,
      cover_id: f.cover_id,
      cover_title: coverMap[f.cover_id]?.title ?? 'a cover',
      cover_artist: coverMap[f.cover_id]?.artist ?? '',
      actor_name: profileMap[f.user_id] ?? 'Someone',
      content: null,
      created_at: f.created_at,
    })),
    ...filteredComments.map((c: { id: string; page_slug: string; content: string; created_at: string; author_username: string }) => ({
      id: `cmt-${c.id}`,
      type: 'comment' as const,
      cover_id: c.page_slug,
      cover_title: coverMap[c.page_slug]?.title ?? 'a cover',
      cover_artist: coverMap[c.page_slug]?.artist ?? '',
      actor_name: c.author_username,
      content: c.content?.slice(0, 100) ?? null,
      created_at: c.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);

  return new Response(
    JSON.stringify({ notifications, total: notifications.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
