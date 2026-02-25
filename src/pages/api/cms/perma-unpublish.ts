import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { coverId?: string; enabled?: boolean; reason?: string } | null;
  if (!body?.coverId || typeof body.enabled !== 'boolean') {
    return new Response('coverId and enabled are required', { status: 400 });
  }

  const patch = body.enabled
    ? { perma_unpublished: true, is_public: false }
    : { perma_unpublished: false };

  const { error } = await sb.from('covers_cafe_covers').update(patch).eq('id', body.coverId);
  if (error) return new Response(error.message, { status: 500 });

  // When enabling perma-unpublish, notify the cover owner
  if (body.enabled) {
    const adminSb = getSupabaseServer();
    if (adminSb) {
      const { data: cover } = await adminSb
        .from('covers_cafe_covers')
        .select('user_id, title, artist')
        .eq('id', body.coverId)
        .maybeSingle();

      if (cover?.user_id) {
        const reason = (typeof body.reason === 'string' && body.reason.trim())
          ? body.reason.trim()
          : 'DMCA/compliance';

        await adminSb.from('covers_cafe_notifications').insert({
          user_id: cover.user_id,
          actor_user_id: null,
          actor_identity_hash: null,
          type: 'cover_removed',
          cover_id: body.coverId,
          cover_title: cover.title ?? 'Untitled',
          cover_artist: cover.artist ?? '',
          actor_name: 'covers.cafe',
          actor_username: null,
          content: reason,
        });
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
