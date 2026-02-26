/**
 * POST /api/account/reset-password
 * Verifies a password-reset OTP code then updates the user's password.
 *
 * Body: { email: string; code: string; newPassword: string }
 * Returns: { ok: true } | { ok: false; message: string }
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; code?: string; newPassword?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const code = (body.code ?? '').trim();
  const newPassword = body.newPassword ?? '';

  if (!email || !code || !newPassword) {
    return new Response(
      JSON.stringify({ ok: false, message: 'All fields are required.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (newPassword.length < 6) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Password must be at least 6 characters.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const now = new Date().toISOString();

  // Verify the OTP code
  const { data: codeRow, error: codeError } = await sb
    .from('covers_cafe_verification_codes')
    .select('id, used, expires_at')
    .eq('email', email)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError) {
    console.error('[reset-password] DB error:', codeError.message);
    return new Response('Server error', { status: 500 });
  }

  if (!codeRow) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Invalid or expired code. Please request a new one.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Mark code as used before updating password to prevent replay
  await sb.from('covers_cafe_verification_codes').update({ used: true }).eq('id', codeRow.id);

  // Find the user's auth ID by email
  const { data: listData } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = (listData?.users ?? []).find(
    (u: { email?: string }) => u.email?.toLowerCase() === email,
  );

  if (!authUser) {
    return new Response(
      JSON.stringify({ ok: false, message: 'No account found for that email.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Update the password via admin API
  const { error: updateError } = await sb.auth.admin.updateUserById(authUser.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error('[reset-password] update error:', updateError.message);
    return new Response(
      JSON.stringify({ ok: false, message: 'Failed to reset password. Please try again.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
