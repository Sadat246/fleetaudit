// Proves one company can't see or change another company's data.
//
// Runs against the real Supabase database, inside one transaction that is
// rolled back at the end, so it leaves nothing behind.
//
// Run:  npm run test:db   (needs DATABASE_URL in .env.local)

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });

// Two companies, each with one user, driver, document and photo.
const A = { user: randomUUID(), company: randomUUID(), driver: randomUUID(), doc: randomUUID() };
const B = { user: randomUUID(), company: randomUUID(), driver: randomUUID(), doc: randomUUID() };
const photo = (c: typeof A) => `${c.company}/${c.driver}/test.jpg`;

/** Runs SQL as a signed-in user, the way a request from the app would. */
async function asUser(user: string, sql: string, params: unknown[] = []) {
  await db.query('set local role authenticated');
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated' })]);
  // On error the transaction is unusable until the caller rolls back to a
  // savepoint, so only switch back to the admin role on success.
  const result = await db.query(sql, params);
  await db.query('reset role');
  return result;
}

/** Runs SQL as a user and returns the error it raises (undoing just that statement). */
async function errorAsUser(user: string, sql: string, params: unknown[] = []) {
  await db.query('savepoint attempt');
  try {
    await asUser(user, sql, params);
    await db.query('release savepoint attempt');
    return null;
  } catch (err) {
    // Undoes the failed statement and the role switch.
    await db.query('rollback to savepoint attempt');
    return err as Error;
  }
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local to run database tests.');
  await db.connect();
  await db.query('begin');
  for (const c of [A, B]) {
    await db.query('insert into auth.users (id, email, aud, role) values ($1, $2, $3, $3)', [c.user, `${c.user}@isolation.test`, 'authenticated']);
    await db.query('insert into companies (id, name) values ($1, $2)', [c.company, `Test ${c.company}`]);
    await db.query('insert into company_members (company_id, user_id) values ($1, $2)', [c.company, c.user]);
    await db.query('insert into drivers (id, company_id, first_name, last_name) values ($1, $2, $3, $4)', [c.driver, c.company, 'Test', 'Driver']);
    await db.query('insert into documents (id, company_id, driver_id, type) values ($1, $2, $3, $4)', [c.doc, c.company, c.driver, 'MVR_REPORT']);
    await db.query('insert into storage.objects (bucket_id, name) values ($1, $2)', ['documents', photo(c)]);
  }
});

afterAll(async () => {
  await db.query('rollback').catch(() => {});
  await db.end();
});

describe('a user can use their own company', () => {
  it('sees their own company, driver, document and photo', async () => {
    expect((await asUser(A.user, 'select id from companies')).rows).toEqual([{ id: A.company }]);
    expect((await asUser(A.user, 'select id from drivers')).rows).toEqual([{ id: A.driver }]);
    expect((await asUser(A.user, 'select id from documents')).rows).toEqual([{ id: A.doc }]);
    expect((await asUser(A.user, "select name from storage.objects where bucket_id = 'documents'")).rows).toEqual([{ name: photo(A) }]);
  });

  it('can add a driver to their own company', async () => {
    const res = await asUser(A.user, "insert into drivers (company_id, first_name, last_name) values ($1, 'New', 'Hire') returning id", [A.company]);
    expect(res.rowCount).toBe(1);
  });
});

describe("a user can't reach another company", () => {
  it("can't see the other company's company, drivers, documents, members or photos", async () => {
    const q = (sql: string) => asUser(A.user, sql, [B.company]);
    expect((await q('select 1 from companies where id = $1')).rowCount).toBe(0);
    expect((await q('select 1 from drivers where company_id = $1')).rowCount).toBe(0);
    expect((await q('select 1 from documents where company_id = $1')).rowCount).toBe(0);
    expect((await q('select 1 from company_members where company_id = $1')).rowCount).toBe(0);
    expect((await asUser(A.user, 'select 1 from storage.objects where name = $1', [photo(B)])).rowCount).toBe(0);
  });

  it("can't add a driver to the other company", async () => {
    const err = await errorAsUser(A.user, "insert into drivers (company_id, first_name, last_name) values ($1, 'Sneaky', 'Driver')", [B.company]);
    expect(err?.message).toMatch(/row-level security/);
  });

  it("can't change or delete the other company's drivers, documents or company", async () => {
    expect((await asUser(A.user, "update drivers set last_name = 'Hacked' where id = $1", [B.driver])).rowCount).toBe(0);
    expect((await asUser(A.user, 'delete from drivers where id = $1', [B.driver])).rowCount).toBe(0);
    expect((await asUser(A.user, "update documents set issued = '2000-01-01' where id = $1", [B.doc])).rowCount).toBe(0);
    expect((await asUser(A.user, 'delete from documents where id = $1', [B.doc])).rowCount).toBe(0);
    expect((await asUser(A.user, "update companies set name = 'Hacked' where id = $1", [B.company])).rowCount).toBe(0);
    // And B's data is untouched.
    expect((await db.query('select last_name from drivers where id = $1', [B.driver])).rows[0].last_name).toBe('Driver');
  });

  it("can't attach a document to the other company's driver", async () => {
    // Labelled as their own company, pointing at B's driver: blocked by the driver/company link.
    const err = await errorAsUser(A.user, "insert into documents (company_id, driver_id, type) values ($1, $2, 'MVR_REPORT')", [A.company, B.driver]);
    expect(err?.message).toMatch(/foreign key/);
  });

  it("can't upload or delete photos in the other company's folder", async () => {
    const err = await errorAsUser(A.user, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${B.company}/${B.driver}/sneaky.jpg`]);
    expect(err?.message).toMatch(/row-level security/);
    // Supabase blocks deleting photos with SQL for everyone; deletes go through
    // the Storage API, which can only delete photos the user can see (and A
    // can't see B's, checked above).
    const del = await errorAsUser(A.user, 'delete from storage.objects where name = $1', [photo(B)]);
    expect(del?.message).toMatch(/not allowed/);
  });

  it("can't join or make a second company", async () => {
    const join = await errorAsUser(A.user, 'insert into company_members (company_id, user_id) values ($1, $2)', [B.company, A.user]);
    expect(join).not.toBeNull();
    const second = await errorAsUser(A.user, "select create_company('Another one')");
    expect(second?.message).toMatch(/already belong/);
  });
});

describe('logged-out visitors', () => {
  it('get nothing at all', async () => {
    await db.query('savepoint anon');
    await db.query('set local role anon');
    const err = await db.query('select 1 from drivers').then(() => null, (e: Error) => e);
    await db.query('rollback to savepoint anon');
    await db.query('reset role');
    expect(err?.message).toMatch(/permission denied/);
  });
});
