/**
 * POST /api/account/forgot-password
 * Sends a 6-digit password reset code to the provided email.
 * Always returns ok: true to avoid leaking whether an account exists.
 *
 * Body: { email: string }
 * Returns: { ok: true }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { sendMail, codeEmailHtml, codeEmailText } from '../_mailer';

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 3;
const recentRequests = new Map<string, number[]>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const times = (recentRequests.get(email) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (times.length >= RATE_MAX) return true;
  times.push(now);
  recentRequests.set(email, times);
  return false;
}

function generateCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, message: 'Valid email required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (isRateLimited(email)) {
    return new Response(JSON.stringify({ ok: false, message: 'Too many requests. Wait a few minutes.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // Silently succeed if no account exists — don't leak email existence
  const { data: profile } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  // Also try auth lookup via admin if profile email field isn't populated
  let userExists = !!profile;
  if (!userExists) {
    try {
      const { data: listData } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userExists = (listData?.users ?? []).some((u) => u.email?.toLowerCase() === email);
    } catch {
      // If admin API unavailable, proceed anyway (silently)
    }
  }

  if (!userExists) {
    // Don't reveal non-existence — return success silently
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 90-second cooldown to prevent duplicate sends
  const cooloffCutoff = new Date(Date.now() - 90 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const { data: recentCode } = await sb
    .from('covers_cafe_verification_codes')
    .select('id')
    .eq('email', email)
    .eq('used', false)
    .gt('expires_at', nowIso)
    .gt('created_at', cooloffCutoff)
    .limit(1)
    .maybeSingle();

  if (recentCode) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await sb
    .from('covers_cafe_verification_codes')
    .insert({ email, code, expires_at: expiresAt });

  if (insertError) {
    console.error('[forgot-password] DB insert error:', insertError.message);
    return new Response('Failed to create reset code', { status: 500 });
  }

  const result = await sendMail({
    to: email,
    subject: 'Reset your covers.cafe password',
    text: codeEmailText(code, 'reset your password'),
    html: codeEmailHtml(code, 'reset your password'),
  });

  if (!result.ok) {
    console.error('[forgot-password] SMTP error:', result.error);
    return new Response('Failed to send email', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
