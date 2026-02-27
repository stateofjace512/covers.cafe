/**
 * POST /api/upload-cover
 * Authenticated endpoint. Accepts cover metadata + a Cloudflare image ID (the file
 * was already uploaded directly to CF via /api/cf-upload-url), then inserts a row
 * in covers_cafe_covers.
 *
 * Instead of hard-blocking duplicates or official-cover matches, covers are
 * inserted with moderation_status = 'approved' or 'under_review':
 *   - 'approved'     → is_public = true, immediately visible
 *   - 'under_review' → is_public = false, queued for operator review
 *
 * Body (JSON):
 *   cfImageId — CF image ID returned after direct upload (required)
 *   title     — album/cover title (required)
 *   artist    — artist name (required)
 *   year      — release year (optional)
 *   tags      — array of tag strings (optional)
 *   phash     — perceptual hash hex string (optional, computed client-side)
 *
 * Returns: { ok: true, cover_id: string, status: 'approved' | 'under_review' }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { deleteFromCf } from '../../lib/cloudflare';
import { createClient } from '@supabase/supabase-js';

/** Service-role client that always bypasses RLS — used for read-only moderation checks. */
function getAdminClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const key = (import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_PUBLIC_KEY) as string;
  return createClient(url, key);
}

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

const NEAR_DUP_THRESHOLD = 6;

/**
 * Check for near-duplicate fan covers.
 * Uses the admin (service-role) client so RLS never filters out other users'
 * covers. Does NOT filter by moderation_status — we want to flag duplicates
 * regardless of whether the matching cover is approved, under_review, etc.
 * Errors are logged rather than silently swallowed so failures are visible.
 */
async function findFanMatch(phash: string): Promise<string | null> {
  const admin = getAdminClient();
  const normalized = normalizePhash(phash);
  if (!normalized) return null;

  // Fast path: exact phash match
  const { data: exact, error: exactErr } = await admin
    .from('covers_cafe_covers')
    .select('id')
    .eq('phash', normalized)
    .limit(1);
  if (exactErr) console.error('[upload-cover] findFanMatch exact error:', exactErr.message);
  if ((exact?.length ?? 0) > 0) return (exact as Array<{ id: string }>)[0].id;

  // Near-dup path: hamming distance across all covers with a stored phash
  const { data: allHashes, error: hashErr } = await admin
    .from('covers_cafe_covers')
    .select('id, phash')
    .not('phash', 'is', null)
    .limit(10000);
  if (hashErr) console.error('[upload-cover] findFanMatch near-dup error:', hashErr.message);

  const near = (allHashes ?? []).find(
    (row: { id: string; phash: string | null }) =>
      row.phash && hammingDistanceHex(normalized, row.phash) <= NEAR_DUP_THRESHOLD,
  ) as { id: string; phash: string } | undefined;

  return near?.id ?? null;
}

/**
 * Check for near-duplicate official covers.
 * Also uses the admin client for consistency.
 */
async function findOfficialMatch(phash: string): Promise<string | null> {
  const admin = getAdminClient();
  const normalized = normalizePhash(phash);
  if (!normalized) return null;

  const { data: exact, error: exactErr } = await admin
    .from('covers_cafe_official_covers')
    .select('id')
    .eq('official_phash', normalized)
    .limit(1);
  if (exactErr) console.error('[upload-cover] findOfficialMatch exact error:', exactErr.message);
  if ((exact?.length ?? 0) > 0) return (exact as Array<{ id: string }>)[0].id;

  const { data: officialHashes, error: hashErr } = await admin
    .from('covers_cafe_official_covers')
    .select('id, official_phash')
    .not('official_phash', 'is', null)
    .limit(10000);
  if (hashErr) console.error('[upload-cover] findOfficialMatch near-dup error:', hashErr.message);

  const near = (officialHashes ?? []).find(
    (row: { id: string; official_phash: string | null }) =>
      row.official_phash && hammingDistanceHex(normalized, row.official_phash) <= NEAR_DUP_THRESHOLD,
  ) as { id: string; official_phash: string } | undefined;

  return near?.id ?? null;
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

  // Determine moderation status
  let moderationStatus: 'approved' | 'under_review' = 'approved';
  let moderationReason: string | null = null;
  let matchedCoverId: string | null = null;
  let matchedOfficialId: string | null = null;

  if (phash) {
    // Block re-submission: if this user already has a pending review for the same
    // image (near-dup phash, under_review, created within last 12 hours), reject early.
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const admin = getAdminClient();
    const { data: recentReviews, error: resubErr } = await admin
      .from('covers_cafe_covers')
      .select('id, phash')
      .eq('user_id', userId)
      .eq('moderation_status', 'under_review')
      .gte('created_at', twelveHoursAgo)
      .not('phash', 'is', null);
    if (resubErr) console.error('[upload-cover] re-submission check error:', resubErr.message);
    const recentReview = (recentReviews ?? []).filter(
      (r: { id: string; phash: string | null }) =>
        r.phash && hammingDistanceHex(phash, r.phash) <= NEAR_DUP_THRESHOLD,
    );
    if ((recentReview?.length ?? 0) > 0) {
      // Delete the just-uploaded CF image — it will never be stored in the DB.
      deleteFromCf(cfImageId).catch((err) => {
        console.error('[upload-cover] CF delete (re-submission) error:', err);
      });
      return json({
        ok: false,
        code: 'UNDER_REVIEW',
        message: 'This cover is already under review. Please check back in 6–12 hours.',
      }, 409);
    }

    // Check for fan-cover near-duplicate (exact + hamming ≤ 6, service-role client)
    const fanMatchId = await findFanMatch(phash);
    if (fanMatchId) {
      moderationStatus = 'under_review';
      moderationReason = 'Matches an existing fan cover';
      matchedCoverId = fanMatchId;
    }

    // Check for official cover match (only if not already flagged)
    if (moderationStatus === 'approved') {
      const officialId = await findOfficialMatch(phash);
      if (officialId) {
        moderationStatus = 'under_review';
        moderationReason = 'Matches an official cover';
        matchedOfficialId = officialId;
      }
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
      is_public: moderationStatus === 'approved',
      moderation_status: moderationStatus,
      moderation_reason: moderationReason,
      matched_cover_id: matchedCoverId,
      matched_official_id: matchedOfficialId,
    })
    .select('id')
    .single();

  if (insertErr || !cover) {
    console.error('[upload-cover] DB insert error:', insertErr?.message);
    return json({ ok: false, message: `Database insert failed: ${insertErr?.message ?? 'unknown'}` }, 500);
  }

  // Notify uploader when their cover is placed under review
  if (moderationStatus === 'under_review') {
    sb.from('covers_cafe_notifications')
      .insert({
        user_id: userId,
        actor_user_id: null,
        type: 'cover_under_review',
        cover_id: cover.id,
        cover_title: title,
        cover_artist: artist,
        actor_name: 'Covers Cafe',
        actor_username: null,
        content: moderationReason,
        created_at: new Date().toISOString(),
      })
      .then(() => {}).catch(() => {});
  }

  // Award contributor achievement (fire-and-forget, errors ignored)
  sb.from('covers_cafe_achievements')
    .insert({ user_id: userId, type: 'contributor', reference_id: null, metadata: {}, awarded_at: new Date().toISOString() })
    .then(() => {}).catch(() => {});

  return json({ ok: true, cover_id: cover.id, status: moderationStatus }, 200);
};
