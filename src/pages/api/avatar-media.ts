import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const CACHE_31_DAYS = 'public, max-age=2678400, immutable';

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Media API unavailable', { status: 503 });

  const path = url.searchParams.get('path');
  if (!path) return new Response('Missing path', { status: 400 });

  // CF avatars have their full delivery URL stored directly in profiles.avatar_url,
  // so they never reach this endpoint. This handler covers legacy Supabase avatars only.
  const { data, error } = await sb.storage.from('covers_cafe_avatars').download(path);
  if (error || !data) return new Response('Not found', { status: 404 });

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': data.type || 'image/jpeg',
      'Cache-Control': CACHE_31_DAYS,
    },
  });
};
