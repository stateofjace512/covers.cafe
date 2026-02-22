import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';
import { createClient } from '@supabase/supabase-js';

/** Returns the Monday of the ISO week containing `date`. */
function weekMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export const GET: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server misconfigured', { status: 500 });

  const thisWeek = weekMonday(new Date());

  // ── 1. Check for an existing poll this week ──────────────────────────────
  let { data: poll } = await sb
    .from('covers_cafe_acotw_polls')
    .select('id, week_start, closed_at, winner_cover_id')
    .eq('week_start', thisWeek)
    .maybeSingle();

  // ── 2. If no poll yet, close last week's poll then open a new one ────────
  if (!poll) {
    // Close any open poll from a prior week (pick the nominee with most votes)
    const { data: openPolls } = await sb
      .from('covers_cafe_acotw_polls')
      .select('id')
      .is('closed_at', null)
      .lt('week_start', thisWeek);

    for (const old of openPolls ?? []) {
      // Count votes per nominee for this poll
      const { data: voteCounts } = await sb
        .from('covers_cafe_acotw_votes')
        .select('cover_id')
        .eq('poll_id', old.id);

      if (voteCounts && voteCounts.length > 0) {
        // Tally
        const tally: Record<string, number> = {};
        for (const v of voteCounts) {
          tally[v.cover_id] = (tally[v.cover_id] ?? 0) + 1;
        }
        const winnerId = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
        // Mark winner on cover and close the poll
        await sb.from('covers_cafe_covers').update({
          is_acotw: true,
          acotw_since: (openPolls as { id: string }[]).find((p) => p.id === old.id) ? thisWeek : null,
        }).eq('id', winnerId);
        await sb.from('covers_cafe_acotw_polls').update({
          winner_cover_id: winnerId,
          closed_at: new Date().toISOString(),
        }).eq('id', old.id);
      } else {
        // No votes — close with no winner
        await sb.from('covers_cafe_acotw_polls').update({
          closed_at: new Date().toISOString(),
        }).eq('id', old.id);
      }
    }

    // Pick top-10 public, non-ACOTW covers by favorite_count as nominees
    const { data: topCovers } = await sb
      .from('covers_cafe_covers')
      .select('id')
      .eq('is_public', true)
      .eq('is_acotw', false)
      .order('favorite_count', { ascending: false })
      .limit(10);

    if (!topCovers || topCovers.length === 0) {
      return new Response(JSON.stringify({ poll: null, nominees: [], user_vote: null, total_votes: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create the poll
    const { data: newPoll } = await sb
      .from('covers_cafe_acotw_polls')
      .insert({ week_start: thisWeek })
      .select('id, week_start, closed_at, winner_cover_id')
      .single();

    if (!newPoll) return new Response('Failed to create poll', { status: 500 });

    // Insert nominees
    await sb.from('covers_cafe_acotw_nominees').insert(
      topCovers.map((c: { id: string }) => ({ poll_id: newPoll.id, cover_id: c.id }))
    );

    poll = newPoll;
  }

  // ── 3. Fetch nominees + cover details ───────────────────────────────────
  const { data: nomineeRows } = await sb
    .from('covers_cafe_acotw_nominees')
    .select('cover_id, covers_cafe_covers(*, profiles:covers_cafe_profiles(id, username, display_name, avatar_url))')
    .eq('poll_id', poll.id);

  // ── 4. Fetch vote counts per nominee ───────────────────────────────────
  const { data: votes } = await sb
    .from('covers_cafe_acotw_votes')
    .select('cover_id')
    .eq('poll_id', poll.id);

  const voteTally: Record<string, number> = {};
  for (const v of votes ?? []) {
    voteTally[v.cover_id] = (voteTally[v.cover_id] ?? 0) + 1;
  }
  const totalVotes = (votes ?? []).length;

  // ── 5. Optionally resolve requesting user's vote ─────────────────────────
  let userVote: string | null = null;
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    const { data: userData } = await sb.auth.getUser(token);
    if (userData?.user) {
      const { data: myVote } = await sb
        .from('covers_cafe_acotw_votes')
        .select('cover_id')
        .eq('poll_id', poll.id)
        .eq('user_id', userData.user.id)
        .maybeSingle();
      userVote = myVote?.cover_id ?? null;
    }
  }

  // ── 6. Build response ────────────────────────────────────────────────────
  const nominees = (nomineeRows ?? [])
    .map((row: { cover_id: string; covers_cafe_covers: unknown }) => ({
      cover: row.covers_cafe_covers,
      vote_count: voteTally[row.cover_id] ?? 0,
    }))
    .sort((a: { vote_count: number }, b: { vote_count: number }) => b.vote_count - a.vote_count);

  return new Response(JSON.stringify({ poll, nominees, user_vote: userVote, total_votes: totalVotes }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
