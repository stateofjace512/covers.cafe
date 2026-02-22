import type { APIRoute } from 'astro';
import { computeIdentity } from '../../../../lib/comments/identityTracking.server';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const identity = computeIdentity(request, body.sessionId, body.localStorageId);
  return new Response(JSON.stringify({ identityHash: identity.identityHash }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
