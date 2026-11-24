'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { getMyCompany } from '@/lib/db/fleet';
import { normalizeUsPhone } from '@/lib/sms/format';
import { textUploadLink } from '@/lib/sms/text-driver';
import { createClient } from '@/lib/supabase/server';
import { createUploadLink } from '@/lib/uploads/links';

const DocType = z.enum(['MEDICAL_EXAMINER_CERTIFICATE', 'COMMERCIAL_DRIVERS_LICENSE']);

/** The signed-in user's company and one of its drivers, or an error message. */
async function companyDriver(driverId: string) {
  if (!z.uuid().safeParse(driverId).success) return { error: 'Driver not found.' } as const;
  const supabase = await createClient();
  const company = await getMyCompany(supabase);
  if (!company) return { error: 'Your session expired. Sign in again.' } as const;
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, first_name, phone, sms_opt_out')
    .eq('id', driverId)
    .eq('company_id', company.id)
    .maybeSingle();
  if (!driver) return { error: 'Driver not found.' } as const;
  return { supabase, company, driver };
}

async function siteOrigin() {
  const h = await headers();
  return h.get('origin') ?? `https://${h.get('host')}`;
}

/** Makes a new 7-day upload link for a driver and returns its URL (shown once). */
export async function createLinkForDriver(driverId: string, docType: string): Promise<{ url?: string; error?: string }> {
  const type = DocType.safeParse(docType);
  if (!type.success) return { error: 'Choose a document type.' };
  const ctx = await companyDriver(driverId);
  if ('error' in ctx) return { error: ctx.error };

  const { token } = await createUploadLink(ctx.supabase, { companyId: ctx.company.id, driverId, docType: type.data });
  return { url: `${await siteOrigin()}/u/${token}` };
}

/** Texts the driver a fresh upload link (or logs it, in test mode). */
export async function textLinkToDriver(driverId: string, docType: string): Promise<{ status?: string; detail?: string; body?: string; error?: string }> {
  const type = DocType.safeParse(docType);
  if (!type.success) return { error: 'Choose a document type.' };
  const ctx = await companyDriver(driverId);
  if ('error' in ctx) return { error: ctx.error };

  const outcome = await textUploadLink(ctx.supabase, {
    company: ctx.company,
    driver: { id: ctx.driver.id, first: ctx.driver.first_name, phone: ctx.driver.phone, optedOut: ctx.driver.sms_opt_out },
    docType: type.data,
    origin: await siteOrigin(),
  });
  revalidatePath(`/drivers/${driverId}`);
  if (outcome.status === 'skipped') return { error: outcome.detail };
  return { status: outcome.status, detail: outcome.detail, body: outcome.body };
}

export type PhoneState = { error?: string; saved?: boolean };

export async function savePhone(_prev: PhoneState, formData: FormData): Promise<PhoneState> {
  const driverId = String(formData.get('driverId') ?? '');
  const raw = String(formData.get('phone') ?? '').trim();
  const phone = raw === '' ? null : normalizeUsPhone(raw);
  if (raw !== '' && !phone) return { error: 'Enter a 10-digit US mobile number.' };

  const ctx = await companyDriver(driverId);
  if ('error' in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase.from('drivers').update({ phone }).eq('id', driverId).eq('company_id', ctx.company.id);
  if (error) return { error: `Saving failed: ${error.message}` };
  revalidatePath(`/drivers/${driverId}`);
  return { saved: true };
}

/** After a driver texts START to opt back in, the office clears the flag here. */
export async function allowTextsAgain(driverId: string) {
  const ctx = await companyDriver(driverId);
  if ('error' in ctx) return;
  await ctx.supabase.from('drivers').update({ sms_opt_out: false }).eq('id', driverId).eq('company_id', ctx.company.id);
  revalidatePath(`/drivers/${driverId}`);
}
