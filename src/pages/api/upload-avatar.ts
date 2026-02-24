/**
 * POST /api/upload-avatar
 * Authenticated endpoint. Accepts an avatar image (multipart/form-data),
 * crops/resizes it server-side, and uploads to Cloudflare Images.
 * Returns the public CF delivery URL to be saved via /api/account/update-profile.
 *
 * Form fields:
 *   file — the image (any format, will be re-encoded as JPEG 500×500)
 *
 * Returns: { ok: true, url: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { uploadToCf } from '../../lib/cloudflare';
import sharp from 'sharp';

const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });
  const userId = userData.user.id;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return new Response('Missing file', { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return new Response('File too large (max 10 MB)', { status: 413 });

  // Resize to 500×500 square JPEG server-side
  let resizedBuffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    resizedBuffer = await sharp(Buffer.from(arrayBuffer))
      .resize(500, 500, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Could not process image' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Upload to Cloudflare Images (one image per user, keyed by userId)
  let cfImageId: string;
  try {
    cfImageId = await uploadToCf(resizedBuffer.buffer as ArrayBuffer, `avatar-${userId}.jpg`, {
      user_id: userId,
      type: 'avatar',
    });
  } catch (err) {
    console.error('[upload-avatar] CF upload error:', err);
    return new Response(
      JSON.stringify({ ok: false, message: err instanceof Error ? err.message : 'Upload failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const url = `https://imagedelivery.net/${CF_IMAGES_HASH}/${cfImageId}/public`;

  return new Response(
    JSON.stringify({ ok: true, url }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
