/**
 * POST /api/upload-artist-photo
 * Authenticated endpoint. Uploads an artist photo to Cloudflare Images using a
 * deterministic custom ID so the delivery URL is always predictable.
 *
 * Form fields:
 *   file        — the image file
 *   artist_name — the artist name (used to derive the CF custom ID)
 *
 * Returns: { ok: true, url: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { uploadToCf, isCfPath } from '../../lib/cloudflare';

const CF_IMAGES_HASH = import.meta.env.PUBLIC_CF_IMAGES_HASH as string;
const CLOUDFLARE_API = import.meta.env.CLOUDFLARE_API as string;
const CLOUDFLARE_ACCOUNT_ID = import.meta.env.CLOUDFLARE_ACCOUNT_ID as string;

/** Deterministic CF custom ID for an artist photo. */
function artistPhotoCustomId(artistName: string): string {
  const sanitized = artistName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 220);
  return `artist-photo-${sanitized}`;
}

/** Delete a CF image by ID (ignore 404). */
async function deleteCfById(id: string): Promise<void> {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${CLOUDFLARE_API}` } },
  );
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response('Invalid form data', { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const artistName = (formData.get('artist_name') as string | null)?.trim();
  if (!file) return new Response('Missing file', { status: 400 });
  if (!artistName) return new Response('Missing artist_name', { status: 400 });

  const customId = artistPhotoCustomId(artistName);

  // Delete any existing image with this ID first (CF doesn't have upsert)
  await deleteCfById(customId).catch(() => {});

  let cfImageId: string;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const filename = `${customId}.jpg`;

    // Upload with custom ID
    const form = new FormData();
    form.append('file', new Blob([arrayBuffer]), filename);
    form.append('id', customId);
    form.append('metadata', JSON.stringify({ artist_name: artistName, type: 'artist-photo' }));

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
      { method: 'POST', headers: { Authorization: `Bearer ${CLOUDFLARE_API}` }, body: form },
    );
    const json = (await res.json()) as { success: boolean; result?: { id: string }; errors?: Array<{ message: string }> };
    if (!json.success || !json.result?.id) {
      throw new Error(json.errors?.[0]?.message ?? 'CF upload failed');
    }
    cfImageId = json.result.id;
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: err instanceof Error ? err.message : 'Upload failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const url = `https://imagedelivery.net/${CF_IMAGES_HASH}/${cfImageId}/public`;
  return new Response(JSON.stringify({ ok: true, url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
