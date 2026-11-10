import {
  evaluateDriver,
  STATUS_RANK,
  todayIn,
  fmtDate,
  type ChecklistItem,
  type DriverResult,
  type ItemKey,
} from '@/lib/engine';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getMyCompany, loadFleet } from '@/lib/db/fleet';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './login/actions';
import { CompanyForm } from './setup/company-form';
import styles from './page.module.css';

const COLUMNS: [ItemKey, string][] = [
  ['app', 'Application'], ['inq', 'Prior employers'], ['mvr', 'MVR'], ['annual', 'Annual review'],
  ['medical', 'Medical card'], ['cdl', 'CDL'], ['clh', 'Clearinghouse'],
];

const ICON = { ok: '✓', warn: '!', crit: '✕', na: '–' } as const;

function Cell({ item }: { item: ChecklistItem }) {
  if (item.missing) {
    return <span className={`${styles.cell} ${styles.miss} ${item.status === 'warn' ? styles.missWarn : ''}`}>{item.key === 'inq' ? 'Open' : 'Missing'}</span>;
  }
  if (item.status === 'na') return <span className={`${styles.cell} ${styles.na}`}>n/a</span>;
  const days = item.days == null || item.days > 999 ? '' : item.days < 0 ? `${-item.days}d late` : `${item.days}d`;
  return (
    <span className={`${styles.cell} ${styles[item.status]}`} title={item.sum}>
      <span aria-hidden="true">{ICON[item.status]}</span> {days}
    </span>
  );
}

function Stamp({ result }: { result: DriverResult }) {
  const text = result.status === 'ok' ? 'Fully compliant' : result.status === 'warn' ? 'Audit warning' : result.oos ? 'Critical · OOS risk' : 'Critical violation';
  return <span className={`${styles.stamp} ${styles[result.status]}`}>{text}</span>;
}

export default function RosterPage() {
  return (
    <main className={styles.main}>
      <p className={styles.brand}>Fleet<span>Audit</span></p>
      <h1 className={styles.title}>Drivers</h1>
      <Suspense fallback={<p className={styles.sub}>Loading your fleet…</p>}>
        <Roster />
      </Suspense>
      <p className={styles.foot}>Screening aid for 49 CFR Part 391 files. Not legal advice or an FMCSA determination.</p>
    </main>
  );
}

async function Roster() {
  // Reads the login cookie, so this renders fresh on every request.
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/login');

  const company = await getMyCompany(supabase);
  if (!company) {
    return (
      <div className={styles.setup}>
        <CompanyForm />
        <SignOut email={claims.claims.email} />
      </div>
    );
  }

  const today = todayIn(company.timeZone);
  const { drivers, docs } = await loadFleet(supabase, company.id);

  const rows = drivers
    .map((dr) => ({ dr, result: evaluateDriver(dr, docs.filter((d) => d.driverId === dr.id), today) }))
    .sort((a, b) => STATUS_RANK[b.result.status] - STATUS_RANK[a.result.status] || a.dr.last.localeCompare(b.dr.last));

  const counts = { ok: 0, warn: 0, crit: 0 };
  rows.forEach((r) => counts[r.result.status]++);

  return (
    <>
      <header className={styles.head}>
        <p className={styles.sub}>{company.name} · as of {fmtDate(today)}</p>
        <p className={styles.summary}>
          <b>{counts.ok}</b> of {rows.length} audit-ready · <b className={styles.critText}>{counts.crit}</b> critical · <b className={styles.warnText}>{counts.warn}</b> warning
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Driver</th>
                {COLUMNS.map(([k, label]) => <th key={k} scope="col">{label}</th>)}
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ dr, result }) => (
                <tr key={dr.id}>
                  <td>
                    <span className={styles.name}>{dr.first} {dr.last}</span>
                    <span className={styles.meta}>{[dr.cdlState, dr.cdlClass && `Class ${dr.cdlClass}`, dr.cdlNumber].filter(Boolean).join(' · ')}</span>
                  </td>
                  {COLUMNS.map(([k]) => (
                    <td key={k}><Cell item={result.items.find((i) => i.key === k)!} /></td>
                  ))}
                  <td><Stamp result={result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className={styles.empty}>No drivers yet. Adding drivers comes in Week 2.</p>}
      </section>
      <SignOut email={claims.claims.email} />
    </>
  );
}

function SignOut({ email }: { email?: string }) {
  return (
    <form action={signOut} className={styles.account}>
      <span>Signed in as {email}</span>
      <button type="submit" className={styles.signOut}>Sign out</button>
    </form>
  );
}
