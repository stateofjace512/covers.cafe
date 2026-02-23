/**
 * POST /api/account/update-username
 * Authenticated endpoint. Changes the user's username with:
 *  - Format validation
 *  - Uniqueness check
 *  - AI content moderation (Anthropic Claude)
 *  - Rate limiting: max 2 changes per 14 days (stored in covers_cafe_profiles.username_change_log)
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { moderateUsername } from '../../../lib/moderation';

const USERNAME_LIMIT = 2;
const USERNAME_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const userId = userData.user.id;

  let body: { username?: string };
  try {
    body = await request.json() as { username?: string };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const newUsername = (body.username ?? '').trim().toLowerCase();

  // Format validation
  if (!newUsername || newUsername.length < 3) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Username must be at least 3 characters.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (newUsername.length > 30) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Username must be 30 characters or fewer.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!/^[a-z0-9_]+$/.test(newUsername)) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: 'Username may only contain lowercase letters, numbers, and underscores.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Fetch current profile
  const { data: profile, error: profileError } = await sb
    .from('covers_cafe_profiles')
    .select('username, username_change_log')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Profile not found.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // No-op if same username
  if (profile.username === newUsername) {
    return new Response(
      JSON.stringify({ ok: true, message: 'Username unchanged.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Rate limit check
  const now = Date.now();
  const rawLog = profile.username_change_log;
  const log: string[] = Array.isArray(rawLog) ? rawLog : [];
  const recentChanges = log.filter((ts) => now - new Date(ts).getTime() < USERNAME_WINDOW_MS);

  if (recentChanges.length >= USERNAME_LIMIT) {
    const earliest = Math.min(...recentChanges.map((ts) => new Date(ts).getTime()));
    const nextAllowed = new Date(earliest + USERNAME_WINDOW_MS);
    return new Response(
      JSON.stringify({
        ok: false,
        message: `You've used both username changes for this 14-day window. Next change available after ${nextAllowed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        rateLimited: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Uniqueness check
  const { data: existing } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('username', newUsername)
    .neq('id', userId)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ ok: false, message: 'That username is already taken.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // AI moderation
  try {
    const modResult = await moderateUsername(newUsername);
    if (!modResult.ok) {
      return new Response(
        JSON.stringify({ ok: false, message: modResult.reason }),
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

  // Apply the change
  const updatedLog = [...recentChanges, new Date().toISOString()];

  const { error: updateError } = await sb
    .from('covers_cafe_profiles')
    .update({ username: newUsername, username_change_log: updatedLog })
    .eq('id', userId);

  if (updateError) {
    // If the column doesn't exist yet (migration pending), fall back to username-only update
    if (updateError.message?.includes('username_change_log')) {
      console.warn('[update-username] username_change_log column missing — run migration. Falling back.');
      const { error: fallbackErr } = await sb
        .from('covers_cafe_profiles')
        .update({ username: newUsername })
        .eq('id', userId);
      if (fallbackErr) {
        return new Response(
          JSON.stringify({ ok: false, message: 'Failed to update username.' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }
    } else {
      return new Response(
        JSON.stringify({ ok: false, message: 'Failed to update username.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const remaining = USERNAME_LIMIT - recentChanges.length - 1;
  return new Response(
    JSON.stringify({
      ok: true,
      remaining,
      message: `Username updated. You have ${remaining} username change${remaining !== 1 ? 's' : ''} remaining in this 14-day window.`,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
