import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

interface MirrorRow {
  artist_name?: string | null;
  album_title?: string | null;
  release_year?: number | null;
  album_cover_url?: string | null;
}

export const POST: APIRoute = async ({ request }) => {
  const sb = getSupabaseServer();
  if (!sb) return new Response('Supabase not configured', { status: 500 });

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return new Response('Unauthorized', { status: 401 });

  const { data: authData, error: authError } = await sb.auth.getUser(token);
  const userId = authData?.user?.id;
  if (authError || !userId) return new Response('Unauthorized', { status: 401 });

  const body = await request.json().catch(() => null) as { rows?: MirrorRow[] } | null;
  const rows = Array.isArray(body?.rows) ? body!.rows.slice(0, 50) : [];

  const normalized = rows
    .map((row) => ({
      artist: (row.artist_name ?? '').trim() || 'Unknown artist',
      title: (row.album_title ?? '').trim() || 'Unknown album',
      year: Number.isFinite(row.release_year) ? Number(row.release_year) : null,
      image_url: (row.album_cover_url ?? '').trim(),
    }))
    .filter((row) => Boolean(row.image_url));

  if (!normalized.length) {
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const imageUrls = Array.from(new Set(normalized.map((row) => row.image_url)));

  const { data: existing, error: existingError } = await sb
    .from('covers_cafe_covers')
    .select('id, public_id, image_url')
    .in('image_url', imageUrls)
    .contains('tags', ['official']);
  if (existingError) return new Response(existingError.message, { status: 500 });

  const existingSet = new Set((existing ?? []).map((row: { image_url: string }) => row.image_url));

  const inserts = normalized
    .filter((row) => !existingSet.has(row.image_url))
    .map((row) => ({
      user_id: userId,
      title: row.title,
      artist: row.artist,
      year: row.year,
      tags: ['official'],
      storage_path: '',
      image_url: row.image_url,
      is_public: true,
      is_private: false,
    }));

  if (inserts.length) {
    const { error: insertError } = await sb.from('covers_cafe_covers').insert(inserts);
    if (insertError) return new Response(insertError.message, { status: 500 });
  }

  const { data: mirrored, error: mirroredError } = await sb
    .from('covers_cafe_covers')
    .select('id, public_id, image_url')
    .in('image_url', imageUrls)
    .contains('tags', ['official'])
    .eq('is_public', true);
  if (mirroredError) return new Response(mirroredError.message, { status: 500 });

  return new Response(JSON.stringify({ data: mirrored ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
