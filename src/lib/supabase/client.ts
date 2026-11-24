import { createBrowserClient } from '@supabase/ssr';

/** A Supabase client for the browser. Uses the same login cookie as the server. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
