import { describe, expect, it } from 'vitest';
import type { IsoDate } from '../engine';
import { formatPhone, normalizeUsPhone, uploadRequestText } from './format';

describe('normalizeUsPhone', () => {
  it('accepts the ways people type US numbers', () => {
    for (const s of ['(555) 234-5678', '555-234-5678', '555.234.5678', '5552345678', '+1 555 234 5678', '1-555-234-5678']) {
      expect(normalizeUsPhone(s)).toBe('+15552345678');
    }
  });

  it('rejects numbers that are not 10-digit US numbers', () => {
    for (const s of ['', '234-5678', '555-234-56789', '+44 20 7946 0958', '055-234-5678', '555-034-5678']) {
      expect(normalizeUsPhone(s)).toBeNull();
    }
  });
});

describe('formatPhone', () => {
  it('shows a US number the familiar way', () => {
    expect(formatPhone('+15552345678')).toBe('(555) 234-5678');
  });
});

describe('uploadRequestText', () => {
  const base = { company: 'Acme Freight', first: 'Denise', url: 'https://x.test/u/abc' };

  it('a renewal reminder says what, when, where, and how to stop', () => {
    const t = uploadRequestText({ ...base, docType: 'MEDICAL_EXAMINER_CERTIFICATE', expires: '2026-12-24' as IsoDate, days: 30 });
    expect(t).toBe('Acme Freight: Hi Denise. Your medical card expires Dec 24, 2026 (30 days). Please send a photo of your new medical card: https://x.test/u/abc Reply STOP to opt out.');
  });

  it('handles expired and due-today', () => {
    expect(uploadRequestText({ ...base, docType: 'COMMERCIAL_DRIVERS_LICENSE', expires: '2026-11-01' as IsoDate, days: -5 })).toContain('Your CDL expired Nov 1, 2026.');
    expect(uploadRequestText({ ...base, docType: 'COMMERCIAL_DRIVERS_LICENSE', expires: '2026-11-24' as IsoDate, days: 0 })).toContain('expires today');
  });

  it('a plain request leaves out the date', () => {
    expect(uploadRequestText({ ...base, docType: 'COMMERCIAL_DRIVERS_LICENSE' })).toBe(
      'Acme Freight: Hi Denise. Please send a photo of your CDL: https://x.test/u/abc Reply STOP to opt out.',
    );
  });

  it('always fits in two text segments (320 characters) with a typical link', () => {
    const long = uploadRequestText({ ...base, company: 'Long Haul Transport & Logistics LLC', docType: 'MEDICAL_EXAMINER_CERTIFICATE', url: `https://fleetaudit-pearl.vercel.app/u/${'x'.repeat(43)}`, expires: '2026-12-24' as IsoDate, days: 30 });
    expect(long.length).toBeLessThanOrEqual(320);
  });
});
