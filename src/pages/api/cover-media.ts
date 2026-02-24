import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { isCfPath, cfImageIdFromPath } from '../../lib/cloudflare';
import sharp from 'sharp';

const CACHE_31_DAYS = 'public, max-age=2678400, immutable';
const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;
const VALID_SIZES = new Set([500, 800, 1000, 1500, 3000]);

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Media API unavailable', { status: 503 });

  let storagePath = url.searchParams.get('path');
  const coverId = url.searchParams.get('id');
  const sizeParam = url.searchParams.get('size');

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

  // CF images: redirect directly to Cloudflare CDN
  if (isCfPath(storagePath)) {
    const imageId = cfImageIdFromPath(storagePath);
    const cfUrl = `https://imagedelivery.net/${CF_IMAGES_HASH}/${imageId}/public`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: cfUrl,
        'Cache-Control': CACHE_31_DAYS,
      },
    });
  }

  // Legacy Supabase images: download and optionally resize via Sharp
  const { data, error } = await sb.storage.from('covers_cafe_covers').download(storagePath);
  if (error || !data) return new Response('Not found', { status: 404 });

  const requestedSize = sizeParam ? parseInt(sizeParam, 10) : null;

  if (requestedSize && VALID_SIZES.has(requestedSize)) {
    const arrayBuffer = await data.arrayBuffer();
    const resized = await sharp(Buffer.from(arrayBuffer))
      .resize(requestedSize, requestedSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();

    return new Response(resized, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': CACHE_31_DAYS,
      },
    });
  }

  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': data.type || 'image/jpeg',
      'Cache-Control': CACHE_31_DAYS,
    },
  });
};
