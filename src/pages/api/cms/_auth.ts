import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '../_supabase';

export async function requireOperator(request: Request) {
  // Use the service-role client only for the auth.getUser() call (needs service role to validate JWTs)
  const adminSb = getSupabaseServer();
  if (!adminSb) return { error: new Response('Server misconfigured', { status: 500 }) };

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { error: new Response('Unauthorized', { status: 401 }) };

  const { data: userData, error: userError } = await adminSb.auth.getUser(token);
  if (userError || !userData.user) return { error: new Response('Unauthorized', { status: 401 }) };

  // Check staff role using service-role client (bypasses RLS — covers_cafe_operator_roles has no RLS)
  const { data: roleData, error: roleError } = await adminSb
    .from('covers_cafe_operator_roles')
    .select('user_id, role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (roleError || !roleData) return { error: new Response('Forbidden', { status: 403 }) };

  // Return an authenticated Supabase client using the operator's own JWT.
  // This ensures auth.uid() returns the operator's ID in all RLS policy checks,
  // so policies like covers_cafe_is_operator() evaluate correctly.
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_PUBLIC_KEY;

  const sb = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  return { sb, user: userData.user, role: roleData.role as 'operator' | 'moderator' | 'helper' };
}
