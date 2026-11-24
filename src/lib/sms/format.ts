// Phone numbers and message wording for driver texts. Pure, so tested.

import { fmtDate, type IsoDate } from '../engine';

/**
 * Turns what someone typed into a US number in E.164 form (+15551234567),
 * or null if it isn't a 10-digit US number.
 */
export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return null;
  // US area codes and exchanges never start with 0 or 1.
  if (/^[01]/.test(ten) || /^[01]/.test(ten.slice(3))) return null;
  return `+1${ten}`;
}

/** +15551234567 → (555) 123-4567 */
export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

const DOC_WORDS = {
  MEDICAL_EXAMINER_CERTIFICATE: 'medical card',
  COMMERCIAL_DRIVERS_LICENSE: 'CDL',
} as const;

export type TextDocType = keyof typeof DOC_WORDS;

/**
 * The text a driver gets. Short, says who it's from, what's needed and by
 * when, and how to stop texts (required for business texting).
 */
export function uploadRequestText(p: {
  company: string;
  first: string;
  docType: TextDocType;
  url: string;
  /** When the current one expires, if this is a renewal reminder. */
  expires?: IsoDate;
  days?: number;
}): string {
  const what = DOC_WORDS[p.docType];
  let when = '';
  if (p.expires && p.days !== undefined) {
    when = p.days < 0 ? ` Your ${what} expired ${fmtDate(p.expires)}.`
      : p.days === 0 ? ` Your ${what} expires today.`
      : ` Your ${what} expires ${fmtDate(p.expires)} (${p.days} day${p.days === 1 ? '' : 's'}).`;
  }
  return `${p.company}: Hi ${p.first}.${when} Please send a photo of your ${p.days !== undefined ? 'new ' : ''}${what}: ${p.url} Reply STOP to opt out.`;
}
