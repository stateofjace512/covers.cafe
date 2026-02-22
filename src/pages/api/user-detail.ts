import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sb = getSupabaseServer();
  if (!sb) return new Response(JSON.stringify([]), { status: 200 });
  const username = decodeURIComponent(url.searchParams.get('username') ?? '');
  const { data } = await getSupabaseServer().from('covers_cafe_profiles').select('*').eq('username', username).single();
  if (!data) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });

  const { count } = await sb.from('covers_cafe_covers').select('id', { count: 'exact', head: true })
    .eq('user_id', data.id).eq('is_public', true);

  return new Response(JSON.stringify({ profile: data, coverCount: count ?? 0 }), { status: 200 });
};
