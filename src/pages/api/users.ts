import type { APIRoute } from 'astro';
import { getSupabaseServer } from './_supabase';

export const GET: APIRoute = async () => {
  const sb = getSupabaseServer();
  if (!sb) return new Response(JSON.stringify([]), { status: 200 });
  const { data } = await sb.from('covers_cafe_profiles')
    .select('*, covers_cafe_covers!inner(id)')
    .order('username');

  const map = new Map<string, unknown>();
  (data ?? []).forEach((row: { id: string; covers_cafe_covers?: { id: string }[] }) => {
    if (!map.has(row.id)) map.set(row.id, { ...row, cover_count: row.covers_cafe_covers?.length ?? 0 });
  });

  return new Response(JSON.stringify(Array.from(map.values())), { status: 200 });
};
