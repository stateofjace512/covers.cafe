/**
 * POST /api/public/comments/like
 * Toggles a like for the current anonymous identity.
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../../utils/core/supabaseClient.js';
import { computeIdentity } from '../../../../utils/comments/identityTracking.server';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { commentId, sessionId, localStorageId } = body || {};

    if (!commentId) {
      return jsonResponse({ error: 'commentId is required.' }, 400);
    }

    const identity = computeIdentity(request, sessionId, localStorageId);
    const supabase = getSupabaseAdminClientFromContext({ request });

    const { data: existingLike, error: existingError } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('identity_hash', identity.identityHash)
      .maybeSingle();

    if (existingError) {
      console.error('Error checking existing like:', existingError);
      return jsonResponse({ error: 'Failed to check like status.' }, 500);
    }

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('like_count')
      .eq('id', commentId)
      .single();

    if (commentError || !comment) {
      console.error('Error fetching comment for like:', commentError);
      return jsonResponse({ error: 'Comment not found.' }, 404);
    }

    const currentCount = comment.like_count ?? 0;

    if (existingLike) {
      const { error: deleteError } = await supabase
        .from('comment_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) {
        console.error('Error removing like:', deleteError);
        return jsonResponse({ error: 'Failed to remove like.' }, 500);
      }

      const nextCount = Math.max(0, currentCount - 1);
      await supabase
        .from('comments')
        .update({ like_count: nextCount })
        .eq('id', commentId);

      return jsonResponse({ success: true, liked: false, likeCount: nextCount });
    }

    const { error: insertError } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: commentId,
        identity_hash: identity.identityHash,
      });

    if (insertError) {
      console.error('Error adding like:', insertError);
      return jsonResponse({ error: 'Failed to add like.' }, 500);
    }

    const nextCount = currentCount + 1;
    await supabase
      .from('comments')
      .update({ like_count: nextCount })
      .eq('id', commentId);

    return jsonResponse({ success: true, liked: true, likeCount: nextCount });
  } catch (error) {
    console.error('Error in POST /api/public/comments/like:', error);
    return jsonResponse({ error: 'Internal server error.' }, 500);
  }
};
