import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSampleFleet, type DqDocument, type Driver, type IsoDate } from '@/lib/engine';
import { documentFromRow, documentToRow, driverFromRow, driverToRow, type DocumentRow, type DriverRow } from './mappers';

export interface Company {
  id: string;
  name: string;
  timeZone: string;
}

/** The signed-in user's company, or null if they haven't made one yet. */
export async function getMyCompany(supabase: SupabaseClient): Promise<Company | null> {
  const { data, error } = await supabase.from('companies').select('id, name, time_zone').limit(1).maybeSingle();
  if (error) throw error;
  return data && { id: data.id, name: data.name, timeZone: data.time_zone };
}

/** Every driver and document for a company. Row-level security limits it to the user's own. */
export async function loadFleet(supabase: SupabaseClient, companyId: string): Promise<{ drivers: Driver[]; docs: DqDocument[] }> {
  const [drivers, docs] = await Promise.all([
    supabase.from('drivers').select('*').eq('company_id', companyId),
    supabase.from('documents').select('*').eq('company_id', companyId),
  ]);
  if (drivers.error) throw drivers.error;
  if (docs.error) throw docs.error;
  return {
    drivers: (drivers.data as DriverRow[]).map(driverFromRow),
    docs: (docs.data as DocumentRow[]).map(documentFromRow),
  };
}

/** Saves the 12-driver sample fleet into a company, with dates relative to today. */
export async function seedSampleFleet(supabase: SupabaseClient, companyId: string, today: IsoDate) {
  const sample = buildSampleFleet(today);

  // The sample uses ids like "sample-3"; the database wants UUIDs.
  const ids = new Map<string, string>();
  const newId = (old: string) => {
    if (!ids.has(old)) ids.set(old, crypto.randomUUID());
    return ids.get(old)!;
  };

  const drivers = sample.drivers.map((d) => driverToRow({ ...d, id: newId(d.id) }, companyId));
  const docs = sample.docs.map((d) => documentToRow({ ...d, id: crypto.randomUUID(), driverId: newId(d.driverId) }, companyId));

  const a = await supabase.from('drivers').insert(drivers);
  if (a.error) throw a.error;
  const b = await supabase.from('documents').insert(docs);
  if (b.error) throw b.error;
}
