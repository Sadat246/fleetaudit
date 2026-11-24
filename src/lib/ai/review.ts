// Turns what the AI read into a draft the person reviews, plus a list of
// things worth double-checking. Pure functions, so they're tested.

import { addMonths, isIsoDate, type DocType } from '../engine';
import type { Extraction } from './extract';

/** The form's starting values. Lists are comma-separated text so they're easy to edit. */
export interface Draft {
  type: DocType;
  issued: string;
  expires: string;
  cdlClass: string;
  endorsements: string;
  restrictions: string;
  examiner: string;
  nrcme: string;
  waivers: string;
  sigDriver: boolean;
  sigReviewer: boolean;
}

/** Which fields matter for each document type. Others are hidden and not saved. */
export const FIELDS: Record<DocType, (keyof Draft)[]> = {
  MEDICAL_EXAMINER_CERTIFICATE: ['issued', 'expires', 'examiner', 'nrcme', 'waivers', 'sigDriver', 'sigReviewer'],
  COMMERCIAL_DRIVERS_LICENSE: ['issued', 'expires', 'cdlClass', 'endorsements', 'restrictions'],
  ANNUAL_DRIVING_RECORD_REVIEW: ['issued', 'sigReviewer'],
  MVR_REPORT: ['issued'],
  DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD: ['issued'],
  DRIVER_APPLICATION: ['issued', 'sigDriver'],
  UNKNOWN_OR_UNCORRELATED: ['issued', 'expires'],
};

export const ISSUED_LABEL: Record<DocType, string> = {
  MEDICAL_EXAMINER_CERTIFICATE: 'Exam date',
  COMMERCIAL_DRIVERS_LICENSE: 'Issue date',
  ANNUAL_DRIVING_RECORD_REVIEW: 'Review date',
  MVR_REPORT: 'Report date',
  DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD: 'Query date',
  DRIVER_APPLICATION: 'Date signed',
  UNKNOWN_OR_UNCORRELATED: 'Date',
};

const date = (v: string | null) => (v && isIsoDate(v) ? v : '');
const join = (v: string[]) => v.map((s) => s.trim()).filter(Boolean).join(', ');

export function toDraft(x: Extraction): Draft {
  return {
    type: x.type,
    issued: date(x.issued),
    expires: date(x.expires),
    cdlClass: (x.cdlClass ?? '').trim().toUpperCase(),
    endorsements: join(x.endorsements).toUpperCase(),
    restrictions: join(x.restrictions).toUpperCase(),
    examiner: (x.examiner ?? '').trim(),
    nrcme: (x.nrcme ?? '').replace(/\D/g, ''),
    waivers: join(x.waivers),
    sigDriver: x.sigDriver,
    sigReviewer: x.sigReviewer,
  };
}

/** Things the person should look at before saving. */
export function reviewChecks(x: Extraction, driver: { first: string; last: string }): string[] {
  const checks: string[] = [];
  const shown = new Set(FIELDS[x.type]);

  if (x.type === 'UNKNOWN_OR_UNCORRELATED') checks.push("The AI couldn't tell what kind of document this is. Choose the type.");

  if (x.driverName && !x.driverName.toLowerCase().includes(driver.last.toLowerCase())) {
    checks.push(`The document says "${x.driverName}", not ${driver.first} ${driver.last}. Check you picked the right driver.`);
  }

  if (x.issued && !isIsoDate(x.issued)) checks.push(`The ${ISSUED_LABEL[x.type].toLowerCase()} "${x.issued}" isn't a real date. Enter it by hand.`);
  if (shown.has('expires') && x.expires && !isIsoDate(x.expires)) checks.push(`The expiration date "${x.expires}" isn't a real date. Enter it by hand.`);
  if (!x.issued && x.type !== 'UNKNOWN_OR_UNCORRELATED') checks.push(`No ${ISSUED_LABEL[x.type].toLowerCase()} found.`);

  const issued = date(x.issued);
  const expires = date(x.expires);
  if (issued && expires && expires < issued) checks.push('The expiration date is before the issue date.');

  if (x.type === 'MEDICAL_EXAMINER_CERTIFICATE') {
    if (issued && expires && expires > addMonths(issued, 24)) checks.push('Expires more than 24 months after the exam. Medical certificates can last at most 24 months.');
    const digits = (x.nrcme ?? '').replace(/\D/g, '');
    if (digits.length !== 10) checks.push(`The examiner's registry number should have 10 digits${digits ? `; this one has ${digits.length}` : ''}.`);
    if (!x.sigReviewer) checks.push("The examiner's signature wasn't found.");
    if (!x.sigDriver) checks.push("The driver's signature wasn't found.");
  }
  if (x.type === 'ANNUAL_DRIVING_RECORD_REVIEW' && !x.sigReviewer) checks.push("The reviewer's signature wasn't found.");

  return checks;
}
