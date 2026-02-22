import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const GET: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const { data, error } = await sb
    .from('covers_cafe_user_bans')
    .select('reason, expires_at')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) return new Response(error.message, { status: 500 });

  // Treat as not banned if the ban has expired
  const isExpired = data?.expires_at ? new Date(data.expires_at) < new Date() : false;

  return new Response(JSON.stringify({
    isBanned: Boolean(data) && !isExpired,
    reason: data?.reason ?? null,
    expiresAt: data?.expires_at ?? null,
  }), { status: 200 });
};
