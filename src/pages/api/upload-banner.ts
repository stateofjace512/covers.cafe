/**
 * POST /api/upload-banner
 * Authenticated. Accepts a banner image (multipart/form-data),
 * resizes to 1200×400 and uploads to Cloudflare Images.
 * Returns: { ok: true, url: string }
 */
import type { APIRoute } from 'astro';
import { uploadToCf } from '../../lib/cloudflare';
import sharp from 'sharp';

const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Decode a JWT payload without verifying the signature. */
function jwtUserId(token: string): string | null {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { sub?: string };
    return typeof decoded.sub === 'string' && decoded.sub ? decoded.sub : null;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ ok: false, message: 'Unauthorized' }, 401);

  const userId = jwtUserId(token);
  if (!userId) return json({ ok: false, message: 'Unauthorized' }, 401);

  let formData: FormData;
  try { formData = await request.formData(); } catch { return json({ ok: false, message: 'Invalid form data' }, 400); }

  const file = formData.get('file') as File | null;
  if (!file) return json({ ok: false, message: 'Missing file' }, 400);
  if (file.size > MAX_SIZE_BYTES) return json({ ok: false, message: 'File too large (max 10 MB)' }, 413);

  let resizedBuffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    resizedBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize(1200, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return json({ ok: false, message: 'Could not process image' }, 400);
  }

  // Correctly slice the ArrayBuffer — Node.js Buffer may share a pooled ArrayBuffer,
  // so we must use byteOffset/byteLength to extract only the image data.
  const imageArrayBuffer = resizedBuffer.buffer.slice(
    resizedBuffer.byteOffset,
    resizedBuffer.byteOffset + resizedBuffer.byteLength,
  );

  let cfImageId: string;
  try {
    cfImageId = await uploadToCf(imageArrayBuffer, `banner-${userId}.jpg`, {
      user_id: userId,
      type: 'banner',
    });
  } catch (err) {
    console.error('[upload-banner] CF upload error:', err);
    return json({ ok: false, message: err instanceof Error ? err.message : 'Upload failed' }, 502);
  }

  const url = `https://imagedelivery.net/${CF_IMAGES_HASH}/${cfImageId}/public`;
  return json({ ok: true, url });
};
