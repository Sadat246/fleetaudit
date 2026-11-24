import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashToken, LINK_DAYS, linkState, looksLikeToken, newToken, type LinkState } from './token';

export type UploadDocType = 'MEDICAL_EXAMINER_CERTIFICATE' | 'COMMERCIAL_DRIVERS_LICENSE';

/** Creates a 7-day, single-use upload link and returns the token (only shown once). */
export async function createUploadLink(
  supabase: SupabaseClient,
  link: { companyId: string; driverId: string; docType: UploadDocType },
): Promise<{ id: string; token: string }> {
  const token = newToken();
  const expires = new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('upload_links')
    .insert({
      company_id: link.companyId,
      driver_id: link.driverId,
      doc_type: link.docType,
      token_hash: hashToken(token),
      expires_at: expires.toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id, token };
}

export interface FoundLink {
  id: string;
  companyId: string;
  driverId: string;
  docType: UploadDocType;
  driverFirst: string;
  companyName: string;
}

/** Looks up a link by its token. Needs the admin client: the driver isn't signed in. */
export async function findUploadLink(admin: SupabaseClient, token: string): Promise<{ state: LinkState | 'missing'; link?: FoundLink }> {
  if (!looksLikeToken(token)) return { state: 'missing' };

  const { data, error } = await admin
    .from('upload_links')
    .select('id, company_id, driver_id, doc_type, expires_at, used_at, drivers(first_name, companies(name))')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!data) return { state: 'missing' };

  const state = linkState(data, new Date());
  // Supabase returns the joined rows as objects for these many-to-one links.
  const driver = data.drivers as unknown as { first_name: string; companies: { name: string } | null } | null;
  const company = driver?.companies;
  return {
    state,
    link: {
      id: data.id,
      companyId: data.company_id,
      driverId: data.driver_id,
      docType: data.doc_type as UploadDocType,
      driverFirst: driver?.first_name ?? '',
      companyName: company?.name ?? 'your company',
    },
  };
}
