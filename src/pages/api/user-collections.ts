import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sb = getSupabaseServer();
  if (!sb) return new Response(JSON.stringify([]), { status: 200 });
  const username = decodeURIComponent(url.searchParams.get('username') ?? '');
  const { data: profile } = await getSupabaseServer().from('covers_cafe_profiles').select('id').eq('username', username).single();
  if (!profile) return new Response(JSON.stringify([]), { status: 200 });

  const { data } = await sb.from('covers_cafe_collections')
    .select('id,name,is_public,covers_cafe_collection_items(id)')
    .eq('owner_id', profile.id)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  const normalized = (data ?? []).map((row: { id: string; name: string; is_public: boolean; covers_cafe_collection_items?: { id: string }[] }) => ({
    id: row.id,
    name: row.name,
    is_public: row.is_public,
    item_count: row.covers_cafe_collection_items?.length ?? 0,
  }));

  return new Response(JSON.stringify(normalized), { status: 200 });
};
