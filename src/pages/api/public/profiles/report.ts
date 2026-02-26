/**
 * POST /api/public/profiles/report
 * Submit a report against a user profile. Requires authentication.
 *
 * Required Supabase migration:
 *   CREATE TABLE IF NOT EXISTS covers_cafe_profile_reports (
 *     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     profile_id uuid NOT NULL REFERENCES covers_cafe_profiles(id) ON DELETE CASCADE,
 *     reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *     reason text NOT NULL,
 *     details text,
 *     created_at timestamptz NOT NULL DEFAULT now(),
 *     UNIQUE (profile_id, reporter_id)
 *   );
 */
import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../_supabase';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const getBearer = (request: Request) =>
  request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null;

const VALID_REASONS = [
  'Inappropriate username',
  'Inappropriate display name',
  'Inappropriate profile picture',
  'Inappropriate banner',
  'Inappropriate bio/content',
  'Inappropriate link',
  'Other',
] as const;

export const POST: APIRoute = async ({ request }) => {
  const supabase = getSupabaseServer();
  if (!supabase) return json({ error: 'Supabase is not configured' }, 500);

  const token = getBearer(request);
  if (!token) return json({ error: 'Authentication required' }, 401);

  const { data: userData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !userData.user) return json({ error: 'Authentication required' }, 401);

  let body: { profileId?: string; reason?: string; details?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { profileId, reason, details } = body;

  if (!profileId || !reason) return json({ error: 'profileId and reason are required' }, 400);
  if (!VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
    return json({ error: 'Invalid reason' }, 400);
  }

  // Prevent self-reporting
  const { data: profile } = await supabase
    .from('covers_cafe_profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile) return json({ error: 'Profile not found' }, 404);
  if (profile.id === userData.user.id) return json({ error: 'You cannot report your own profile' }, 400);

  const { error } = await supabase.from('covers_cafe_profile_reports').insert({
    profile_id: profileId,
    reporter_id: userData.user.id,
    reason,
    details: details || null,
  });

  if (error?.code === '23505') return json({ error: 'You have already reported this profile' }, 400);
  if (error) return json({ error: 'Failed to submit report' }, 500);

  return json({ success: true, message: 'Report submitted successfully' });
};
