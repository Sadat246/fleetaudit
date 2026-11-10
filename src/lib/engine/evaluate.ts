// The compliance engine: scores one driver's DQ file against the 7-item
// checklist. Pure function: no clock, no database, no network. "today" is
// always passed in, so results are repeatable and easy to test.

import { addDays, addMonths, diffDays, fmtDate, isIsoDate, type IsoDate } from './dates';
import {
  STATUS_RANK,
  type ChecklistItem,
  type DocType,
  type DqDocument,
  type Driver,
  type DriverResult,
  type ItemKey,
  type Status,
} from './types';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ago = (d: number) => (d === 0 ? 'today' : d < 0 ? `${plural(-d, 'day')} ago` : `in ${plural(d, 'day')}`);

/** Items that can put a driver out of service when critical. */
const OOS_KEYS: ItemKey[] = ['medical', 'cdl', 'clh'];

/** How many days after hire the inquiries and first MVR must be done (§391.23). */
const HIRE_WINDOW_DAYS = 30;

export function evaluateDriver(driver: Driver, docs: DqDocument[], today: IsoDate): DriverResult {
  // Latest document of a type: latest expiry first, then latest issue date.
  const latest = (type: DocType) =>
    docs
      .filter((d) => d.type === type)
      .sort((a, b) => (b.expires || b.issued || '').localeCompare(a.expires || a.issued || ''))[0] ?? null;

  const daysSinceHire = isIsoDate(driver.hireDate) ? diffDays(today, driver.hireDate) : null;
  const pastHireWindow = daysSinceHire != null && daysSinceHire > HIRE_WINDOW_DAYS;
  const items: ChecklistItem[] = [];

  const item = (key: ItemKey, label: string, cite: string, risk: string, docType: DocType | null) => {
    const o: ChecklistItem = { key, label, cite, risk, docType, status: 'ok', sum: '', issues: [], days: null, due: null, doc: null, missing: false };
    items.push(o);
    return o;
  };
  // Status only ever gets worse.
  const raise = (o: ChecklistItem, s: Status) => {
    if (STATUS_RANK[s] > STATUS_RANK[o.status]) o.status = s;
  };
  const flag = (o: ChecklistItem, s: 'warn' | 'crit', text: string) => {
    raise(o, s);
    o.issues.push({ sev: s, text });
  };
  const missing = (o: ChecklistItem, s: 'warn' | 'crit', text = 'Nothing on file yet') => {
    o.missing = true;
    o.sum = 'Not on file';
    flag(o, s, text);
  };
  // Turns a due date into a status: overdue = crit, within 30 days = warn.
  const timing = (o: ChecklistItem, due: IsoDate, words: [overdue: string, soon: string, fine: string]) => {
    o.due = due;
    o.days = diffDays(due, today);
    if (o.days < 0) {
      raise(o, 'crit');
      o.sum = `${words[0]} ${ago(o.days)}`;
    } else if (o.days <= 30) {
      raise(o, 'warn');
      o.sum = `${words[1]} ${o.days === 0 ? 'today' : ago(o.days)}`;
    } else {
      o.sum = `${words[2]} ${fmtDate(due)}`;
    }
  };

  // 1. Application for employment
  {
    const o = item('app', 'Application for employment', '§391.21', 'Audit violation', 'DRIVER_APPLICATION');
    const d = latest('DRIVER_APPLICATION');
    if (!d) missing(o, 'warn', 'Application not on file');
    else {
      o.doc = d.id;
      o.sum = 'On file' + (d.issued ? ' · ' + fmtDate(d.issued) : '');
      if (!d.sigDriver) flag(o, 'warn', 'Applicant signature not found');
    }
  }

  // 2. Past-employer inquiries (recorded on the driver, not a document)
  {
    const o = item('inq', 'Past-employer inquiries', '§391.23', 'Audit violation', null);
    if (driver.inquiry?.done) o.sum = 'Sent' + (driver.inquiry.date ? ' · ' + fmtDate(driver.inquiry.date) : '');
    else {
      o.missing = true;
      o.sum = 'Not recorded';
      flag(o, pastHireWindow ? 'crit' : 'warn', pastHireWindow ? 'Past the 30-day window after hire' : 'Send within 30 days of hire');
    }
  }

  // 3. Initial motor vehicle record
  {
    const o = item('mvr', 'Initial motor vehicle record', '§391.23', 'Audit violation', 'MVR_REPORT');
    const d = latest('MVR_REPORT');
    if (!d) missing(o, pastHireWindow ? 'crit' : 'warn', 'No MVR on file');
    else {
      o.doc = d.id;
      o.sum = 'Pulled ' + fmtDate(d.issued);
    }
  }

  // 4. Annual MVR review: due 12 months after the last review or the last MVR, whichever is sooner.
  {
    const o = item('annual', 'Annual MVR review', '§391.25', 'Conditional rating', 'ANNUAL_DRIVING_RECORD_REVIEW');
    const review = latest('ANNUAL_DRIVING_RECORD_REVIEW');
    const mvr = latest('MVR_REPORT');
    if (!review && daysSinceHire != null && daysSinceHire <= 365) {
      o.status = 'na';
      o.sum = 'Not due until ' + fmtDate(addDays(driver.hireDate!, 365));
    } else if (!review) missing(o, 'crit', 'No annual review on file');
    else {
      o.doc = review.id;
      let due: IsoDate | null = review.issued ? addMonths(review.issued, 12) : null;
      if (mvr?.issued) {
        const mvrDue = addMonths(mvr.issued, 12);
        if (!due || mvrDue < due) due = mvrDue;
      }
      if (due) timing(o, due, ['Overdue', 'Due', 'Current until']);
      else {
        raise(o, 'warn');
        o.sum = 'No review date found';
      }
      if (!review.sigReviewer) flag(o, 'crit', 'Reviewer signature or date not found');
    }
  }

  // 5. Medical examiner's certificate
  {
    const o = item('medical', 'Medical examiner’s certificate', '§391.43', 'Out of service', 'MEDICAL_EXAMINER_CERTIFICATE');
    const d = latest('MEDICAL_EXAMINER_CERTIFICATE');
    if (!d) missing(o, 'crit', 'No medical card on file');
    else {
      o.doc = d.id;
      if (d.expires) timing(o, d.expires, ['Expired', 'Expires', 'Valid through']);
      else {
        raise(o, 'warn');
        o.sum = 'No expiration date found';
      }
      if (!d.sigDriver) flag(o, 'crit', 'Driver signature not found');
      if (!d.sigReviewer) flag(o, 'crit', 'Examiner signature not found');
      if (d.discrepancy || (d.issued && d.expires && d.expires > addMonths(d.issued, 24)))
        flag(o, 'crit', 'Valid for more than 24 months. Check the form.');
      if (!d.nrcme || d.nrcme.replace(/\D/g, '').length !== 10)
        flag(o, 'warn', 'Examiner’s National Registry number not confirmed');
    }
  }

  // 6. Commercial driver's license
  {
    const o = item('cdl', 'Commercial driver’s license', 'Part 383', 'Out of service', 'COMMERCIAL_DRIVERS_LICENSE');
    const d = latest('COMMERCIAL_DRIVERS_LICENSE');
    if (!d) missing(o, 'crit', 'No CDL copy on file');
    else {
      o.doc = d.id;
      if (d.expires) timing(o, d.expires, ['Expired', 'Expires', 'Valid through']);
      else {
        raise(o, 'warn');
        o.sum = 'No expiration date found';
      }
      if (!d.cdlClass && !driver.cdlClass) flag(o, 'warn', 'License class not found');
    }
  }

  // 7. Clearinghouse query: at least once every 12 months.
  {
    const o = item('clh', 'FMCSA Clearinghouse query', 'Part 382 G', 'Critical defect', 'DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD');
    const d = latest('DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD');
    if (!d) missing(o, 'crit', 'No Clearinghouse query on file');
    else {
      o.doc = d.id;
      if (d.issued) timing(o, addMonths(d.issued, 12), ['Annual query overdue', 'Annual query due', 'Current until']);
      else {
        raise(o, 'warn');
        o.sum = 'No query date found';
      }
    }
  }

  const status = items.reduce<DriverResult['status']>(
    (worst, i) => (i.status !== 'na' && STATUS_RANK[i.status] > STATUS_RANK[worst] ? i.status : worst),
    'ok',
  );
  const oos = items.some((i) => i.status === 'crit' && OOS_KEYS.includes(i.key));
  const next = items.filter((i) => i.days != null).sort((a, b) => a.days! - b.days!)[0] ?? null;
  return { items, status, oos, next };
}
