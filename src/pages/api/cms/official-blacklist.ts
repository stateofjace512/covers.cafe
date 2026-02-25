import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if (auth.error) return auth.error;
  const { sb } = auth;

  const [{ data: artists, error: artistErr }, { data: phrases, error: phraseErr }] = await Promise.all([
    sb.from('covers_cafe_official_artist_blacklist').select('artist_name, reason, created_at').order('artist_name'),
    sb.from('covers_cafe_official_phrase_blacklist').select('phrase, reason, created_at').order('phrase'),
  ]);

  if (artistErr || phraseErr) return new Response((artistErr ?? phraseErr)?.message ?? 'Failed to load blacklist', { status: 500 });

  return json({ artists: artists ?? [], phrases: phrases ?? [] });
};

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if (auth.error) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { type?: 'artist' | 'phrase'; value?: string; reason?: string | null } | null;
  const type = body?.type;
  const value = (body?.value ?? '').trim();
  const reason = (body?.reason ?? '').trim() || null;

  if (!type || !value) return new Response('type and value are required', { status: 400 });

  if (type === 'artist') {
    const { error } = await sb.from('covers_cafe_official_artist_blacklist').upsert({ artist_name: value, reason });
    if (error) return new Response(error.message, { status: 500 });
    return json({ ok: true });
  }

  const { error } = await sb.from('covers_cafe_official_phrase_blacklist').upsert({ phrase: value, reason });
  if (error) return new Response(error.message, { status: 500 });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if (auth.error) return auth.error;
  const { sb } = auth;

  const body = await request.json().catch(() => null) as { type?: 'artist' | 'phrase'; value?: string } | null;
  const type = body?.type;
  const value = (body?.value ?? '').trim();
  if (!type || !value) return new Response('type and value are required', { status: 400 });

  if (type === 'artist') {
    const { error } = await sb.from('covers_cafe_official_artist_blacklist').delete().eq('artist_name', value);
    if (error) return new Response(error.message, { status: 500 });
    return json({ ok: true });
  }

  const { error } = await sb.from('covers_cafe_official_phrase_blacklist').delete().eq('phrase', value);
  if (error) return new Response(error.message, { status: 500 });
  return json({ ok: true });
};
