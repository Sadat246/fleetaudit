import { describe, expect, it } from 'vitest';
import type { IsoDate } from './dates';
import { scoreFleet } from './fleet';
import { planReminders } from './reminders';
import { buildSampleFleet } from './sample-fleet';
import type { DqDocument, Driver } from './types';

const TODAY = '2026-03-15' as IsoDate;

/** One driver whose medical card expires in `days` days, everything else fine. */
function withMedicalIn(days: number) {
  const { drivers, docs } = buildSampleFleet(TODAY);
  const d: Driver = drivers[2]; // Tyrell Jackson: a clean file in the sample
  const mine: DqDocument[] = docs
    .filter((x) => x.driverId === d.id)
    .map((x) => (x.type === 'MEDICAL_EXAMINER_CERTIFICATE'
      ? { ...x, expires: new Date(Date.parse(TODAY) + days * 864e5).toISOString().slice(0, 10) as IsoDate }
      : x));
  return planReminders(scoreFleet([d], mine, TODAY).rows).filter((r) => r.itemKey === 'medical');
}

describe('planReminders', () => {
  it('nothing more than 60 days out', () => {
    expect(withMedicalIn(61)).toEqual([]);
  });

  it('picks the tightest window: 60, 30 or 7 days', () => {
    expect(withMedicalIn(60)[0].threshold).toBe(60);
    expect(withMedicalIn(45)[0].threshold).toBe(60);
    expect(withMedicalIn(30)[0].threshold).toBe(30);
    expect(withMedicalIn(8)[0].threshold).toBe(30);
    expect(withMedicalIn(7)[0].threshold).toBe(7);
    expect(withMedicalIn(0)[0].threshold).toBe(7);
  });

  it('overdue still counts as the 7-day window, so it is sent at most once more', () => {
    expect(withMedicalIn(-12)[0]).toMatchObject({ threshold: 7, days: -12 });
  });

  it('only texts about documents the driver renews (medical card, CDL)', () => {
    const { drivers, docs } = buildSampleFleet(TODAY);
    const plan = planReminders(scoreFleet(drivers, docs, TODAY).rows);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((r) => r.itemKey === 'medical' || r.itemKey === 'cdl')).toBe(true);
  });
});
