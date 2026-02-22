import type { APIRoute } from 'astro';
import { requireOperator } from './_auth';

type ReportRow = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  cover_id: string;
  reporter_id: string | null;
};

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const { sb } = auth;

  const { data: reports } = await sb
    .from('covers_cafe_reports')
    .select('id, reason, details, created_at, cover_id, reporter_id')
    .order('created_at', { ascending: false })
    .limit(200);

  const reportRows = (reports ?? []) as ReportRow[];
  const coverIds = [...new Set(reportRows.map((r) => r.cover_id))];
  const reporterIds = [...new Set(reportRows.map((r) => r.reporter_id).filter(Boolean))] as string[];

  const [{ data: covers }, { data: reporters }, { data: bans }] = await Promise.all([
    coverIds.length
      ? sb.from('covers_cafe_covers').select('id, title').in('id', coverIds)
      : Promise.resolve({ data: [] }),
    reporterIds.length
      ? sb.from('covers_cafe_profiles').select('id, username').in('id', reporterIds)
      : Promise.resolve({ data: [] }),
    sb.from('covers_cafe_user_bans').select('user_id, reason, banned_at, profiles:covers_cafe_profiles(username)').order('banned_at', { ascending: false }),
  ]);

  const coverMap = new Map((covers ?? []).map((c: { id: string; title: string | null }) => [c.id, c.title]));
  const reporterMap = new Map((reporters ?? []).map((p: { id: string; username: string | null }) => [p.id, p.username]));

  const normalizedBans = (bans ?? []).map((ban: { user_id: string; reason: string | null; banned_at: string; profiles?: { username: string | null } | null }) => ({
    user_id: ban.user_id,
    reason: ban.reason,
    banned_at: ban.banned_at,
    username: ban.profiles?.username ?? null,
  }));

  return new Response(JSON.stringify({
    reports: reportRows.map((r) => ({
      ...r,
      cover_title: coverMap.get(r.cover_id) ?? null,
      reporter_username: r.reporter_id ? reporterMap.get(r.reporter_id) ?? null : null,
    })),
    bans: normalizedBans,
  }), { status: 200 });
};
