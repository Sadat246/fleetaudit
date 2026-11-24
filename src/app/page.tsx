import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { getMyCompany, loadScoredFleet } from '@/lib/db/fleet';
import { dueWithin, fixFirst, fmtDate } from '@/lib/engine';
import { createClient } from '@/lib/supabase/server';
import { CompanyForm } from './setup/company-form';
import { Nav } from './ui/nav';
import shell from './ui/shell.module.css';
import { ItemList } from './ui/item-list';
import { dueText } from './ui/status';
import styles from './overview.module.css';

export default function OverviewPage() {
  return (
    <main className={shell.main}>
      <Nav />
      <Suspense fallback={<p className={shell.sub}>Loading your fleet…</p>}>
        <Overview />
      </Suspense>
      <p className={shell.foot}>Screening aid for 49 CFR Part 391 files. Not legal advice or an FMCSA determination.</p>
    </main>
  );
}

async function Overview() {
  // Always render fresh: the login check and "days left" depend on the current time.
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect('/login');

  const company = await getMyCompany(supabase);
  if (!company) {
    return (
      <div className={styles.setup}>
        <CompanyForm />
      </div>
    );
  }

  const { today, rows, counts } = await loadScoredFleet(supabase, company);
  const fix = fixFirst(rows);
  const soon = dueWithin(rows, 30).filter((x) => x.item.days! >= 0);

  return (
    <>
      <header className={shell.head}>
        <div>
          <h1 className={shell.title}>{company.name}</h1>
          <p className={shell.sub}>Overview as of {fmtDate(today)}</p>
        </div>
      </header>

      <div className={styles.tiles}>
        <Tile label="Audit-ready" value={`${counts.ok} of ${counts.total}`} tone="ok" href="/drivers" />
        <Tile label="Critical" value={counts.crit} tone={counts.crit ? 'crit' : 'ok'} href="/drivers" />
        <Tile label="Warnings" value={counts.warn} tone={counts.warn ? 'warn' : 'ok'} href="/drivers" />
        <Tile label="Due in 30 days" value={soon.length} tone={soon.length ? 'warn' : 'ok'} href="/renewals" />
      </div>

      <section className={shell.section}>
        <h2 className={shell.h2}>Fix first</h2>
        <div className={shell.card}>
          {fix.length === 0 ? (
            <p className={shell.empty}>Nothing critical. Every driver can legally drive.</p>
          ) : (
            <ItemList items={fix.slice(0, 8)} side={(x) => x.item.risk === 'Out of service' ? 'Out-of-service risk' : x.item.cite} />
          )}
        </div>
        {fix.length > 8 && <p className={styles.more}><Link href="/drivers">See all {fix.length} on the Drivers page →</Link></p>}
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>Coming due in 30 days</h2>
        <div className={shell.card}>
          {soon.length === 0 ? (
            <p className={shell.empty}>Nothing due in the next 30 days.</p>
          ) : (
            <ItemList items={soon.slice(0, 6)} side={(x) => dueText(x.item.days)} />
          )}
        </div>
        <p className={styles.more}><Link href="/renewals">All renewals for the next 60 days →</Link></p>
      </section>
    </>
  );
}

function Tile({ label, value, tone, href }: { label: string; value: string | number; tone: 'ok' | 'warn' | 'crit'; href: string }) {
  return (
    <Link href={href} className={`${styles.tile} ${styles[tone]}`}>
      <span className={styles.tileValue}>{value}</span>
      <span className={styles.tileLabel}>{label}</span>
    </Link>
  );
}
