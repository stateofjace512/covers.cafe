import type { APIRoute } from 'astro';
import { getSupabaseAdminClientFromContext } from '../../../../utils/core/supabaseClient.js';
import { validateAdminSession } from '../../../../utils/adminSession.js';
import { getEnvString } from '../../../../utils/env.server.js';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const session = await validateAdminSession(cookies);
  if (!session) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseKey =
    getEnvString('SUPABASE_SERVICE_ROLE_KEY') || getEnvString('SUPABASE_SECRET_KEY');
  if (!supabaseKey) {
    return jsonResponse({ error: 'Missing Supabase credentials.' }, 500);
  }

  const formData = await request.formData();
  const commentId = String(formData.get('commentId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!commentId) {
    return jsonResponse({ error: 'Missing commentId' }, 400);
  }

  const supabase = getSupabaseAdminClientFromContext(locals);

  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .select(
      'id, content, content_normalized, page_type, page_slug, parent_comment_id, identity_hash, session_id, local_storage_id, user_agent_hash, author_username, created_at, updated_at, edited_at'
    )
    .eq('id', commentId)
    .single();

  if (commentError || !comment) {
    return jsonResponse({ error: 'Comment not found.' }, 404);
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
    action_type: 'admin_removed',
    is_deleted: true,
    done_by_admin: true,
    done_by_admin_username: session.username,
    archived_reason: reason || null,
    archived_at: now,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    edited_at: comment.edited_at,
  });

  const { error: updateError } = await supabase
    .from('comments')
    .update({
      is_admin_removed: true,
      updated_at: now,
    })
    .eq('id', commentId);

  if (updateError) {
    console.error('Failed to remove comment:', updateError);
    return jsonResponse({ error: 'Failed to remove comment.' }, 500);
  }

  return new Response(null, {
    status: 303,
    headers: { location: '/cms/users' },
  });
};
