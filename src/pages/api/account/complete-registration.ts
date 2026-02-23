/**
 * POST /api/account/complete-registration
 * Step 2 of registration. Verifies the OTP sent by register.ts, then creates
 * the account. The email is only stored in auth.users after verification passes.
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  let body: { username?: string; email?: string; password?: string; code?: string };
  try {
    body = await request.json() as { username?: string; email?: string; password?: string; code?: string };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const username = (body.username ?? '').trim().toLowerCase();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const code = (body.code ?? '').trim();

  if (!username || !email || !password || !code) {
    return new Response(
      JSON.stringify({ ok: false, message: 'All fields are required.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const now = new Date().toISOString();

  // ── Verify OTP ───────────────────────────────────────────────────────────
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
    console.error('[complete-registration] DB error:', codeError.message);
    return new Response('Server error', { status: 500 });
  }

  if (!codeRow) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Invalid or expired code. Please request a new one.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Mark code as used before creating account to prevent replay
  await sb.from('covers_cafe_verification_codes').update({ used: true }).eq('id', codeRow.id);

  // ── Re-check username uniqueness (race condition guard) ──────────────────
  const { data: existingUsername } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingUsername) {
    return new Response(
      JSON.stringify({ ok: false, field: 'username', message: 'That username was just taken. Please choose another.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Create the account — email is now verified ───────────────────────────
  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createError) {
    const msg = createError.message ?? 'Registration failed.';
    // If the email already exists it means they somehow got through twice — let them sign in
    if (msg.toLowerCase().includes('already')) {
      return new Response(
        JSON.stringify({ ok: false, message: 'An account with that email already exists. Try signing in.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({ ok: false, message: msg }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Mark the profile as verified immediately — the trigger creates it with email_verified=false,
  // and without this the auto-verify modal would fire again right after sign-in.
  await sb
    .from('covers_cafe_profiles')
    .update({ email_verified: true })
    .eq('id', created.user.id);

  // Account created with a verified email. Client will call signInWithPassword next.
  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
