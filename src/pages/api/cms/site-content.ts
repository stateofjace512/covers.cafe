import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

// GET /api/cms/site-content?key=about_body — public read
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return new Response('key param required', { status: 400 });

  const adminSb = getSupabaseServer();
  const { data, error } = await adminSb!
    .from('covers_cafe_site_content')
    .select('value, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (error) return new Response('DB error', { status: 500 });
  if (!data) return new Response(JSON.stringify({ value: null }), { headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};

// POST /api/cms/site-content — operator write
export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const body = await request.json() as { key?: string; value?: string };
  if (!body.key) return new Response('key is required', { status: 400 });
  if (body.value === undefined) return new Response('value is required', { status: 400 });

  const adminSb = getSupabaseServer();
  const { error } = await adminSb!
    .from('covers_cafe_site_content')
    .upsert({
      key: body.key,
      value: body.value,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    });

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
