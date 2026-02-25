/**
 * GET /api/cover-media?id=<cover_id>[&variant=<cf_variant>]
 *   OR /api/cover-media?path=cf:<cfImageId>[&variant=<cf_variant>]
 *
 * Proxies the Cloudflare Images delivery through the server so raw
 * imagedelivery.net URLs are never exposed to the browser.
 *
 * Query params:
 *   id      — cover DB id  (one of id or path required)
 *   path    — raw storage_path like "cf:<imageId>"
 *   variant — CF Images variant name (default: "public")
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { isCfPath, cfImageIdFromPath } from '../../lib/cloudflare';

const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;
// Aggressively cache proxied images — CF Images content is immutable per image ID.
const BROWSER_CACHE = 'public, max-age=31536000, immutable';
const SHARED_CACHE = 'public, s-maxage=31536000, stale-while-revalidate=604800';

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Media API unavailable', { status: 503 });

  let storagePath = url.searchParams.get('path');
  const coverId = url.searchParams.get('id');
  const variant = url.searchParams.get('variant') ?? 'public';

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
  const cfUrl = `https://imagedelivery.net/${CF_IMAGES_HASH}/${imageId}/${variant}`;

  const cfRes = await fetch(cfUrl);
  if (!cfRes.ok) {
    return new Response('Image not found', { status: cfRes.status === 404 ? 404 : 502 });
  }

  const contentType = cfRes.headers.get('content-type') ?? 'image/jpeg';
  const body = await cfRes.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': BROWSER_CACHE,
      'CDN-Cache-Control': SHARED_CACHE,
      'Cloudflare-CDN-Cache-Control': SHARED_CACHE,
    },
  });
};
