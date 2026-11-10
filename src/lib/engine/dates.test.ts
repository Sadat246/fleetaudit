import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, fmtDate, isIsoDate, todayIn } from './dates';

describe('isIsoDate', () => {
  it('accepts real dates, including leap days', () => {
    expect(isIsoDate('2026-11-05')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });
  it('rejects impossible or badly formatted dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('03/15/2027')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
  it('crosses year boundaries both ways', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2027-01-15', -24)).toBe('2025-01-15');
  });
});

describe('diffDays and addDays', () => {
  it('counts whole days across a daylight-saving change', () => {
    expect(diffDays('2026-03-09', '2026-03-07')).toBe(2);
  });
  it('addDays then diffDays returns the same number', () => {
    for (let n = -800; n <= 800; n += 37) {
      expect(diffDays(addDays('2026-11-05', n), '2026-11-05')).toBe(n);
    }
  });
});

describe('todayIn', () => {
  it('gives the local date for a time zone, not the UTC date', () => {
    const lateEveningInCalifornia = new Date('2026-11-06T03:00:00Z');
    expect(todayIn('America/Los_Angeles', lateEveningInCalifornia)).toBe('2026-11-05');
    expect(todayIn('UTC', lateEveningInCalifornia)).toBe('2026-11-06');
  });
});

describe('fmtDate', () => {
  it('formats the same way on every machine', () => {
    expect(fmtDate('2027-03-05')).toBe('Mar 5, 2027');
    expect(fmtDate('')).toBe('—');
  });
});
