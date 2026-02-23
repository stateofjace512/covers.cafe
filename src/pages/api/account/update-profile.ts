/**
 * POST /api/account/update-profile
 * Authenticated endpoint. Updates display_name, bio, website, and/or avatar_url with:
 *  - AI content moderation for display_name and website (Anthropic Claude)
 *  - Rate limiting for display_name: max 5 changes per 30 days
 *    (stored in covers_cafe_profiles.display_name_change_log)
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { moderateDisplayName, moderateWebsite } from '../../../lib/moderation';

const DISPLAY_NAME_LIMIT = 5;
const DISPLAY_NAME_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface UpdateBody {
  display_name?: string | null;
  bio?: string | null;
  website?: string | null;
  avatar_url?: string | null;
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const userId = userData.user.id;

  let body: UpdateBody;
  try {
    body = await request.json() as UpdateBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Fetch current profile (we need the old values to detect changes and read the log)
  const { data: profile, error: profileError } = await sb
    .from('covers_cafe_profiles')
    .select('display_name, website, display_name_change_log')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Profile not found.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const updates: Record<string, string | null | string[]> = {};
  const now = Date.now();

  // ── Display name ────────────────────────────────────────────────────────
  if (body.display_name !== undefined) {
    const incoming = body.display_name?.trim() ?? null;
    const current = profile.display_name?.trim() ?? null;

    if (incoming !== current) {
      if (incoming && incoming.length > 0) {
        // Rate limit check
        const rawLog = profile.display_name_change_log;
        const log: string[] = Array.isArray(rawLog) ? rawLog : [];
        const recentChanges = log.filter((ts) => now - new Date(ts).getTime() < DISPLAY_NAME_WINDOW_MS);

        if (recentChanges.length >= DISPLAY_NAME_LIMIT) {
          const earliest = Math.min(...recentChanges.map((ts) => new Date(ts).getTime()));
          const nextAllowed = new Date(earliest + DISPLAY_NAME_WINDOW_MS);
          return new Response(
            JSON.stringify({
              ok: false,
              field: 'display_name',
              message: `You've used all ${DISPLAY_NAME_LIMIT} display name changes for this 30-day window. Next change available after ${nextAllowed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
              rateLimited: true,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        // AI moderation
        try {
          const modResult = await moderateDisplayName(incoming);
          if (!modResult.ok) {
            return new Response(
              JSON.stringify({ ok: false, field: 'display_name', message: modResult.reason }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }
        } catch (err) {
          return new Response(
            JSON.stringify({
              ok: false,
              message: err instanceof Error ? err.message : 'Moderation service unavailable.',
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          );
        }

        updates.display_name_change_log = [...recentChanges, new Date().toISOString()];
      }

      updates.display_name = incoming;
    }
  }

  // ── Website ──────────────────────────────────────────────────────────────
  if (body.website !== undefined) {
    const incoming = body.website?.trim() ?? null;
    const current = profile.website?.trim() ?? null;

    if (incoming !== current) {
      if (incoming && incoming.length > 0) {
        try {
          const modResult = await moderateWebsite(incoming);
          if (!modResult.ok) {
            return new Response(
              JSON.stringify({ ok: false, field: 'website', message: modResult.reason }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
          }
        } catch (err) {
          // Fail open: don't block the save if moderation is down
          console.error('[update-profile] Website moderation error:', err);
        }
      }
      updates.website = incoming;
    }
  }

  // ── Bio (no moderation) ──────────────────────────────────────────────────
  if (body.bio !== undefined) {
    updates.bio = body.bio?.trim() ?? null;
  }

  // ── Avatar URL (already uploaded to storage by client) ──────────────────
  if (body.avatar_url !== undefined) {
    updates.avatar_url = body.avatar_url;
  }

  if (Object.keys(updates).length === 0) {
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { error: updateError } = await sb
    .from('covers_cafe_profiles')
    .update(updates)
    .eq('id', userId);

  if (updateError) {
    // Graceful fallback if display_name_change_log column doesn't exist yet
    if (updateError.message?.includes('display_name_change_log')) {
      console.warn('[update-profile] display_name_change_log column missing — run migration. Falling back.');
      const { display_name_change_log: _dropped, ...safeUpdates } = updates;
      const { error: fallbackErr } = await sb
        .from('covers_cafe_profiles')
        .update(safeUpdates)
        .eq('id', userId);
      if (fallbackErr) {
        return new Response(
          JSON.stringify({ ok: false, message: 'Failed to update profile.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    } else {
      return new Response(
        JSON.stringify({ ok: false, message: 'Failed to update profile.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  // Return remaining display name changes so the UI can update
  let displayNameRemaining: number | undefined;
  if (updates.display_name !== undefined) {
    const rawLog = profile.display_name_change_log;
    const log: string[] = Array.isArray(rawLog) ? rawLog : [];
    const recentChanges = log.filter((ts) => now - new Date(ts).getTime() < DISPLAY_NAME_WINDOW_MS);
    displayNameRemaining = DISPLAY_NAME_LIMIT - recentChanges.length - 1;
  }

  return new Response(
    JSON.stringify({ ok: true, displayNameRemaining }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
