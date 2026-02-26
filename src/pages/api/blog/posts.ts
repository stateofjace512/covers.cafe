import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../_supabase';

// GET /api/blog/posts — list published posts (public)
// GET /api/blog/posts?slug=my-post — single published post by slug
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  const adminSb = getSupabaseServer();

  if (slug) {
    const { data, error } = await adminSb!
      .from('covers_cafe_blog_posts')
      .select('id, slug, title, body, author_username, published_at, created_at')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();

    if (error) return new Response('DB error', { status: 500 });
    if (!data) return new Response('Not found', { status: 404 });
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  }

  const { data, error } = await adminSb!
    .from('covers_cafe_blog_posts')
    .select('id, slug, title, body, author_username, published_at, created_at')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (error) return new Response('DB error', { status: 500 });
  return new Response(JSON.stringify(data ?? []), { headers: { 'Content-Type': 'application/json' } });
};
