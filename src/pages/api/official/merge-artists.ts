import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Supabase not configured', { status: 500 });

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: authData, error: authError } = await sb.auth.getUser(token);
  const userId = authData?.user?.id;
  if (authError || !userId) return new Response('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null) as { artistNames?: string[]; canonicalName?: string } | null;
  const artistNames = Array.isArray(body?.artistNames) ? body!.artistNames.filter(Boolean) : [];
  const canonicalName = typeof body?.canonicalName === 'string' ? body.canonicalName.trim() : '';

  if (!artistNames.length || !canonicalName) {
    return new Response('Missing artistNames or canonicalName', { status: 400 });
  }

  const { error: officialError } = await sb
    .from('covers_cafe_official_covers')
    .update({ artist_name: canonicalName })
    .in('artist_name', artistNames);

  if (officialError) return new Response(officialError.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
