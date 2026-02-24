/**
 * POST /api/cf-upload-url
 * Authenticated endpoint. Generates a Cloudflare Images direct creator upload URL.
 * The client uses this URL to upload the file directly to Cloudflare, bypassing
 * Netlify's 6 MB function payload limit.
 *
 * Returns: { uploadUrl: string, cfImageId: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ ok: false, message: 'Unauthorized' }, 401);

  const sb = getSupabaseServer();
  if (!sb) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, message: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => ({})) as { phash?: string };
  const phash = typeof body.phash === 'string' ? body.phash.trim() : '';

  if (phash) {
    const { data: existingDup } = await sb
      .from('covers_cafe_covers')
      .select('id')
      .eq('phash', phash)
      .limit(1);
    if ((existingDup?.length ?? 0) > 0) {
      return json({ ok: false, code: 'DUPLICATE', message: 'This image is already in our gallery!' }, 409);
    }

    const { data: blockedOfficial } = await sb
      .from('covers_cafe_official_covers')
      .select('id')
      .eq('official_phash', phash)
      .limit(1);
    if ((blockedOfficial?.length ?? 0) > 0) {
      return json({ ok: false, code: 'OFFICIAL_BLOCKED', message: 'This image is not allowed on our site. Read our Terms: /terms' }, 403);
    }
  }

  const cfToken = import.meta.env.CLOUDFLARE_API as string | undefined;
  const accountId = import.meta.env.CLOUDFLARE_ACCOUNT_ID as string | undefined;
  if (!cfToken || !accountId) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
    { method: 'POST', headers: { Authorization: `Bearer ${cfToken}` } },
  );

  const cfJson = (await res.json()) as {
    success: boolean;
    result?: { id: string; uploadURL: string };
    errors?: Array<{ message: string }>;
  };

  if (!cfJson.success || !cfJson.result) {
    return json({ ok: false, message: cfJson.errors?.[0]?.message ?? 'Failed to create upload URL' }, 502);
  }

  return json({ ok: true, uploadUrl: cfJson.result.uploadURL, cfImageId: cfJson.result.id }, 200);
};
