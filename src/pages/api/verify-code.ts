import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const POST: APIRoute = async ({ request }) => {
  // Require authenticated user (their JWT proves identity)
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const code = (body.code ?? '').trim();

  if (!email || !code) {
    return new Response('Email and code required', { status: 400 });
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // Validate the JWT and get the user
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // The token's email must match the email being verified
  if (userData.user.email?.toLowerCase() !== email) {
    return new Response('Email mismatch', { status: 403 });
  }

  const now = new Date().toISOString();

  // Find a valid, unused, unexpired code for this email
  const { data: codeRow, error: codeError } = await sb
    .from('covers_cafe_verification_codes')
    .select('id, code, expires_at, used')
    .eq('email', email)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError) {
    console.error('[verify-code] DB error:', codeError.message);
    return new Response('Server error', { status: 500 });
  }

  if (!codeRow) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Mark code as used
  await sb
    .from('covers_cafe_verification_codes')
    .update({ used: true })
    .eq('id', codeRow.id);

  // Mark the user's profile as verified
  const { error: updateError } = await sb
    .from('covers_cafe_profiles')
    .update({ email_verified: true })
    .eq('id', userData.user.id);

  if (updateError) {
    console.error('[verify-code] Profile update error:', updateError.message);
    return new Response('Failed to mark user verified', { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
