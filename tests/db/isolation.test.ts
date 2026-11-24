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
    // Week 4: upload links, driver submissions, reminders and the text log.
    const link = (await db.query(
      "insert into upload_links (company_id, driver_id, doc_type, token_hash, expires_at) values ($1, $2, 'MEDICAL_EXAMINER_CERTIFICATE', $3, now() + interval '7 days') returning id",
      [c.company, c.driver, randomUUID()],
    )).rows[0].id;
    await db.query("insert into submissions (company_id, driver_id, link_id, doc_type, photo_path) values ($1, $2, $3, 'MEDICAL_EXAMINER_CERTIFICATE', $4)", [c.company, c.driver, link, photo(c)]);
    await db.query("insert into reminders (company_id, driver_id, item_key, due, threshold, status) values ($1, $2, 'medical', '2027-01-01', 30, 'test')", [c.company, c.driver]);
    await db.query("insert into messages (company_id, driver_id, to_phone, body, status) values ($1, $2, '+15552345678', 'hi', 'test')", [c.company, c.driver]);
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

describe('reminders, upload links and driver uploads stay inside the company', () => {
  const TABLES = ['upload_links', 'submissions', 'reminders', 'messages'];

  it('each user sees only their own rows', async () => {
    for (const t of TABLES) {
      const rows = (await asUser(A.user, `select company_id from ${t}`)).rows;
      expect(rows.length, t).toBeGreaterThan(0);
      expect(rows.every((r) => r.company_id === A.company), t).toBe(true);
    }
  });

  it("can't mark the other company's driver upload as reviewed", async () => {
    const res = await asUser(A.user, "update submissions set status = 'accepted' where company_id = $1", [B.company]);
    expect(res.rowCount).toBe(0);
    expect((await db.query('select status from submissions where company_id = $1', [B.company])).rows[0].status).toBe('pending');
  });

  it("can't create links, reminders or text logs for the other company", async () => {
    const link = await errorAsUser(A.user,
      "insert into upload_links (company_id, driver_id, doc_type, token_hash, expires_at) values ($1, $2, 'MEDICAL_EXAMINER_CERTIFICATE', 'x', now())", [B.company, B.driver]);
    expect(link?.message).toMatch(/row-level security/);
    const msg = await errorAsUser(A.user,
      "insert into messages (company_id, driver_id, to_phone, body, status) values ($1, $2, '+15552345678', 'hi', 'test')", [B.company, B.driver]);
    expect(msg?.message).toMatch(/row-level security/);
    const rem = await errorAsUser(A.user,
      "insert into reminders (company_id, driver_id, item_key, due, threshold, status) values ($1, $2, 'cdl', '2027-01-01', 7, 'test')", [B.company, B.driver]);
    expect(rem?.message).toMatch(/row-level security/);
  });

  it("can't point a link at the other company's driver, even labelled as their own company", async () => {
    const err = await errorAsUser(A.user,
      "insert into upload_links (company_id, driver_id, doc_type, token_hash, expires_at) values ($1, $2, 'MEDICAL_EXAMINER_CERTIFICATE', 'y', now())", [A.company, B.driver]);
    expect(err?.message).toMatch(/foreign key/);
  });

  it('users can never insert driver submissions directly (only the upload page can)', async () => {
    const err = await errorAsUser(A.user,
      "insert into submissions (company_id, driver_id, doc_type, photo_path) values ($1, $2, 'MEDICAL_EXAMINER_CERTIFICATE', 'x')", [A.company, A.driver]);
    // Blocked either by table permissions or by having no insert rule.
    expect(err?.message).toMatch(/permission denied|row-level security/);
  });
});

describe('logged-out visitors', () => {
  it('get nothing at all', async () => {
    await db.query('savepoint anon');
    await db.query('set local role anon');
    const errors = [];
    for (const t of ['drivers', 'upload_links', 'submissions', 'reminders', 'messages']) {
      await db.query('savepoint anon_table');
      errors.push(await db.query(`select 1 from ${t}`).then(() => null, (e: Error) => e));
      await db.query('rollback to savepoint anon_table');
    }
    const err = errors.find((e) => !e?.message.match(/permission denied/)) ?? errors[0];
    await db.query('rollback to savepoint anon');
    await db.query('reset role');
    expect(err?.message).toMatch(/permission denied/);
  });
});
