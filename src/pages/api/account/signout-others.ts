import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

/**
 * POST /api/account/signout-others
 *
 * Signs out all sessions for the authenticated user except the current one.
 * Uses the Supabase admin API (service role key) so it forcefully revokes
 * sessions at the database level — this invalidates both refresh tokens AND
 * marks access tokens as revoked, unlike the client-side signOut({ scope: 'others' })
 * which only invalidates refresh tokens and leaves existing access tokens valid
 * until their natural expiry (~1 hour).
 */
export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 503 });

  // Verify the requesting user's token is valid
  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401 });

  // Use admin API with service role key to forcefully revoke all other sessions.
  // scope: 'others' = terminate every session except the one identified by `token`.
  const { error } = await sb.auth.admin.signOut(token, 'others');

  if (error) {
    console.error('[signout-others] admin signOut error:', error.message);
    return new Response(
      JSON.stringify({ ok: false, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
