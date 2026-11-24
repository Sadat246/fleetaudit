import { describe, expect, it } from 'vitest';
import type { IsoDate } from './dates';
import { dueWithin, fixFirst, scoreFleet } from './fleet';
import { buildSampleFleet } from './sample-fleet';

const TODAY = '2026-03-15' as IsoDate;
const { drivers, docs } = buildSampleFleet(TODAY);
const fleet = scoreFleet(drivers, docs, TODAY);

describe('scoreFleet', () => {
  it('counts every driver once, matching the sample fleet mix', () => {
    expect(fleet.counts).toEqual({ ok: 5, warn: 3, crit: 4, total: 12 });
  });

  it('puts the worst drivers first', () => {
    const statuses = fleet.rows.map((r) => r.result.status);
    expect(statuses.indexOf('ok')).toBeGreaterThan(statuses.lastIndexOf('crit'));
  });
});

describe('fixFirst', () => {
  const items = fixFirst(fleet.rows);

  it('lists only critical items', () => {
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((x) => x.item.status === 'crit')).toBe(true);
  });

  it('puts out-of-service risks before other problems', () => {
    const risks = items.map((x) => x.item.risk === 'Out of service');
    expect(risks.indexOf(false) === -1 || risks.lastIndexOf(true) < risks.indexOf(false)).toBe(true);
  });
});

describe('dueWithin', () => {
  const due = dueWithin(fleet.rows, 60);

  it('includes overdue items and items due within the window, soonest first', () => {
    const days = due.map((x) => x.item.days!);
    expect(days.every((d) => d <= 60)).toBe(true);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(days[0]).toBeLessThan(0); // Marcus Webb's medical card expired 12 days ago
  });

  it('leaves out missing documents', () => {
    expect(due.some((x) => x.item.missing)).toBe(false);
  });

  it('a shorter window never adds items', () => {
    expect(dueWithin(fleet.rows, 30).length).toBeLessThanOrEqual(due.length);
  });
});
