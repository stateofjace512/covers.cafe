import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const [, payload] = token.split('.');
    // Pad base64 to a multiple of 4 then decode
    const padded = payload + '=='.slice((payload.length + 3) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return {};
  }
}

export interface SessionInfo {
  id: string;
  created_at: string;
  updated_at: string;
  isCurrent: boolean;
}

/**
 * GET /api/account/sessions
 *
 * Returns all active sessions for the authenticated user via the GoTrue admin REST API.
 * Each session is annotated with `isCurrent: true` if it matches the token used to
 * make this request (identified by the `session_id` claim in the JWT payload).
 */
export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // Verify the requesting user's token
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  const userId = userData.user.id;

  // Determine current session ID by decoding the JWT payload
  const payload = parseJwtPayload(token);
  const currentSessionId = typeof payload.session_id === 'string' ? payload.session_id : null;

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ ok: false, message: 'Server misconfigured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}/sessions`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[sessions] GoTrue list-sessions error:', res.status, body);
    return new Response(
      JSON.stringify({ ok: false, message: 'Failed to fetch sessions.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const data = await res.json() as { sessions?: Array<Record<string, unknown>> };
  const sessions: SessionInfo[] = (data.sessions ?? []).map((s) => ({
    id: s.id as string,
    created_at: s.created_at as string,
    updated_at: s.updated_at as string,
    isCurrent: s.id === currentSessionId,
  }));

  // Put the current session first
  sessions.sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0));

  return new Response(JSON.stringify({ ok: true, sessions }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
