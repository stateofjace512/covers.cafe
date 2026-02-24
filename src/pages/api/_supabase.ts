import { createClient } from '@supabase/supabase-js';

/**
 * Create a server-side Supabase client.
 * If the service role key is set it bypasses RLS (no userJwt needed).
 * If only the anon key is available, pass the user's JWT so auth.uid()
 * is populated and RLS insert/update policies can match on user_id.
 */
export function getSupabaseServer(userJwt?: string) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_PUBLIC_KEY;
  if (!url || !key) return null;
  if (userJwt && !import.meta.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Anon key + user JWT: set Authorization header so RLS sees auth.uid()
    return createClient(url, key, { global: { headers: { Authorization: `Bearer ${userJwt}` } } });
  }
  return createClient(url, key);
}
