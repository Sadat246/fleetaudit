// Converts between database rows (snake_case, nulls) and the engine's
// types (camelCase, optional fields). Pure functions, so they're tested.

import type { DocType, DqDocument, Driver, IsoDate } from '../engine';

export interface DriverRow {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  cdl_number: string | null;
  cdl_state: string | null;
  cdl_class: string | null;
  phone: string | null;
  hire_date: string | null;
  inquiry_done: boolean;
  inquiry_date: string | null;
}

export interface DocumentRow {
  id: string;
  company_id: string;
  driver_id: string;
  type: DocType;
  issued: string | null;
  expires: string | null;
  cdl_class: string | null;
  endorsements: string[];
  restrictions: string[];
  examiner: string | null;
  nrcme: string | null;
  waivers: string[];
  sig_driver: boolean;
  sig_reviewer: boolean;
  discrepancy: boolean;
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
const date = (v: string | null) => opt(v) as IsoDate | undefined;

export function driverFromRow(r: DriverRow): Driver {
  return {
    id: r.id,
    first: r.first_name,
    last: r.last_name,
    cdlNumber: opt(r.cdl_number),
    cdlState: opt(r.cdl_state),
    cdlClass: opt(r.cdl_class),
    phone: opt(r.phone),
    hireDate: date(r.hire_date),
    inquiry: { done: r.inquiry_done, date: date(r.inquiry_date) },
  };
}

export function driverToRow(d: Driver, companyId: string): DriverRow {
  return {
    id: d.id,
    company_id: companyId,
    first_name: d.first,
    last_name: d.last,
    cdl_number: d.cdlNumber ?? null,
    cdl_state: d.cdlState ?? null,
    cdl_class: d.cdlClass ?? null,
    phone: d.phone ?? null,
    hire_date: d.hireDate ?? null,
    inquiry_done: d.inquiry?.done ?? false,
    inquiry_date: d.inquiry?.date ?? null,
  };
}

export function documentFromRow(r: DocumentRow): DqDocument {
  return {
    id: r.id,
    driverId: r.driver_id,
    type: r.type,
    issued: date(r.issued),
    expires: date(r.expires),
    cdlClass: opt(r.cdl_class),
    endorsements: r.endorsements,
    restrictions: r.restrictions,
    examiner: opt(r.examiner),
    nrcme: opt(r.nrcme),
    waivers: r.waivers,
    sigDriver: r.sig_driver,
    sigReviewer: r.sig_reviewer,
    discrepancy: r.discrepancy,
  };
}

export function documentToRow(d: DqDocument, companyId: string): DocumentRow {
  return {
    id: d.id,
    company_id: companyId,
    driver_id: d.driverId,
    type: d.type,
    issued: d.issued ?? null,
    expires: d.expires ?? null,
    cdl_class: d.cdlClass ?? null,
    endorsements: d.endorsements ?? [],
    restrictions: d.restrictions ?? [],
    examiner: d.examiner ?? null,
    nrcme: d.nrcme ?? null,
    waivers: d.waivers ?? [],
    sig_driver: d.sigDriver ?? false,
    sig_reviewer: d.sigReviewer ?? false,
    discrepancy: d.discrepancy ?? false,
  };
}
