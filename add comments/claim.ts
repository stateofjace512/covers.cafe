/**
 * POST /api/public/comments/claim
 * Updates existing anonymous comments to use the authenticated user's display username.
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../../utils/core/supabaseClient.js';
import { computeIdentity } from '../../../../utils/comments/identityTracking.server';
import { validateUserSession } from '../../../../utils/userSession.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  try {
    const user = await validateUserSession(cookies, locals);

    if (!user) {
      return jsonResponse({ error: 'Authentication required.' }, 401);
    }

    const body = await request.json();
    const { sessionId, localStorageId } = body || {};

    const identity = computeIdentity(request, sessionId, localStorageId);
    const supabase = getSupabaseAdminClientFromContext({ request });
    const username = user.displayUsername;

    const { data, error } = await supabase
      .from('comments')
      .update({ author_username: username })
      .eq('identity_hash', identity.identityHash)
      .select('id');

    if (error) {
      console.error('Error syncing comment usernames:', error);
      return jsonResponse({ error: 'Failed to sync comment usernames.' }, 500);
    }

    return jsonResponse({ success: true, updatedCount: data?.length ?? 0 });
  } catch (error) {
    console.error('Error in POST /api/public/comments/claim:', error);
    return jsonResponse({ error: 'Internal server error.' }, 500);
  }
};
