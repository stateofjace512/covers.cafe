import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';
import { sendMail, codeEmailHtml, codeEmailText } from './_mailer';

// Rate limit: max 3 codes per email per 15 minutes
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
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response('Valid email required', { status: 400 });
  }

  if (isRateLimited(email)) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Too many requests. Wait a few minutes.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // DB-level cooldown: if a fresh unused code was sent in the last 90 seconds,
  // return success silently rather than firing another email. This prevents
  // auto-resends on page reload from spamming the user or burning Zoho rate limits.
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

  if (recentCode) {
    // A code was already sent very recently — silently succeed so the UI
    // moves to the verify step without sending a duplicate email.
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
    console.error('[send-verification] DB insert error:', insertError.message);
    return new Response('Failed to create verification code', { status: 500 });
  }

  const result = await sendMail({
    to: email,
    subject: 'Your covers.cafe verification code',
    text: codeEmailText(code),
    html: codeEmailHtml(code),
  });

  if (!result.ok) {
    console.error('[send-verification] SMTP error:', result.error);
    return new Response('Failed to send email', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
