import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { evaluateDriver } from './evaluate';
import { buildSampleFleet } from './sample-fleet';
import type { DqDocument, Driver, ItemKey } from './types';

const TODAY = '2026-11-05';

// A driver whose file passes every check. Each test changes one thing.
const driver = (over: Partial<Driver> = {}): Driver => ({
  id: 'd1', first: 'Test', last: 'Driver', cdlClass: 'A',
  hireDate: '2024-01-10', inquiry: { done: true, date: '2024-01-20' }, ...over,
});

const goodDocs = (): DqDocument[] => [
  { id: 'app', driverId: 'd1', type: 'DRIVER_APPLICATION', issued: '2024-01-05', sigDriver: true },
  { id: 'mvr', driverId: 'd1', type: 'MVR_REPORT', issued: '2026-06-01' },
  { id: 'ann', driverId: 'd1', type: 'ANNUAL_DRIVING_RECORD_REVIEW', issued: '2026-06-01', sigReviewer: true },
  { id: 'med', driverId: 'd1', type: 'MEDICAL_EXAMINER_CERTIFICATE', issued: '2026-01-01', expires: '2027-06-01', sigDriver: true, sigReviewer: true, nrcme: '1234567890' },
  { id: 'cdl', driverId: 'd1', type: 'COMMERCIAL_DRIVERS_LICENSE', expires: '2029-01-01', cdlClass: 'A' },
  { id: 'clh', driverId: 'd1', type: 'DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD', issued: '2026-06-01' },
];

/** goodDocs with one document changed or removed. */
const withDoc = (id: string, change: Partial<DqDocument> | null) =>
  goodDocs().flatMap((d) => (d.id !== id ? [d] : change === null ? [] : [{ ...d, ...change }]));

const run = (docs: DqDocument[], dr: Driver = driver()) => evaluateDriver(dr, docs, TODAY);
const itemOf = (key: ItemKey, docs: DqDocument[], dr?: Driver) => run(docs, dr).items.find((i) => i.key === key)!;

describe('baseline', () => {
  it('a complete, current file is fully compliant', () => {
    const r = run(goodDocs());
    expect(r.status).toBe('ok');
    expect(r.oos).toBe(false);
    expect(r.items.every((i) => i.status === 'ok')).toBe(true);
  });
});

describe('medical certificate (§391.43)', () => {
  it('expired yesterday is critical and an out-of-service risk', () => {
    const r = run(withDoc('med', { expires: addDays(TODAY, -1) }));
    expect(r.items.find((i) => i.key === 'medical')!.status).toBe('crit');
    expect(r.oos).toBe(true);
  });
  it('expiring in 30 days is a warning; in 31 days is fine', () => {
    expect(itemOf('medical', withDoc('med', { expires: addDays(TODAY, 30) })).status).toBe('warn');
    expect(itemOf('medical', withDoc('med', { expires: addDays(TODAY, 31) })).status).toBe('ok');
  });
  it('valid for more than 24 months after the exam is critical', () => {
    expect(itemOf('medical', withDoc('med', { issued: '2026-01-01', expires: '2028-01-02' })).status).toBe('crit');
  });
  it('missing examiner signature is critical', () => {
    expect(itemOf('medical', withDoc('med', { sigReviewer: false })).status).toBe('crit');
  });
  it('registry number that is not 10 digits is a warning', () => {
    expect(itemOf('medical', withDoc('med', { nrcme: '123456789' })).status).toBe('warn');
  });
  it('no medical card at all is critical', () => {
    expect(itemOf('medical', withDoc('med', null)).status).toBe('crit');
  });
  it('a newer valid card beats an older expired one', () => {
    const docs = [...goodDocs(), { id: 'old', driverId: 'd1', type: 'MEDICAL_EXAMINER_CERTIFICATE' as const, issued: '2023-01-01', expires: '2025-01-01', sigDriver: true, sigReviewer: true, nrcme: '1234567890' }];
    expect(itemOf('medical', docs).status).toBe('ok');
  });
});

describe('30-day hire window (§391.23)', () => {
  const noMvr = () => withDoc('mvr', null);
  it('no MVR on day 30 after hire is a warning', () => {
    expect(itemOf('mvr', noMvr(), driver({ hireDate: addDays(TODAY, -30) })).status).toBe('warn');
  });
  it('no MVR on day 31 after hire is critical', () => {
    expect(itemOf('mvr', noMvr(), driver({ hireDate: addDays(TODAY, -31) })).status).toBe('crit');
  });
  it('inquiries not sent turn critical after day 30', () => {
    const notSent = { inquiry: { done: false } };
    expect(itemOf('inq', goodDocs(), driver({ ...notSent, hireDate: addDays(TODAY, -10) })).status).toBe('warn');
    expect(itemOf('inq', goodDocs(), driver({ ...notSent, hireDate: addDays(TODAY, -45) })).status).toBe('crit');
  });
});

describe('annual review (§391.25)', () => {
  it('is not due in the first year and does not hurt the overall status', () => {
    const r = run(withDoc('ann', null), driver({ hireDate: addDays(TODAY, -100) }));
    expect(r.items.find((i) => i.key === 'annual')!.status).toBe('na');
    expect(r.status).toBe('ok');
  });
  it('is critical when missing after the first year', () => {
    expect(itemOf('annual', withDoc('ann', null)).status).toBe('crit');
  });
  it('is due 12 months after the older of the review and the MVR', () => {
    const annual = itemOf('annual', withDoc('mvr', { issued: '2025-11-01' }));
    expect(annual.due).toBe('2026-11-01');
    expect(annual.status).toBe('crit');
  });
  it('missing reviewer signature is critical', () => {
    expect(itemOf('annual', withDoc('ann', { sigReviewer: false })).status).toBe('crit');
  });
});

describe('Clearinghouse (Part 382 Subpart G)', () => {
  it('a query more than 12 months old is critical and an out-of-service risk', () => {
    const r = run(withDoc('clh', { issued: '2025-11-04' }));
    expect(r.items.find((i) => i.key === 'clh')!.status).toBe('crit');
    expect(r.oos).toBe(true);
  });
});

describe('sample fleet', () => {
  it('scores the same way every time (update this snapshot only on purpose)', () => {
    const { drivers, docs } = buildSampleFleet(TODAY);
    const summary = drivers.map((d) => {
      const r = evaluateDriver(d, docs.filter((x) => x.driverId === d.id), TODAY);
      return `${d.first} ${d.last}: ${r.status}${r.oos ? ' (OOS risk)' : ''}`;
    });
    expect(summary).toMatchSnapshot();
  });
});
