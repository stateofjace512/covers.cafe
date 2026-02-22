import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_PUBLIC_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
