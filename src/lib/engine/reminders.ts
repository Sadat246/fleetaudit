// Which drivers should get a renewal text today. Pure, like the rest of the engine.

import type { IsoDate } from './dates';
import type { FleetRow } from './fleet';

/** Days before expiry when we text the driver. */
export const THRESHOLDS = [60, 30, 7] as const;
export type Threshold = (typeof THRESHOLDS)[number];

/** Only documents the driver renews themselves; the office handles the rest. */
const DRIVER_ITEMS = {
  medical: 'MEDICAL_EXAMINER_CERTIFICATE',
  cdl: 'COMMERCIAL_DRIVERS_LICENSE',
} as const;

export interface PlannedReminder {
  driverId: string;
  itemKey: keyof typeof DRIVER_ITEMS;
  docType: (typeof DRIVER_ITEMS)[keyof typeof DRIVER_ITEMS];
  due: IsoDate;
  days: number;
  /** The tightest window the item is in: 60, 30 or 7 days. */
  threshold: Threshold;
}

/**
 * Every reminder that's due as of today. The caller sends each one at most
 * once (the reminders table has a unique key on driver, item, due date and
 * threshold), so running this daily, or twice in one day, or after missing a
 * day, all work out: each window gets one text.
 */
export function planReminders(rows: FleetRow[]): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const { driver, result } of rows) {
    for (const item of result.items) {
      if (!(item.key in DRIVER_ITEMS) || item.missing || item.days === null || item.due === null) continue;
      if (item.days > THRESHOLDS[0]) continue;
      // Overdue counts as the 7-day window: one last nudge, not a daily one.
      const threshold = [...THRESHOLDS].reverse().find((t) => item.days! <= t)!;
      const itemKey = item.key as keyof typeof DRIVER_ITEMS;
      out.push({ driverId: driver.id, itemKey, docType: DRIVER_ITEMS[itemKey], due: item.due, days: item.days, threshold });
    }
  }
  return out;
}
