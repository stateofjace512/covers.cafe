import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const { sb } = auth;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  let query = sb
    .from('covers_cafe_profiles')
    .select('id, username, display_name')
    .order('username')
    .limit(12);

  if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify(data ?? []), { status: 200 });
};
