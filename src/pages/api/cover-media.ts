import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { isCfPath, cfImageIdFromPath } from '../../lib/cloudflare';

const CACHE_31_DAYS = 'public, max-age=2678400, immutable';
const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Media API unavailable', { status: 503 });

  let storagePath = url.searchParams.get('path');
  const coverId = url.searchParams.get('id');

  // Resolve path from cover ID if only ID given
  if (!storagePath && coverId) {
    const { data } = await sb
      .from('covers_cafe_covers')
      .select('storage_path')
      .eq('id', coverId)
      .single();
    storagePath = data?.storage_path ?? null;
  }

  if (!storagePath) return new Response('Missing id/path', { status: 400 });

  if (!isCfPath(storagePath)) return new Response('Not found', { status: 404 });

  const imageId = cfImageIdFromPath(storagePath);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://imagedelivery.net/${CF_IMAGES_HASH}/${imageId}/public`,
      'Cache-Control': CACHE_31_DAYS,
    },
  });
};
