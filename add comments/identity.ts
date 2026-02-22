/**
 * Get Current User Identity
 * Returns the identity hash for the current user
 */

import type { APIRoute } from 'astro';
import { computeIdentity } from '../../../../utils/comments/identityTracking.server';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { sessionId, localStorageId } = body;

    const identity = computeIdentity(request, sessionId, localStorageId);

    console.log('[Identity API] Computed identity:', {
      identityHash: identity.identityHash.substring(0, 10) + '...',
      ipHash: identity.ipHash.substring(0, 10) + '...',
      userAgentHash: identity.userAgentHash.substring(0, 10) + '...',
      sessionId,
      localStorageId
    });

    return new Response(
      JSON.stringify({
        identityHash: identity.identityHash,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in POST /api/public/comments/identity:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
