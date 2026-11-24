import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadScoredFleet, type Company } from '@/lib/db/fleet';
import { planReminders } from '@/lib/engine';
import { textUploadLink } from '@/lib/sms/text-driver';

export interface RunSummary {
  companies: number;
  planned: number;
  sent: number;
  test: number;
  failed: number;
  alreadySent: number;
  noPhone: number;
}

/** Postgres "unique violation": this reminder was already claimed. */
const UNIQUE_VIOLATION = '23505';

/**
 * The daily job: for every company, text each driver whose medical card or CDL
 * is entering the 60-, 30- or 7-day window. Uses the admin client (no user is
 * signed in), so every query is filtered by company.
 */
export async function runDailyReminders(admin: SupabaseClient, origin: string): Promise<RunSummary> {
  const sum: RunSummary = { companies: 0, planned: 0, sent: 0, test: 0, failed: 0, alreadySent: 0, noPhone: 0 };

  const { data: companies, error } = await admin.from('companies').select('id, name, time_zone');
  if (error) throw error;

  for (const c of companies) {
    sum.companies++;
    const company: Company = { id: c.id, name: c.name, timeZone: c.time_zone };
    const { rows } = await loadScoredFleet(admin, company);
    const plan = planReminders(rows);
    sum.planned += plan.length;
    if (plan.length === 0) continue;

    const { data: flags } = await admin.from('drivers').select('id, sms_opt_out').eq('company_id', company.id);
    const optedOut = new Set((flags ?? []).filter((f) => f.sms_opt_out).map((f) => f.id));
    const drivers = new Map(rows.map((r) => [r.driver.id, r.driver]));

    for (const r of plan) {
      const driver = drivers.get(r.driverId)!;
      // No phone yet: don't use up this window, so adding a number later still sends it.
      if (!driver.phone || optedOut.has(driver.id)) {
        sum.noPhone++;
        continue;
      }

      // Claim the reminder first. The unique key makes a second claim fail,
      // so two runs at once can never text the same thing twice.
      const { data: claim, error: claimError } = await admin
        .from('reminders')
        .insert({ company_id: company.id, driver_id: driver.id, item_key: r.itemKey, due: r.due, threshold: r.threshold, status: 'skipped', detail: 'sending' })
        .select('id')
        .single();
      if (claimError?.code === UNIQUE_VIOLATION) {
        sum.alreadySent++;
        continue;
      }
      if (claimError) throw claimError;

      const outcome = await textUploadLink(admin, {
        company,
        driver: { id: driver.id, first: driver.first, phone: driver.phone, optedOut: false },
        docType: r.docType,
        origin,
        expires: r.due,
        days: r.days,
      });

      await admin
        .from('reminders')
        .update({
          status: outcome.status,
          detail: outcome.detail ?? null,
          link_id: 'linkId' in outcome ? outcome.linkId : null,
        })
        .eq('id', claim.id);

      if (outcome.status === 'sent') sum.sent++;
      else if (outcome.status === 'test') sum.test++;
      else sum.failed++;
    }
  }
  return sum;
}
