import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  let body: { newEmail?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const newEmail = (body.newEmail ?? '').trim().toLowerCase();
  const code = (body.code ?? '').trim();

  if (!newEmail || !code) {
    return new Response(
      JSON.stringify({ ok: false, message: 'New email and code are required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const now = new Date().toISOString();

  // Find a valid unused unexpired code for the new email address
  const { data: codeRow, error: codeError } = await sb
    .from('covers_cafe_verification_codes')
    .select('id, code, expires_at, used')
    .eq('email', newEmail)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError) {
    console.error('[complete-email-change] DB error:', codeError.message);
    return new Response('Server error', { status: 500 });
  }

  if (!codeRow) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Invalid or expired code.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Mark code as used
  await sb.from('covers_cafe_verification_codes').update({ used: true }).eq('id', codeRow.id);

  // Update email in Supabase Auth using the admin API (requires service role)
  const { error: updateError } = await sb.auth.admin.updateUserById(userData.user.id, {
    email: newEmail,
    email_confirm: true,
  });

  if (updateError) {
    console.error('[complete-email-change] auth update error:', updateError.message);
    return new Response(
      JSON.stringify({ ok: false, message: 'Failed to update email. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
