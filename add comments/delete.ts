/**
 * Delete Own Comment API
 * DELETE /api/public/comments/delete
 *
 * Allows users to delete their own comments (based on identity hash match)
 */

import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../../utils/core/supabaseClient.js';
import { computeIdentity } from '../../../../utils/comments/identityTracking.server';

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { commentId, sessionId, localStorageId } = body;

    if (!commentId) {
      return new Response(
        JSON.stringify({ error: 'commentId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Compute user's identity
    const identity = computeIdentity(request, sessionId, localStorageId);

    console.log('[Delete Comment] Identity check:', {
      commentId,
      requestIdentityHash: identity.identityHash.substring(0, 10) + '...',
      sessionId,
      localStorageId
    });

    const supabase = getSupabaseAdminClientFromContext({ request });

    // Get the comment to verify ownership
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select(
        'id, identity_hash, content, content_normalized, page_type, page_slug, parent_comment_id, session_id, local_storage_id, user_agent_hash, author_username, created_at, updated_at, edited_at'
      )
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      console.error('[Delete Comment] Comment not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Comment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Delete Comment] Ownership verification:', {
      commentIdentityHash: comment.identity_hash.substring(0, 10) + '...',
      requestIdentityHash: identity.identityHash.substring(0, 10) + '...',
      matches: comment.identity_hash === identity.identityHash
    });

    // Verify the comment belongs to this user
    if (comment.identity_hash !== identity.identityHash) {
      console.error('[Delete Comment] Identity mismatch - unauthorized');
      return new Response(
        JSON.stringify({ error: 'You can only delete your own comments' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    await supabase.from('comments_admin_archives').insert({
      comment_id: comment.id,
      page_type: comment.page_type,
      page_slug: comment.page_slug,
      content: comment.content,
      content_normalized: comment.content_normalized,
      parent_comment_id: comment.parent_comment_id,
      identity_hash: comment.identity_hash,
      session_id: comment.session_id,
      local_storage_id: comment.local_storage_id,
      user_agent_hash: comment.user_agent_hash,
      author_username: comment.author_username,
      action_type: 'deleted',
      is_deleted: true,
      done_by_admin: false,
      archived_at: now,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      edited_at: comment.edited_at,
    });

    // Mark as removed (soft delete)
    const { error: deleteError } = await supabase
      .from('comments')
      .update({
        is_admin_removed: true,
        updated_at: now,
      })
      .eq('id', commentId);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete comment' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in DELETE /api/public/comments/delete:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
