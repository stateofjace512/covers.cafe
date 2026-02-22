import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const [, payload] = token.split('.');
    const padded = payload + '=='.slice((payload.length + 3) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

/**
 * POST /api/account/signout-session
 *
 * Signs out a specific session by ID for the authenticated user.
 * The current session cannot be signed out via this endpoint (use the
 * standard signOut for that).
 *
 * Body: { sessionId: string }
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // Verify the requesting user's token
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const userId = userData.user.id;

  // Parse request body
  let sessionId: string | undefined;
  try {
    const body = await request.json() as { sessionId?: string };
    sessionId = body.sessionId;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, message: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ ok: false, message: 'sessionId is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Prevent signing out the current session via this endpoint
  const payload = parseJwtPayload(token);
  const currentSessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
  if (currentSessionId && sessionId === currentSessionId) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Use the standard sign-out to end your current session.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Server misconfigured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const res = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${userId}/sessions/${sessionId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error('[signout-session] GoTrue delete-session error:', res.status, body);
    return new Response(
      JSON.stringify({ ok: false, message: 'Failed to sign out session.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
