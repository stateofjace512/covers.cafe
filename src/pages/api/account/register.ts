/**
 * POST /api/account/register
 * Server-side registration endpoint. Replaces the direct client-side
 * supabase.auth.signUp() call so that username moderation and uniqueness
 * checks are enforced server-side and cannot be bypassed.
 *
 * Flow:
 *  1. Validate username format
 *  2. Check username is not already taken
 *  3. Run AI moderation on username (Anthropic Claude)
 *  4. Create the auth user via the admin API (email_confirm: true — we use
 *     our own OTP flow, not Supabase's confirmation email)
 *  5. Return { ok: true } so the client can call signInWithPassword to get a session
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { moderateUsername } from '../../../lib/moderation';
import { checkRateLimit } from '../../../lib/rateLimit';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress ?? 'unknown';

  // 10 registration attempts per hour per IP
  if (!checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Too many registration attempts. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: { username?: string; email?: string; password?: string };
  try {
    body = await request.json() as { username?: string; email?: string; password?: string };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const username = (body.username ?? '').trim().toLowerCase();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  // ── Basic validation ─────────────────────────────────────────────────────
  if (!email || !password) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Email and password are required.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!username) {
    return new Response(
      JSON.stringify({ ok: false, field: 'username', message: 'Username is required.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (username.length < 3) {
    return new Response(
      JSON.stringify({ ok: false, field: 'username', message: 'Username must be at least 3 characters.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (username.length > 30) {
    return new Response(
      JSON.stringify({ ok: false, field: 'username', message: 'Username must be 30 characters or fewer.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return new Response(
      JSON.stringify({
        ok: false,
        field: 'username',
        message: 'Username may only contain lowercase letters, numbers, and underscores.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (password.length < 6) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Password must be at least 6 characters.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) {
    return new Response('Server misconfigured', { status: 503 });
  }

  // ── Uniqueness check ─────────────────────────────────────────────────────
  const { data: existing } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ ok: false, field: 'username', message: 'That username is already taken.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── AI moderation (server-side — cannot be bypassed) ────────────────────
  try {
    const modResult = await moderateUsername(username);
    if (!modResult.ok) {
      return new Response(
        JSON.stringify({ ok: false, field: 'username', message: modResult.reason }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
  } catch (err) {
    // If moderation is down, block registration rather than letting it slip through
    return new Response(
      JSON.stringify({
        ok: false,
        message: err instanceof Error ? err.message : 'Moderation service unavailable. Please try again in a moment.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Create the user via admin API ────────────────────────────────────────
  // email_confirm: true — we use our own OTP flow, not Supabase's email link.
  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createError) {
    // Surface useful messages (e.g. "User already registered")
    const msg = createError.message ?? 'Registration failed.';
    return new Response(
      JSON.stringify({ ok: false, message: msg }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, userId: created.user.id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
