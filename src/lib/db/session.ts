import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMyCompany } from './fleet';

/**
 * For pages that need a signed-in user with a company.
 * Sends them to /login or to company setup otherwise.
 */
export async function requireCompany() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect('/login');

  const company = await getMyCompany(supabase);
  if (!company) redirect('/');

  return { supabase, company, email: data.claims.email };
}
