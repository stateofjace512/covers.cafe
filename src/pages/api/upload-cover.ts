/**
 * POST /api/upload-cover
 * Authenticated endpoint. Accepts cover metadata + a Cloudflare image ID (the file
 * was already uploaded directly to CF via /api/cf-upload-url), then inserts a row
 * in covers_cafe_covers.
 *
 * Body (JSON):
 *   cfImageId — CF image ID returned after direct upload (required)
 *   title     — album/cover title (required)
 *   artist    — artist name (required)
 *   year      — release year (optional)
 *   tags      — array of tag strings (optional)
 *   phash     — perceptual hash hex string (optional, computed client-side)
 *
 * Returns: { ok: true, cover_id: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function normalizePhash(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
}

function hammingDistanceHex(a: string, b: string): number {
  const x = normalizePhash(a);
  const y = normalizePhash(b);
  const n = Math.min(x.length, y.length);
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const b1 = parseInt(x[i], 16).toString(2).padStart(4, '0');
    const b2 = parseInt(y[i], 16).toString(2).padStart(4, '0');
    for (let j = 0; j < 4; j++) if (b1[j] !== b2[j]) dist++;
  }
  return dist + Math.abs(x.length - y.length) * 4;
}

async function isOfficialHashBlocked(sb: ReturnType<typeof getSupabaseServer>, phash: string): Promise<boolean> {
  const normalized = normalizePhash(phash);
  if (!normalized) return false;

  const { data: exact } = await sb
    .from('covers_cafe_official_covers')
    .select('id')
    .eq('official_phash', normalized)
    .limit(1);
  if ((exact?.length ?? 0) > 0) return true;

  const { data: officialHashes } = await sb
    .from('covers_cafe_official_covers')
    .select('official_phash')
    .not('official_phash', 'is', null)
    .limit(10000);

  const NEAR_DUP_THRESHOLD = 6;
  return (officialHashes ?? []).some((row: { official_phash: string | null }) =>
    row.official_phash && hammingDistanceHex(normalized, row.official_phash) <= NEAR_DUP_THRESHOLD,
  );
}


export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return json({ ok: false, message: 'Unauthorized' }, 401);

  // Use token so RLS auth.uid() works when only anon key is available
  const sb = getSupabaseServer(token);
  if (!sb) return json({ ok: false, message: 'Server misconfigured' }, 503);

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, message: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  const { data: activeBan } = await sb
    .from('covers_cafe_user_bans')
    .select('reason, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  const isBanned = Boolean(activeBan) && !(activeBan?.expires_at && new Date(activeBan.expires_at) < new Date());
  if (isBanned) {
    return json({ ok: false, message: activeBan?.reason || 'Your account is restricted from posting.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const cfImageId = typeof body.cfImageId === 'string' ? body.cfImageId.trim() : null;
  if (!cfImageId) return json({ ok: false, message: 'Missing cfImageId' }, 400);

  const title = typeof body.title === 'string' ? body.title.trim() : null;
  const artist = typeof body.artist === 'string' ? body.artist.trim() : null;
  if (!title || !artist) return json({ ok: false, message: 'title and artist are required' }, 400);

  const yearRaw = body.year;
  const year = typeof yearRaw === 'number' ? yearRaw : typeof yearRaw === 'string' ? parseInt(yearRaw, 10) : null;
  const tags = Array.isArray(body.tags) ? (body.tags as string[]).filter((t) => typeof t === 'string') : [];
  const phash = normalizePhash(typeof body.phash === 'string' ? body.phash : '');

  if (phash) {
    const { data: existingDup } = await sb
      .from('covers_cafe_covers')
      .select('id')
      .eq('phash', phash)
      .limit(1);
    if ((existingDup?.length ?? 0) > 0) {
      return json({ ok: false, code: 'DUPLICATE', message: 'This image is already in our gallery!' }, 409);
    }

    if (await isOfficialHashBlocked(sb, phash)) {
      return json({ ok: false, code: 'OFFICIAL_BLOCKED', message: 'This image is not allowed on our site. Read our Terms: /terms' }, 403);
    }
  }

  const storagePath = `cf:${cfImageId}`;
  const { data: cover, error: insertErr } = await sb
    .from('covers_cafe_covers')
    .insert({
      user_id: userId,
      title,
      artist,
      year: typeof year === 'number' && Number.isFinite(year) ? year : null,
      tags,
      storage_path: storagePath,
      image_url: '',
      phash,
      is_public: true,
    })
    .select('id')
    .single();

  if (insertErr || !cover) {
    console.error('[upload-cover] DB insert error:', insertErr?.message);
    return json({ ok: false, message: `Database insert failed: ${insertErr?.message ?? 'unknown'}` }, 500);
  }

  return json({ ok: true, cover_id: cover.id }, 200);
};
