import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

async function uniqueSlug(base: string, sb: ReturnType<typeof getSupabaseServer>, excludeId?: string): Promise<string> {
  let candidate = base || 'post';
  let n = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const slug = n === 0 ? candidate : `${candidate}-${n}`;
    const query = sb!
      .from('covers_cafe_blog_posts')
      .select('id')
      .eq('slug', slug);
    if (excludeId) query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    n++;
  }
}

// GET /api/cms/blog — list all posts (operator sees all; public only sees published)
export const GET: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const adminSb = getSupabaseServer();
  const { data, error } = await adminSb!
    .from('covers_cafe_blog_posts')
    .select('id, slug, title, body, author_username, published, published_at, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) return new Response('DB error', { status: 500 });
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST /api/cms/blog — create post
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const body = await request.json() as {
    title?: string;
    body?: string;
    published?: boolean;
  };

  const title = (body.title ?? '').trim();
  if (!title) return new Response('Title is required', { status: 400 });

  const adminSb = getSupabaseServer();
  const baseSlug = slugify(title);
  const slug = await uniqueSlug(baseSlug, adminSb);

  const { data: profile } = await adminSb!
    .from('covers_cafe_profiles')
    .select('username')
    .eq('id', auth.user.id)
    .maybeSingle();

  const published = body.published === true;

  const { data, error } = await adminSb!
    .from('covers_cafe_blog_posts')
    .insert({
      slug,
      title,
      body: (body.body ?? '').trim(),
      author_user_id: auth.user.id,
      author_username: profile?.username ?? null,
      published,
      published_at: published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};

// PUT /api/cms/blog — update post
export const PUT: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const body = await request.json() as {
    id?: string;
    title?: string;
    body?: string;
    published?: boolean;
  };

  if (!body.id) return new Response('Post ID is required', { status: 400 });

  const adminSb = getSupabaseServer();

  // Fetch existing post to check published_at
  const { data: existing } = await adminSb!
    .from('covers_cafe_blog_posts')
    .select('published, published_at, slug, title')
    .eq('id', body.id)
    .single();

  if (!existing) return new Response('Post not found', { status: 404 });

  const title = (body.title ?? existing.title).trim();
  const published = body.published === true;
  const wasPublished = existing.published;

  let newSlug = existing.slug;
  if (title !== existing.title) {
    newSlug = await uniqueSlug(slugify(title), adminSb, body.id);
  }

  const updates: Record<string, unknown> = {
    title,
    slug: newSlug,
    body: (body.body ?? '').trim(),
    published,
  };

  if (published && !wasPublished) {
    updates.published_at = new Date().toISOString();
  } else if (!published) {
    updates.published_at = null;
  } else {
    updates.published_at = existing.published_at;
  }

  const { data, error } = await adminSb!
    .from('covers_cafe_blog_posts')
    .update(updates)
    .eq('id', body.id)
    .select()
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// DELETE /api/cms/blog — delete post
export const DELETE: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const body = await request.json() as { id?: string };
  if (!body.id) return new Response('Post ID is required', { status: 400 });

  const adminSb = getSupabaseServer();
  const { error } = await adminSb!
    .from('covers_cafe_blog_posts')
    .delete()
    .eq('id', body.id);

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
