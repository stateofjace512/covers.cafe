import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';
import { getSupabaseServer } from '../_supabase';

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const adminSb = getSupabaseServer();
  if (!adminSb) return new Response('Server misconfigured', { status: 503 });

  const body = await request.json().catch(() => null) as { reportId?: string } | null;
  const reportId = body?.reportId;
  if (!reportId) return new Response('reportId is required', { status: 400 });

  const { error } = await adminSb.from('covers_cafe_profile_reports').delete().eq('id', reportId);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
