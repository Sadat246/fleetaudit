import { describe, expect, it } from 'vitest';
import { buildSampleFleet, evaluateDriver, type IsoDate } from '../engine';
import { documentFromRow, documentToRow, driverFromRow, driverToRow } from './mappers';

const TODAY = '2026-03-15' as IsoDate;

describe('database mappers', () => {
  it('a fleet saved to rows and read back scores exactly the same', () => {
    const { drivers, docs } = buildSampleFleet(TODAY);
    const drivers2 = drivers.map((d) => driverFromRow(driverToRow(d, 'co')));
    const docs2 = docs.map((d) => documentFromRow(documentToRow(d, 'co')));

    drivers.forEach((d, i) => {
      const before = evaluateDriver(d, docs.filter((x) => x.driverId === d.id), TODAY);
      const after = evaluateDriver(drivers2[i], docs2.filter((x) => x.driverId === d.id), TODAY);
      expect(after).toEqual(before);
    });
  });

  it('turns database nulls into missing fields', () => {
    const d = driverFromRow({
      id: 'x', company_id: 'co', first_name: 'A', last_name: 'B',
      cdl_number: null, cdl_state: null, cdl_class: null, phone: null,
      hire_date: null, inquiry_done: false, inquiry_date: null,
    });
    expect(d.hireDate).toBeUndefined();
    expect(d.cdlNumber).toBeUndefined();
    expect(d.inquiry).toEqual({ done: false, date: undefined });
  });
});
