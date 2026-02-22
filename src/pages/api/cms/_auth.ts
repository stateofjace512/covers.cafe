import { getSupabaseServer } from '../_supabase';

export async function requireOperator(request: Request) {
  const sb = getSupabaseServer();
  if (!sb) return { error: new Response('Server misconfigured', { status: 500 }) };

  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return { error: new Response('Unauthorized', { status: 401 }) };

  const { data: userData, error: userError } = await sb.auth.getUser(token);
  if (userError || !userData.user) return { error: new Response('Unauthorized', { status: 401 }) };

  const { data: roleData, error: roleError } = await sb
    .from('covers_cafe_operator_roles')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .eq('role', 'operator')
    .maybeSingle();

  if (roleError || !roleData) return { error: new Response('Forbidden', { status: 403 }) };

  return { sb, user: userData.user };
}
