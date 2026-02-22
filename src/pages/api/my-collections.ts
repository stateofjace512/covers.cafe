import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sb = getSupabaseServer();
  if (!sb) return new Response(JSON.stringify([]), { status: 200 });
  const ownerId = url.searchParams.get('owner_id');
  const { data } = await sb.from('covers_cafe_collections')
    .select('id,name,is_public')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  return new Response(JSON.stringify(data ?? []), { status: 200 });
};
