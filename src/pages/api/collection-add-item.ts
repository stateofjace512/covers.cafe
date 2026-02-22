import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server not configured', { status: 500 });
  const body = await request.json() as { collection_id: string; cover_id: string };
  const { error } = await getSupabaseServer().from('covers_cafe_collection_items').insert({
    collection_id: body.collection_id,
    cover_id: body.cover_id,
  });
  if (error) return new Response(JSON.stringify({ code: error.code, message: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
