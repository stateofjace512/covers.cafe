/**
 * GET /api/download?id=<cover_id>[&size=<pixels>]
 * Proxies the full-resolution (or resized) cover image through the server so the
 * raw Cloudflare delivery URL is never exposed to the browser.
 *
 * Query params:
 *   id    — cover DB id (required)
 *   size  — max dimension in pixels (optional; omit for original full-size)
 *
 * Returns the image as application/octet-stream with Content-Disposition: attachment.
 */
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { getSupabaseServer } from './_supabase';

const CLOUDFLARE_API = import.meta.env.CLOUDFLARE_API as string;
const CLOUDFLARE_ACCOUNT_ID = import.meta.env.CLOUDFLARE_ACCOUNT_ID as string;

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ ok: false, message: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const coverId = url.searchParams.get('id');
  const sizeParam = url.searchParams.get('size');
  const targetSize = sizeParam ? parseInt(sizeParam, 10) : null;

  if (!coverId) return err('Missing id', 400);
  if (targetSize !== null && (isNaN(targetSize) || targetSize < 1 || targetSize > 10000)) {
    return err('Invalid size', 400);
  }

  const sb = getSupabaseServer();
  if (!sb) return err('Service unavailable', 503);

  // Resolve storage_path + metadata from DB
  const { data: cover } = await sb
    .from('covers_cafe_covers')
    .select('storage_path, title, artist')
    .eq('id', coverId)
    .maybeSingle();

  if (!cover?.storage_path?.startsWith('cf:')) return err('Not found', 404);

  const cfImageId = cover.storage_path.slice(3);

  if (!CLOUDFLARE_API || !CLOUDFLARE_ACCOUNT_ID) return err('Server misconfigured', 503);

  // Fetch the original blob from Cloudflare Images API (server-side only)
  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(cfImageId)}/blob`,
    { headers: { Authorization: `Bearer ${CLOUDFLARE_API}` } },
  );

  if (!cfRes.ok) return err('Image fetch failed', 502);

  const contentType = cfRes.headers.get('content-type') ?? 'image/jpeg';

  let body: Uint8Array;
  if (targetSize) {
    const buffer = Buffer.from(await cfRes.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(targetSize, targetSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 93 })
      .toBuffer();
    body = new Uint8Array(resized);
  } else {
    body = new Uint8Array(await cfRes.arrayBuffer());
  }

  const artist = cover.artist ?? 'Unknown Artist';
  const title = cover.title ?? 'cover';
  const suffix = targetSize ? `_${targetSize}px` : '';
  const filename = `${artist} - ${title}${suffix}.jpg`
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': targetSize ? 'image/jpeg' : contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
};
