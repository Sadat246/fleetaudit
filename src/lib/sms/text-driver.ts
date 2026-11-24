import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IsoDate } from '@/lib/engine';
import { createUploadLink } from '@/lib/uploads/links';
import { uploadRequestText, type TextDocType } from './format';
import { sendSms, type SendResult } from './send';

export interface TextRequest {
  company: { id: string; name: string };
  driver: { id: string; first: string; phone: string | null; optedOut: boolean };
  docType: TextDocType;
  /** The site's address, for the link, e.g. https://fleetaudit-pearl.vercel.app */
  origin: string;
  expires?: IsoDate;
  days?: number;
}

export type TextOutcome = (SendResult & { body: string; linkId: string }) | { status: 'skipped'; detail: string };

/**
 * Makes a fresh upload link, texts it to the driver, and logs the message.
 * Works with the signed-in user's client or the admin client (daily job).
 */
export async function textUploadLink(supabase: SupabaseClient, req: TextRequest): Promise<TextOutcome> {
  if (!req.driver.phone) return { status: 'skipped', detail: 'No phone number on file.' };
  if (req.driver.optedOut) return { status: 'skipped', detail: 'The driver replied STOP to texts.' };

  const link = await createUploadLink(supabase, { companyId: req.company.id, driverId: req.driver.id, docType: req.docType });
  const body = uploadRequestText({
    company: req.company.name,
    first: req.driver.first,
    docType: req.docType,
    url: `${req.origin}/u/${link.token}`,
    expires: req.expires,
    days: req.days,
  });

  const result = await sendSms(req.driver.phone, body);

  const { error } = await supabase.from('messages').insert({
    company_id: req.company.id,
    driver_id: req.driver.id,
    to_phone: req.driver.phone,
    body,
    status: result.status,
    detail: result.detail ?? null,
    provider_id: result.providerId ?? null,
    link_id: link.id,
  });
  if (error) throw error;

  if (result.optedOut) {
    await supabase.from('drivers').update({ sms_opt_out: true }).eq('id', req.driver.id).eq('company_id', req.company.id);
  }
  return { ...result, body, linkId: link.id };
}
