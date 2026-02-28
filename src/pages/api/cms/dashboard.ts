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

type ProfileReportRow = {
  id: string;
  reason: string;
  details: string | null;
  created_at: string;
  profile_id: string;
  reporter_id: string;
};

export const GET: APIRoute = async ({ request }) => {
  const auth = await requireOperator(request);
  if ('error' in auth) return auth.error;

  const { sb } = auth;

  const [{ data: reports }, { data: profileReports }, { data: bans }, { data: operators }, { count: reviewQueueCount }] = await Promise.all([
    sb
      .from('covers_cafe_reports')
      .select('id, reason, details, created_at, cover_id, reporter_id')
      .order('created_at', { ascending: false })
      .limit(200),
    sb
      .from('covers_cafe_profile_reports')
      .select('id, reason, details, created_at, profile_id, reporter_id')
      .order('created_at', { ascending: false })
      .limit(200),
    sb
      .from('covers_cafe_user_bans')
      .select('user_id, reason, banned_at, expires_at')
      .order('banned_at', { ascending: false }),
    sb
      .from('covers_cafe_operator_roles')
      .select('user_id, can_be_removed')
      .eq('role', 'operator'),
    sb
      .from('covers_cafe_covers')
      .select('id', { count: 'exact', head: true })
      .eq('moderation_status', 'under_review'),
  ]);

  const reportRows = (reports ?? []) as ReportRow[];
  const profileReportRows = (profileReports ?? []) as ProfileReportRow[];

  const ids = [
    ...new Set([
      ...reportRows.map((r) => r.reporter_id).filter(Boolean),
      ...profileReportRows.map((r) => r.reporter_id),
      ...profileReportRows.map((r) => r.profile_id),
      ...(bans ?? []).map((b: { user_id: string }) => b.user_id),
    ]),
  ] as string[];

  const { data: profiles } = ids.length
    ? await sb.from('covers_cafe_profiles').select('id, username').in('id', ids)
    : { data: [] };

  const { data: reportCovers } = reportRows.length
    ? await sb.from('covers_cafe_covers').select('id, title').in('id', [...new Set(reportRows.map((r) => r.cover_id))])
    : { data: [] };

  const usernameMap = new Map((profiles ?? []).map((p: { id: string; username: string | null }) => [p.id, p.username]));
  const coverMap = new Map((reportCovers ?? []).map((c: { id: string; title: string | null }) => [c.id, c.title]));

  return new Response(JSON.stringify({
    reports: reportRows.map((r) => ({
      ...r,
      cover_title: coverMap.get(r.cover_id) ?? null,
      reporter_username: r.reporter_id ? usernameMap.get(r.reporter_id) ?? null : null,
    })),
    profileReports: profileReportRows.map((r) => ({
      ...r,
      reported_username: usernameMap.get(r.profile_id) ?? null,
      reporter_username: usernameMap.get(r.reporter_id) ?? null,
    })),
    bans: (bans ?? []).map((b: { user_id: string; reason: string | null; banned_at: string; expires_at?: string | null }) => ({
      ...b,
      username: usernameMap.get(b.user_id) ?? null,
    })),
    operators: (operators ?? []).map((o: { user_id: string; can_be_removed: boolean }) => ({
      user_id: o.user_id,
      username: usernameMap.get(o.user_id) ?? null,
      can_be_removed: o.can_be_removed,
    })),
    reviewQueueCount: reviewQueueCount ?? 0,
  }), { status: 200 });
};
