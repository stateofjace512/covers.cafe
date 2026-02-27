/**
 * POST /api/account/register
 * Step 1 of registration. Validates the username and sends an OTP to the
 * provided email — but does NOT create the account yet. The account is only
 * created after the user proves they own the email in complete-registration.ts.
 */
import { randomInt } from 'node:crypto';
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { checkRateLimit } from '../../../lib/rateLimit';
import { sendMail, codeEmailHtml, codeEmailText } from '../_mailer';

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter.';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
  if (!/[@#$%^&*!?_\-+=~`|\\:;"'<>,.\/\[\]{}()]/.test(password)) return 'Password must contain at least one special character (@, #, $, etc.).';
  return null;
}

export const GET: APIRoute = () =>
  new Response(null, { status: 302, headers: { Location: '/' } });

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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ ok: false, message: 'A valid email is required.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return new Response(
      JSON.stringify({ ok: false, message: passwordError }),
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

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // ── Email uniqueness (check before sending OTP) ──────────────────────────
  // auth.admin.getUserByEmail doesn't exist in supabase-js v2.97+, so call
  // the GoTrue Admin REST API directly instead.
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (supabaseUrl && serviceKey) {
    try {
      const lookupRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1&query=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      );
      if (lookupRes.ok) {
        const { users } = await lookupRes.json() as { users?: Array<{ email: string }> };
        if (users?.some((u) => u.email === email)) {
          return new Response(
            JSON.stringify({ ok: false, message: 'An account with this email already exists.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
    } catch {
      // If the lookup fails, let step 2 catch the duplicate when creating the account
    }
  }

  // ── Username uniqueness ──────────────────────────────────────────────────
  const { data: existingUsername } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingUsername) {
    return new Response(
      JSON.stringify({ ok: false, field: 'username', message: 'This username is already in use. Try another one.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Send OTP to the email (account not created yet) ──────────────────────
  // 90-second cooldown to prevent spam
  const cooloffCutoff = new Date(Date.now() - 90 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: recentCode } = await sb
    .from('covers_cafe_verification_codes')
    .select('id')
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', now)
    .gt('created_at', cooloffCutoff)
    .limit(1)
    .maybeSingle();

  if (!recentCode) {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await sb
      .from('covers_cafe_verification_codes')
      .insert({ email, code, expires_at: expiresAt });

    if (insertError) {
      console.error('[register] OTP insert error:', insertError.message);
      return new Response(
        JSON.stringify({ ok: false, message: 'Failed to create verification code.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const mailResult = await sendMail({
      to: email,
      subject: 'Verify your covers.cafe email',
      text: codeEmailText(code, 'create your account'),
      html: codeEmailHtml(code, 'create your account'),
    });

    if (!mailResult.ok) {
      console.error('[register] mail error:', mailResult.error);
      return new Response(
        JSON.stringify({ ok: false, message: 'Failed to send verification email. Please check the address and try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
