import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * A Supabase client with the secret key. It skips every access rule, so use it
 * only for work that has no signed-in user (the driver upload page, the daily
 * reminder job) and always filter by company yourself.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_SECRET_KEY. See .env.example.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
