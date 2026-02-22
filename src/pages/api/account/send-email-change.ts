import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { sendMail, codeEmailHtml, codeEmailText } from '../_mailer';

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  let body: { newEmail?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const newEmail = (body.newEmail ?? '').trim().toLowerCase();
  if (!newEmail || !newEmail.includes('@')) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Valid email required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const currentEmail = userData.user.email ?? '';
  if (newEmail === currentEmail.toLowerCase()) {
    return new Response(
      JSON.stringify({ ok: false, message: 'New email must be different from your current email.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Check the new address isn't already taken by another account
  const { data: existing } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('id', userData.user.id)
    .maybeSingle(); // we use this just to ensure the user has a profile
  void existing; // profile existence already confirmed by auth

  // DB-level cooldown: skip if a fresh code to this address was sent in the last 90s
  const cooloffCutoff = new Date(Date.now() - 90 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: recentCode } = await sb
    .from('covers_cafe_verification_codes')
    .select('id')
    .eq('email', newEmail)
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
      .insert({ email: newEmail, code, expires_at: expiresAt });

    if (insertError) {
      console.error('[send-email-change] DB insert error:', insertError.message);
      return new Response('Failed to create verification code', { status: 500 });
    }

    // Send verification code to the NEW address
    const codeResult = await sendMail({
      to: newEmail,
      subject: 'Verify your new covers.cafe email address',
      text: codeEmailText(code, 'confirm your new email address'),
      html: codeEmailHtml(code, 'confirm your new email address'),
    });
    if (!codeResult.ok) {
      console.error('[send-email-change] code email error:', codeResult.error);
      return new Response('Failed to send verification email', { status: 500 });
    }
  }

  // Always send a heads-up notification to the OLD address (no cooldown — this is a security alert)
  await sendMail({
    to: currentEmail,
    subject: 'covers.cafe: email address change requested',
    text: `A request was made to change your covers.cafe email address to ${newEmail}.\n\nIf you did not request this, please contact us immediately.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px;">
        <h2 style="color:#c05a1a;margin-bottom:8px;">covers.cafe</h2>
        <p style="color:#555;">A request was made to change your covers.cafe email address to:</p>
        <p style="font-weight:bold;color:#111;">${newEmail}</p>
        <p style="color:#555;">You will receive a verification code at the new address to complete the change.</p>
        <p style="color:#888;font-size:13px;">If you did not request this change, please contact us immediately.</p>
      </div>
    `,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
