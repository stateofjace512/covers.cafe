import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const getBearer = (req: Request) =>
  req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? null;

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Supabase is not configured' }, 500);

  const token = getBearer(request);
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Authentication required' }, 401);

  // Operator check
  const { data: opRow } = await sb
    .from('covers_cafe_operator_roles')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .eq('role', 'operator')
    .maybeSingle();
  if (!opRow) return json({ error: 'Forbidden' }, 403);

  const body = await request.json() as {
    commentId: string;
    commentContent: string;
    authorUsername: string;
    authorUserId?: string | null;
    coverId?: string | null;
    coverTitle?: string | null;
    coverArtist?: string | null;
    coverStoragePath?: string | null;
    coverImageUrl?: string | null;
    pageType?: string | null;
    pageSlug?: string | null;
  };

  if (!body.commentId || !body.commentContent || !body.authorUsername) {
    return json({ error: 'commentId, commentContent, and authorUsername are required' }, 400);
  }

  // Check not already pinned
  const { data: existing } = await sb
    .from('covers_cafe_poh_pins')
    .select('id')
    .eq('comment_id', body.commentId)
    .maybeSingle();

  if (existing) return json({ error: 'Comment is already pinned to the POH' }, 409);

  const { data: pin, error: insertErr } = await sb
    .from('covers_cafe_poh_pins')
    .insert({
      comment_id:        body.commentId,
      comment_content:   body.commentContent,
      author_username:   body.authorUsername,
      author_user_id:    body.authorUserId ?? null,
      cover_id:          body.coverId ?? null,
      cover_title:       body.coverTitle ?? null,
      cover_artist:      body.coverArtist ?? null,
      cover_storage_path: body.coverStoragePath ?? null,
      cover_image_url:   body.coverImageUrl ?? null,
      page_type:         body.pageType ?? null,
      page_slug:         body.pageSlug ?? null,
      pinned_by:         userData.user.id,
    })
    .select('*')
    .single();

  if (insertErr || !pin) return json({ error: 'Failed to pin comment' }, 500);

  // Award POH achievement to author if they have a user account
  if (body.authorUserId) {
    await sb.from('covers_cafe_achievements').insert({
      user_id:      body.authorUserId,
      type:         'poh',
      reference_id: pin.id,
      metadata: {
        comment_preview: body.commentContent.slice(0, 120),
        cover_title:  body.coverTitle ?? null,
        cover_artist: body.coverArtist ?? null,
      },
      awarded_at: pin.pinned_at,
    }).select('id').maybeSingle(); // ignore conflict (unique constraint)
  }

  return json({ success: true, pin });
};
