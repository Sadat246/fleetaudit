// Date helpers. Every date is a 'YYYY-MM-DD' string, and all math is done in
// whole UTC days so time zones and daylight saving can't shift a result.

export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function isIsoDate(s: unknown): s is IsoDate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // Rejects dates like 2026-02-30 that JavaScript would quietly roll over.
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Days since 1970-01-01 (UTC). */
export function dayNum(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}

const fromDayNum = (n: number): IsoDate => {
  const t = new Date(n * 864e5);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
};

/** a minus b, in days. Positive when a is later. */
export const diffDays = (a: IsoDate, b: IsoDate): number => dayNum(a) - dayNum(b);

export const addDays = (iso: IsoDate, n: number): IsoDate => fromDayNum(dayNum(iso) + n);

/** Adds months, clamping to the last day of the month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: IsoDate, n: number): IsoDate {
  const [y, m, d] = iso.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay)));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Today's date in the given IANA time zone, e.g. 'America/Chicago'. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** 'Mar 5, 2027'. Fixed to en-US so output is the same on every machine. */
export function fmtDate(iso: IsoDate | null | undefined): string {
  if (!isIsoDate(iso)) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
