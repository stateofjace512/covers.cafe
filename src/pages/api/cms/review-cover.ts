/**
 * POST /api/cms/review-cover
 * Operator-only. Approve or deny a cover that is under moderation review.
 *
 * Body (JSON):
 *   coverId  — id of the cover to review (required)
 *   decision — 'approve' | 'deny' (required)
 *   reason   — operator note shown to user on deny (optional)
 */
import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { isCfPath, cfImageIdFromPath, deleteFromCf } from '../../../lib/cloudflare';

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb, user: operator } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ ok: false, message: 'Invalid JSON body' }, 400);
  }

  const coverId = typeof body.coverId === 'string' ? body.coverId.trim() : null;
  const decision = body.decision === 'approve' || body.decision === 'deny' ? body.decision : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : null;

  if (!coverId || !decision) {
    return json({ ok: false, message: 'coverId and decision (approve|deny) are required' }, 400);
  }

  // Load the cover (must be under_review)
  const { data: cover, error: loadErr } = await sb
    .from('covers_cafe_covers')
    .select('id, user_id, title, artist, storage_path, moderation_status')
    .eq('id', coverId)
    .maybeSingle();

  if (loadErr || !cover) return json({ ok: false, message: 'Cover not found' }, 404);
  if (cover.moderation_status !== 'under_review') {
    return json({ ok: false, message: 'Cover is not under review' }, 409);
  }

  const now = new Date().toISOString();

  if (decision === 'approve') {
    const { error: updateErr } = await sb
      .from('covers_cafe_covers')
      .update({
        moderation_status: 'approved',
        moderation_reason: reason ?? null,
        moderation_decided_at: now,
        moderation_decided_by: operator.id,
        is_public: true,
      })
      .eq('id', coverId);

    if (updateErr) return json({ ok: false, message: updateErr.message }, 500);

    // Notify uploader
    sb.from('covers_cafe_notifications')
      .insert({
        user_id: cover.user_id,
        actor_user_id: null,
        type: 'cover_approved',
        cover_id: cover.id,
        cover_title: cover.title,
        cover_artist: cover.artist,
        actor_name: 'Covers Cafe',
        actor_username: null,
        content: reason ?? null,
        created_at: now,
      })
      .then(() => {}).catch(() => {});

    return json({ ok: true, decision: 'approved' }, 200);
  }

  // decision === 'deny'
  const { error: updateErr } = await sb
    .from('covers_cafe_covers')
    .update({
      moderation_status: 'denied',
      moderation_reason: reason ?? null,
      moderation_decided_at: now,
      moderation_decided_by: operator.id,
      is_public: false,
    })
    .eq('id', coverId);

  if (updateErr) return json({ ok: false, message: updateErr.message }, 500);

  // Delete from Cloudflare to avoid orphaned images
  if (isCfPath(cover.storage_path)) {
    deleteFromCf(cfImageIdFromPath(cover.storage_path)).catch((err) => {
      console.error('[cms/review-cover] CF delete error:', err);
    });
  }

  // Notify uploader
  sb.from('covers_cafe_notifications')
    .insert({
      user_id: cover.user_id,
      actor_user_id: null,
      type: 'cover_denied',
      cover_id: null,
      cover_title: cover.title,
      cover_artist: cover.artist,
      actor_name: 'Covers Cafe',
      actor_username: null,
      content: reason ?? 'Your cover did not meet our submission guidelines.',
      created_at: now,
    })
    .then(() => {}).catch(() => {});

  return json({ ok: true, decision: 'denied' }, 200);
};
