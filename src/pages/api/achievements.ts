import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Supabase is not configured' }, 500);

  const userId = url.searchParams.get('userId');
  if (!userId) return json({ error: 'userId is required' }, 400);

  const { data, error } = await sb
    .from('covers_cafe_achievements')
    .select('*')
    .eq('user_id', userId)
    .order('awarded_at', { ascending: false });

  if (error) return json({ error: 'Failed to fetch achievements' }, 500);

  return json({ achievements: data ?? [] });
};
