/**
 * POST /api/account/check-username
 * Public endpoint used by the registration form to validate a username
 * before creating an account. Checks format and DB uniqueness. Rate-limited by IP.
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { checkRateLimit } from '../../../lib/rateLimit';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress ?? 'unknown';

  // 20 checks per minute per IP to prevent probing
  if (!checkRateLimit(`check-username:${ip}`, 20, 60_000)) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'Too many requests. Please slow down.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let body: { username?: string };
  try {
    body = await request.json() as { username?: string };
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const username = (body.username ?? '').trim().toLowerCase();

  if (!username) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'Username is required.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (username.length < 3) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'Username must be at least 3 characters.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (username.length > 30) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'Username must be 30 characters or fewer.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'Username may only contain lowercase letters, numbers, and underscores.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sb = getSupabaseServer();
  if (!sb) {
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { data: existing } = await sb
    .from('covers_cafe_profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'This username is already in use. Try another one.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
