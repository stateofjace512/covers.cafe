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

  const [{ data: reports }, { data: published }, { data: bans }, { data: operators }] = await Promise.all([
    sb
      .from('covers_cafe_reports')
      .select('id, reason, details, created_at, cover_id, reporter_id')
      .order('created_at', { ascending: false })
      .limit(200),
    sb
      .from('covers_cafe_covers')
      .select('id, title, artist, created_at, is_public, is_private, is_acotw, user_id, storage_path')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(500),
    sb
      .from('covers_cafe_user_bans')
      .select('user_id, reason, banned_at, expires_at')
      .order('banned_at', { ascending: false }),
    sb
      .from('covers_cafe_operator_roles')
      .select('user_id, can_be_removed')
      .eq('role', 'operator'),
  ]);

  const reportRows = (reports ?? []) as ReportRow[];
  const publishedRows = (published ?? []) as {
    id: string; title: string; artist: string; created_at: string;
    is_public: boolean; is_private: boolean; is_acotw: boolean; user_id: string; storage_path: string;
  }[];

  const ids = [
    ...new Set([
      ...reportRows.map((r) => r.reporter_id).filter(Boolean),
      ...publishedRows.map((c) => c.user_id),
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
  const banMap = new Map((bans ?? []).map((b: { user_id: string; reason: string | null; banned_at: string; expires_at?: string | null }) => [b.user_id, b]));
  const operatorSet = new Set((operators ?? []).map((o: { user_id: string; can_be_removed: boolean }) => o.user_id));

  return new Response(JSON.stringify({
    reports: reportRows.map((r) => ({
      ...r,
      cover_title: coverMap.get(r.cover_id) ?? null,
      reporter_username: r.reporter_id ? usernameMap.get(r.reporter_id) ?? null : null,
    })),
    published: publishedRows.map((c) => ({
      ...c,
      username: usernameMap.get(c.user_id) ?? null,
      is_banned: banMap.has(c.user_id),
      is_operator: operatorSet.has(c.user_id),
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
  }), { status: 200 });
};
