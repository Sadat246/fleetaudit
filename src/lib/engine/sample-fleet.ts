// A made-up 12-driver fleet. Dates are relative to "today", so the sample
// never goes stale and always shows a mix of compliant, warning and critical.

import { addDays, addMonths, type IsoDate } from './dates';
import type { DocType, DqDocument, Driver } from './types';

type Row = [
  first: string, last: string, state: string, cdlClass: string,
  hire: number, medicalExp: number | null, cdlExp: number | null,
  annual: number | null, mvr: number | null, clearinghouse: number | null,
  hasApplication: boolean, inquiriesDone: boolean, flag?: 'nosig',
];

// Numbers are days from today (negative = in the past).
const ROWS: Row[] = [
  ['Marcus', 'Webb', 'TX', 'A', -1400, -12, 640, -200, -200, -150, true, true],
  ['Denise', 'Alvarez', 'GA', 'A', -900, 21, 900, -340, -340, -300, true, true],
  ['Tyrell', 'Jackson', 'OH', 'A', -2100, 412, 1100, -120, -120, -90, true, true],
  ['Linda', 'Okafor', 'TN', 'B', -700, 180, 760, -60, -60, -60, true, true],
  ['Raymond', 'Pike', 'PA', 'A', -3000, 58, 30, -380, -380, -366, true, true],
  ['Sofia', 'Marchetti', 'IL', 'A', -500, 300, 820, -150, -150, -140, true, true, 'nosig'],
  ['Caleb', 'Nguyen', 'NC', 'A', -18, 500, 700, null, null, -17, true, false],
  ['Patricia', 'Holloway', 'IN', 'A', -1800, 9, 1300, -200, -200, -180, true, true],
  ['Omar', 'Haddad', 'MI', 'A', -1200, 560, 980, -45, -45, -45, true, true],
  ['Jerome', 'Baptiste', 'FL', 'A', -600, 610, 205, -90, -90, -80, true, true],
  ['Hannah', 'Lindqvist', 'MN', 'B', -300, null, 400, -100, -100, -90, true, true],
  ['Walt', 'Dreyer', 'WI', 'A', -2500, 330, 1500, -250, -250, -240, true, true],
];

export function buildSampleFleet(today: IsoDate): { drivers: Driver[]; docs: DqDocument[] } {
  const at = (n: number) => addDays(today, n);
  const drivers: Driver[] = [];
  const docs: DqDocument[] = [];

  ROWS.forEach((r, i) => {
    const [first, last, state, cls, hire, med, cdl, ann, mvr, clh, app, inq, flag] = r;
    const id = `sample-${i}`;
    drivers.push({
      id, first, last, cdlState: state, cdlClass: cls,
      cdlNumber: state + String(41000000 + i * 913277).slice(0, 8),
      hireDate: at(hire),
      inquiry: { done: inq, date: inq ? addDays(at(hire), 12) : undefined },
    });
    const add = (type: DocType, f: Partial<DqDocument>) =>
      docs.push({ id: `${id}-${type.slice(0, 3).toLowerCase()}`, driverId: id, type, sigDriver: true, sigReviewer: true, ...f });

    if (med != null) add('MEDICAL_EXAMINER_CERTIFICATE', {
      issued: addMonths(at(med), -24), expires: at(med), examiner: 'Dr. A. Rao',
      nrcme: '12345' + String(10000 + i * 7), sigReviewer: flag !== 'nosig',
    });
    if (cdl != null) add('COMMERCIAL_DRIVERS_LICENSE', {
      issued: addMonths(at(cdl), -48), expires: at(cdl), cdlClass: cls, endorsements: i % 3 === 0 ? ['T', 'N'] : ['T'],
    });
    if (ann != null) add('ANNUAL_DRIVING_RECORD_REVIEW', { issued: at(ann) });
    if (mvr != null) add('MVR_REPORT', { issued: at(mvr) });
    if (clh != null) add('DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD', { issued: at(clh) });
    if (app) add('DRIVER_APPLICATION', { issued: at(hire - 5) });
  });

  return { drivers, docs };
}
