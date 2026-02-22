import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

interface StoredNotification {
  id: string;
  type: 'favorite' | 'comment';
  cover_id: string;
  cover_title: string;
  cover_artist: string;
  actor_name: string;
  actor_username: string | null;
  content: string | null;
  created_at: string;
  read_at: string | null;
}

async function getAuthedUserId(request: Request): Promise<string | null> {
  const sb = getSupabaseServer();
  if (!sb) return null;
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return null;
  return userData.user.id;
}

export const GET: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  const userId = await getAuthedUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { data, error } = await sb
    .from('covers_cafe_notifications')
    .select('id, type, cover_id, cover_title, cover_artist, actor_name, actor_username, content, created_at, read_at')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const notifications = (data ?? []) as StoredNotification[];
  return new Response(
    JSON.stringify({ notifications, total: notifications.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

export const PATCH: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  const userId = await getAuthedUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body?.action !== 'mark_read_all') {
    return new Response('Bad request', { status: 400 });
  }

  const { error } = await sb
    .from('covers_cafe_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .is('read_at', null);

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  const userId = await getAuthedUserId(request);
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return new Response('Bad request', { status: 400 });

  const { error } = await sb
    .from('covers_cafe_notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
