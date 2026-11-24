'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { FIELDS } from '@/lib/ai/review';
import { getMyCompany } from '@/lib/db/fleet';
import { DOC_TYPES, isIsoDate } from '@/lib/engine';
import { createClient } from '@/lib/supabase/server';

export type SaveState = { error?: string };

const optionalDate = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v === '' || isIsoDate(v), 'Enter dates as real calendar dates.')
  .transform((v) => v || null);
const text = z.string().transform((v) => v.trim() || null);
const list = z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const Form = z.object({
  driverId: z.uuid(),
  photo: z.string().min(1),
  type: z.enum(DOC_TYPES).refine((t) => t !== 'UNKNOWN_OR_UNCORRELATED', 'Choose what kind of document this is.'),
  issued: optionalDate,
  expires: optionalDate,
  cdlClass: text,
  endorsements: list,
  restrictions: list,
  examiner: text,
  nrcme: z.string().transform((v) => v.replace(/\D/g, '') || null),
  waivers: list,
  sigDriver: z.boolean(),
  sigReviewer: z.boolean(),
});

export async function saveDocument(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const str = (k: string) => String(formData.get(k) ?? '');
  const parsed = Form.safeParse({
    driverId: str('driverId'), photo: str('photo'), type: str('type'),
    issued: str('issued'), expires: str('expires'), cdlClass: str('cdlClass'),
    endorsements: str('endorsements'), restrictions: str('restrictions'),
    examiner: str('examiner'), nrcme: str('nrcme'), waivers: str('waivers'),
    sigDriver: formData.get('sigDriver') === 'on', sigReviewer: formData.get('sigReviewer') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;

  const supabase = await createClient();
  const company = await getMyCompany(supabase);
  if (!company) return { error: 'Your session expired. Sign in again.' };
  if (!f.photo.startsWith(`${company.id}/${f.driverId}/`)) return { error: "That photo doesn't belong to this driver." };

  // Only save the fields that apply to this type; the rest stay empty.
  const keep = new Set(FIELDS[f.type]);
  const pick = <T,>(k: (typeof FIELDS)[keyof typeof FIELDS][number], v: T, empty: T) => (keep.has(k) ? v : empty);

  const { error } = await supabase.from('documents').insert({
    company_id: company.id,
    driver_id: f.driverId,
    type: f.type,
    photo_path: f.photo,
    issued: f.issued,
    expires: pick('expires', f.expires, null),
    cdl_class: pick('cdlClass', f.cdlClass, null),
    endorsements: pick('endorsements', f.endorsements, []),
    restrictions: pick('restrictions', f.restrictions, []),
    examiner: pick('examiner', f.examiner, null),
    nrcme: pick('nrcme', f.nrcme, null),
    waivers: pick('waivers', f.waivers, []),
    // Types without a signature line count as signed, so they aren't flagged.
    sig_driver: pick('sigDriver', f.sigDriver, true),
    sig_reviewer: pick('sigReviewer', f.sigReviewer, true),
  });
  if (error) return { error: `Saving failed: ${error.message}` };

  redirect(`/drivers/${f.driverId}`);
}
