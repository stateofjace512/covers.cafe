/**
 * POST /api/account/check-username
 * Public endpoint used by the registration form to validate a username
 * before creating an account. Rate-limited by IP.
 */
import type { APIRoute } from 'astro';
import { moderateUsername } from '../../../lib/moderation';
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

  try {
    const result = await moderateUsername(username);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: err instanceof Error ? err.message : 'Moderation service unavailable.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
