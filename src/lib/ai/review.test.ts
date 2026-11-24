import { describe, expect, it } from 'vitest';
import type { Extraction } from './extract';
import { reviewChecks, toDraft } from './review';

const DRIVER = { first: 'Patricia', last: 'Holloway' };

// A clean medical certificate; each test breaks one thing.
const good: Extraction = {
  type: 'MEDICAL_EXAMINER_CERTIFICATE',
  driverName: 'Patricia Holloway',
  licenseNumber: 'IN47392939',
  licenseState: 'IN',
  issued: '2026-11-10',
  expires: '2028-11-10',
  cdlClass: null,
  endorsements: [],
  restrictions: [],
  examiner: 'Dr. Alan Brooks',
  nrcme: '9876543210',
  waivers: [],
  sigDriver: true,
  sigReviewer: true,
  notes: [],
};

describe('toDraft', () => {
  it('keeps valid dates and cleans up text', () => {
    const d = toDraft({ ...good, nrcme: '987-654-3210', endorsements: [' t', 'n '], type: 'COMMERCIAL_DRIVERS_LICENSE', cdlClass: 'a' });
    expect(d.issued).toBe('2026-11-10');
    expect(d.nrcme).toBe('9876543210');
    expect(d.endorsements).toBe('T, N');
    expect(d.cdlClass).toBe('A');
  });

  it('blanks out dates that are not real', () => {
    expect(toDraft({ ...good, issued: '2026-02-30', expires: '11/10/2028' })).toMatchObject({ issued: '', expires: '' });
  });
});

describe('reviewChecks', () => {
  it('a clean certificate needs no checks', () => {
    expect(reviewChecks(good, DRIVER)).toEqual([]);
  });

  it('flags a name that does not match the chosen driver', () => {
    expect(reviewChecks({ ...good, driverName: 'Omar Haddad' }, DRIVER)[0]).toMatch(/right driver/);
  });

  it('flags a certificate valid for more than 24 months', () => {
    expect(reviewChecks({ ...good, expires: '2028-11-11' }, DRIVER).join()).toMatch(/24 months/);
  });

  it('flags a short registry number and a missing examiner signature', () => {
    const checks = reviewChecks({ ...good, nrcme: '45678123', sigReviewer: false }, DRIVER).join();
    expect(checks).toMatch(/10 digits; this one has 8/);
    expect(checks).toMatch(/examiner's signature/);
  });

  it('flags unreadable dates and expiry before issue', () => {
    expect(reviewChecks({ ...good, issued: 'smudged' }, DRIVER).join()).toMatch(/isn't a real date/);
    expect(reviewChecks({ ...good, expires: '2026-01-01' }, DRIVER).join()).toMatch(/before the issue date/);
  });

  it('asks for a type when the AI could not tell', () => {
    expect(reviewChecks({ ...good, type: 'UNKNOWN_OR_UNCORRELATED' }, DRIVER)[0]).toMatch(/Choose the type/);
  });
});
