import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async () => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Supabase is not configured' }, 500);

  const { data, error } = await sb
    .from('covers_cafe_poh_pins')
    .select('*')
    .order('pinned_at', { ascending: false });

  if (error) return json({ error: 'Failed to fetch POH pins' }, 500);

  return json({ pins: data ?? [] });
};
