import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const GET: APIRoute = async () => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  // All closed polls that have a winner, most recent first
  const { data: polls } = await sb
    .from('covers_cafe_acotw_polls')
    .select('id, week_start, closed_at, winner_cover_id')
    .not('winner_cover_id', 'is', null)
    .not('closed_at', 'is', null)
    .order('week_start', { ascending: false });

  if (!polls || polls.length === 0) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch all winner cover details in one query
  const winnerIds = polls.map((p: { winner_cover_id: string }) => p.winner_cover_id);
  const { data: covers } = await sb
    .from('covers_cafe_covers')
    .select('*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url)')
    .in('id', winnerIds);

  const coverMap = new Map((covers ?? []).map((c: { id: string }) => [c.id, c]));

  // Fetch vote totals per poll
  const pollIds = polls.map((p: { id: string }) => p.id);
  const { data: votes } = await sb
    .from('covers_cafe_acotw_votes')
    .select('poll_id')
    .in('poll_id', pollIds);

  const voteTally: Record<string, number> = {};
  for (const v of votes ?? []) {
    voteTally[v.poll_id] = (voteTally[v.poll_id] ?? 0) + 1;
  }

  const history = polls.map((p: { id: string; week_start: string; closed_at: string; winner_cover_id: string }) => ({
    poll_id: p.id,
    week_start: p.week_start,
    closed_at: p.closed_at,
    total_votes: voteTally[p.id] ?? 0,
    cover: coverMap.get(p.winner_cover_id) ?? null,
  }));

  return new Response(JSON.stringify(history), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
