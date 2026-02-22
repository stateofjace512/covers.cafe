import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { createClient } from '@supabase/supabase-js';

/** Returns the Monday of the ISO week containing today. */
function weekMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  // Authenticate the user
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: userData, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !userData?.user) return new Response('Unauthorized', { status: 401 });
  const userId = userData.user.id;

  const body = await request.json().catch(() => null) as { coverId?: string } | null;
  if (!body?.coverId) return new Response('coverId is required', { status: 400 });

  // Get the current week's open poll
  const thisWeek = weekMonday();
  const { data: poll } = await sb
    .from('covers_cafe_acotw_polls')
    .select('id, closed_at')
    .eq('week_start', thisWeek)
    .is('closed_at', null)
    .maybeSingle();

  if (!poll) return new Response('No active poll this week', { status: 404 });

  // Verify cover is a nominee
  const { data: nominee } = await sb
    .from('covers_cafe_acotw_nominees')
    .select('id')
    .eq('poll_id', poll.id)
    .eq('cover_id', body.coverId)
    .maybeSingle();

  if (!nominee) return new Response('Cover is not a nominee this week', { status: 400 });

  // Upsert vote — user can change their vote
  const { error } = await sb
    .from('covers_cafe_acotw_votes')
    .upsert(
      { poll_id: poll.id, cover_id: body.coverId, user_id: userId },
      { onConflict: 'poll_id,user_id' }
    );

  if (error) return new Response(error.message, { status: 500 });

  // Return updated vote count for this cover
  const { count } = await sb
    .from('covers_cafe_acotw_votes')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', poll.id)
    .eq('cover_id', body.coverId);

  return new Response(JSON.stringify({ ok: true, vote_count: count ?? 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
