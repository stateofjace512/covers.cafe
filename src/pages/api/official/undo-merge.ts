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

  const body = await request.json().catch(() => null) as {
    records?: { album_cover_url: string; artist_name: string }[];
    aliases?: string[];
  } | null;

  const records = Array.isArray(body?.records)
    ? body!.records.filter((r) => r.album_cover_url && r.artist_name)
    : [];

  if (!records.length) {
    return new Response('Missing records', { status: 400 });
  }

  // Restore each cover to its original artist_name by album_cover_url
  const errors: string[] = [];
  for (const record of records) {
    const { error } = await sb
      .from('covers_cafe_official_covers')
      .update({ artist_name: record.artist_name })
      .eq('album_cover_url', record.album_cover_url);
    if (error) errors.push(error.message);
  }

  if (errors.length) {
    return new Response(errors.join('; '), { status: 500 });
  }

  // Remove the alias entries that were created by the merge being undone.
  const aliases = Array.isArray(body?.aliases) ? body!.aliases.filter(Boolean) : [];
  if (aliases.length > 0) {
    await sb.from('covers_cafe_artist_aliases').delete().in('alias', aliases);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
