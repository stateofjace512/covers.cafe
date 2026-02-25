import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function parseCoverSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/^\/covers\/fan\/([^/?#]+)/);
    return m?.[1] ?? null;
  } catch {
    const m = trimmed.match(/\/covers\/fan\/([^/?#]+)/);
    return m?.[1] ?? null;
  }
}

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await requireOperator(request);
  if (auth.error) return auth.error;
  const { sb } = auth;

  const input = url.searchParams.get('q') ?? '';
  const slug = parseCoverSlug(input);
  if (!slug) return new Response('Provide a fan cover URL or slug', { status: 400 });

  const { data: cover, error } = await sb
    .from('covers_cafe_covers')
    .select('id, page_slug, title, artist, user_id, created_at, is_public, is_private, profiles:covers_cafe_profiles(username, display_name)')
    .eq('page_slug', slug)
    .maybeSingle();

  if (error) return new Response(error.message, { status: 500 });
  if (!cover) return new Response('Cover not found', { status: 404 });

  const { data: nearby, error: nearbyErr } = await sb
    .from('covers_cafe_covers')
    .select('id, page_slug, title, artist, created_at, is_public, is_private')
    .eq('user_id', cover.user_id)
    .neq('id', cover.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (nearbyErr) return new Response(nearbyErr.message, { status: 500 });

  return json({ cover, nextByUser: nearby ?? [] });
};
