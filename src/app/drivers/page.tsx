import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { loadScoredFleet } from '@/lib/db/fleet';
import { requireCompany } from '@/lib/db/session';
import { fmtDate, type ItemKey } from '@/lib/engine';
import { Nav } from '../ui/nav';
import shell from '../ui/shell.module.css';
import { Cell, Stamp } from '../ui/status';
import styles from './roster.module.css';

export const metadata: Metadata = { title: 'Drivers · FleetAudit' };

const COLUMNS: [ItemKey, string][] = [
  ['app', 'Application'], ['inq', 'Prior employers'], ['mvr', 'MVR'], ['annual', 'Annual review'],
  ['medical', 'Medical card'], ['cdl', 'CDL'], ['clh', 'Clearinghouse'],
];

export default function DriversPage() {
  return (
    <main className={shell.main}>
      <Nav />
      <h1 className={shell.title}>Drivers</h1>
      <Suspense fallback={<p className={shell.sub}>Loading your fleet…</p>}>
        <Roster />
      </Suspense>
      <p className={shell.foot}>Screening aid for 49 CFR Part 391 files. Not legal advice or an FMCSA determination.</p>
    </main>
  );
}

async function Roster() {
  const { supabase, company } = await requireCompany();
  const { today, rows, counts } = await loadScoredFleet(supabase, company);

  return (
    <>
      <header className={styles.head}>
        <p className={shell.sub}>{company.name} · as of {fmtDate(today)}</p>
        <p className={styles.summary}>
          <b>{counts.ok}</b> of {counts.total} audit-ready · <b className={shell.critText}>{counts.crit}</b> critical · <b className={shell.warnText}>{counts.warn}</b> warning
        </p>
      </header>

      <section className={shell.card}>
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
              {rows.map(({ driver: dr, result }) => (
                <tr key={dr.id}>
                  <td>
                    <Link href={`/drivers/${dr.id}`} className={styles.name}>{dr.first} {dr.last}</Link>
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
        {rows.length === 0 && <p className={shell.empty}>No drivers yet.</p>}
      </section>
    </>
  );
}
