import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { getSupabaseServer } from './_supabase';

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
    return new Response('Too many verification requests. Try again later.', { status: 429 });
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Store code in DB (service role bypasses RLS)
  const { error: insertError } = await sb
    .from('covers_cafe_verification_codes')
    .insert({ email, code, expires_at: expiresAt });

  if (insertError) {
    console.error('[send-verification] DB insert error:', insertError.message);
    return new Response('Failed to create verification code', { status: 500 });
  }

  // Send email via SMTP
  const smtpHost = import.meta.env.SMTP_HOST;
  const smtpPort = parseInt(import.meta.env.SMTP_PORT ?? '587', 10);
  const smtpUser = import.meta.env.SMTP_USER;
  const smtpPass = import.meta.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('[send-verification] SMTP env vars not configured');
    return new Response('Email service not configured', { status: 503 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"covers.cafe" <${smtpUser}>`,
      to: email,
      subject: 'Your covers.cafe verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes. Do not share it with anyone.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px;">
          <h2 style="color:#c05a1a;margin-bottom:8px;">covers.cafe</h2>
          <p style="margin-bottom:24px;color:#555;">Enter this code to verify your email address:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                      padding:16px;background:#f5f5f5;border-radius:8px;color:#111;margin-bottom:24px;">
            ${code}
          </div>
          <p style="color:#888;font-size:13px;">This code expires in 15 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[send-verification] SMTP error:', err);
    return new Response('Failed to send email', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
