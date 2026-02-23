import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ url }) => {
  const sb = getSupabaseServer();
  if (!sb) return json({ error: 'Supabase is not configured' }, 500);

  const artistSlug = url.searchParams.get('artist_slug');

  let query = sb
    .from('covers_cafe_official_covers')
    .select('*')
    .order('artist_name', { ascending: true })
    .order('release_year', { ascending: false });

  if (artistSlug) {
    query = query.eq('artist_slug', artistSlug);
  }

  const { data, error } = await query;
  if (error) return json({ error: 'Failed to fetch official covers' }, 500);

  return json({ covers: data ?? [] });
};
