import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sb = getSupabaseServer();
  if (!sb) return new Response('Media API unavailable', { status: 503 });

  const path = url.searchParams.get('path');
  if (!path) return new Response('Missing path', { status: 400 });

  const { data, error } = await sb.storage.from('covers_cafe_avatars').download(path);
  if (error || !data) return new Response('Not found', { status: 404 });

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': data.type || 'image/jpeg',
      'Cache-Control': 'public, max-age=2678400, immutable', // 31 days
    },
  });
};
