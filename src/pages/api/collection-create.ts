import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Server not configured', { status: 500 });
  const body = await request.json() as { owner_id: string; name: string; is_public: boolean };
  const { data, error } = await sb.from('covers_cafe_collections')
    .insert({ owner_id: body.owner_id, name: body.name, is_public: body.is_public })
    .select('id,name,is_public')
    .single();
  if (error) return new Response(error.message, { status: 400 });

  // Award first_collection and contributor achievements (fire-and-forget)
  if (body.owner_id) {
    const now = new Date().toISOString();
    Promise.all([
      sb.from('covers_cafe_achievements').insert({ user_id: body.owner_id, type: 'first_collection', reference_id: null, metadata: {}, awarded_at: now }),
      sb.from('covers_cafe_achievements').insert({ user_id: body.owner_id, type: 'contributor', reference_id: null, metadata: {}, awarded_at: now }),
    ]).catch(() => {});
  }

  return new Response(JSON.stringify(data), { status: 200 });
};
