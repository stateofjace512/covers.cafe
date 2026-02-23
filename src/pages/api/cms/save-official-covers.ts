import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

interface OfficialCoverInput {
  artist_name: string;
  artist_slug: string;
  album_title: string;
  release_year?: string | null;
  album_cover_url: string;
  pixel_dimensions?: string | null;
  country?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { covers?: OfficialCoverInput[] } | null;

  if (!body?.covers || !Array.isArray(body.covers) || body.covers.length === 0) {
    return json({ error: 'covers array is required and must not be empty' }, 400);
  }

  const rows = body.covers.map((c) => ({
    artist_name: String(c.artist_name ?? '').trim(),
    artist_slug: String(c.artist_slug ?? '').trim(),
    album_title: String(c.album_title ?? '').trim(),
    release_year: c.release_year ? String(c.release_year).trim() : null,
    album_cover_url: String(c.album_cover_url ?? '').trim(),
    pixel_dimensions: c.pixel_dimensions ? String(c.pixel_dimensions).trim() : null,
    country: String(c.country ?? 'us').trim(),
  })).filter((r) => r.artist_name && r.artist_slug && r.album_title && r.album_cover_url);

  if (rows.length === 0) {
    return json({ error: 'No valid covers after validation' }, 400);
  }

  const { error, count } = await sb
    .from('covers_cafe_official_covers')
    .upsert(rows, { onConflict: 'artist_slug,album_title', count: 'exact' });

  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, saved: count ?? rows.length });
};
