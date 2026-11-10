import type { IsoDate } from './dates';

export const DOC_TYPES = [
  'MEDICAL_EXAMINER_CERTIFICATE',
  'COMMERCIAL_DRIVERS_LICENSE',
  'ANNUAL_DRIVING_RECORD_REVIEW',
  'MVR_REPORT',
  'DRUG_AND_ALCOHOL_CLEARINGHOUSE_RECORD',
  'DRIVER_APPLICATION',
  'UNKNOWN_OR_UNCORRELATED',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export interface Driver {
  id: string;
  first: string;
  last: string;
  cdlNumber?: string;
  cdlState?: string;
  cdlClass?: string;
  phone?: string;
  hireDate?: IsoDate;
  /** Past-employer inquiries (§391.23). */
  inquiry?: { done: boolean; date?: IsoDate };
}

export interface DqDocument {
  id: string;
  driverId: string;
  type: DocType;
  /** Exam date, issue date, review date, pull date or query date, depending on type. */
  issued?: IsoDate;
  expires?: IsoDate;
  cdlClass?: string;
  endorsements?: string[];
  restrictions?: string[];
  examiner?: string;
  nrcme?: string;
  waivers?: string[];
  sigDriver?: boolean;
  sigReviewer?: boolean;
  /** The AI flagged a regulatory problem with the document. */
  discrepancy?: boolean;
}

/** Ordered from best to worst; 'na' means not due yet. */
export type Status = 'na' | 'ok' | 'warn' | 'crit';

export const STATUS_RANK: Record<Status, number> = { na: 0, ok: 1, warn: 2, crit: 3 };

export type ItemKey = 'app' | 'inq' | 'mvr' | 'annual' | 'medical' | 'cdl' | 'clh';

export interface Issue {
  sev: 'warn' | 'crit';
  text: string;
}

export interface ChecklistItem {
  key: ItemKey;
  label: string;
  cite: string;
  risk: string;
  docType: DocType | null;
  status: Status;
  /** One-line summary, e.g. "Valid through Mar 5, 2027". */
  sum: string;
  issues: Issue[];
  /** Days until due; negative when overdue. Null when the item has no due date. */
  days: number | null;
  due: IsoDate | null;
  /** Id of the document this item was judged on. */
  doc: string | null;
  missing: boolean;
}

export interface DriverResult {
  items: ChecklistItem[];
  status: Exclude<Status, 'na'>;
  /** A critical problem on an item that can put the driver out of service. */
  oos: boolean;
  /** The item with the soonest due date. */
  next: ChecklistItem | null;
}
