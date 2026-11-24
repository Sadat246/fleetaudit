// Fleet-wide views built on evaluateDriver: who's worst, what to fix first,
// what's coming due. Pure functions, like the rest of the engine.

import type { IsoDate } from './dates';
import { evaluateDriver } from './evaluate';
import { STATUS_RANK, type ChecklistItem, type DqDocument, type Driver, type DriverResult } from './types';

export interface FleetRow {
  driver: Driver;
  result: DriverResult;
}

export interface FleetItem {
  driver: Driver;
  item: ChecklistItem;
}

/** Scores every driver, worst first (then by last name). */
export function scoreFleet(drivers: Driver[], docs: DqDocument[], today: IsoDate) {
  const rows: FleetRow[] = drivers
    .map((driver) => ({ driver, result: evaluateDriver(driver, docs.filter((d) => d.driverId === driver.id), today) }))
    .sort((a, b) => STATUS_RANK[b.result.status] - STATUS_RANK[a.result.status] || a.driver.last.localeCompare(b.driver.last));

  const counts = { ok: 0, warn: 0, crit: 0, total: rows.length };
  rows.forEach((r) => counts[r.result.status]++);
  return { rows, counts };
}

const all = (rows: FleetRow[]): FleetItem[] => rows.flatMap((r) => r.result.items.map((item) => ({ driver: r.driver, item })));
const byDays = (a: FleetItem, b: FleetItem) => (a.item.days ?? Infinity) - (b.item.days ?? Infinity);

/**
 * Critical items across the fleet, in the order to fix them: anything that can
 * put a driver out of service first, then the most overdue.
 */
export function fixFirst(rows: FleetRow[]): FleetItem[] {
  const oos = (x: FleetItem) => (x.item.risk === 'Out of service' ? 0 : 1);
  return all(rows)
    .filter((x) => x.item.status === 'crit')
    .sort((a, b) => oos(a) - oos(b) || byDays(a, b));
}

/** Items overdue or due within `days` days, soonest first. Missing documents aren't included. */
export function dueWithin(rows: FleetRow[], days: number): FleetItem[] {
  return all(rows)
    .filter((x) => !x.item.missing && x.item.days !== null && x.item.days <= days)
    .sort(byDays);
}
