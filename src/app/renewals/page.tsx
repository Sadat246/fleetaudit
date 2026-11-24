import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadScoredFleet } from '@/lib/db/fleet';
import { requireCompany } from '@/lib/db/session';
import { dueWithin, fmtDate, type FleetItem } from '@/lib/engine';
import { ItemList } from '../ui/item-list';
import { Nav } from '../ui/nav';
import shell from '../ui/shell.module.css';
import { dueText } from '../ui/status';

export const metadata: Metadata = { title: 'Renewals · FleetAudit' };

const WINDOW_DAYS = 60;

export default function RenewalsPage() {
  return (
    <main className={`${shell.main} ${shell.narrow}`}>
      <Nav />
      <h1 className={shell.title}>Renewals</h1>
      <p className={shell.sub}>Everything overdue or due in the next {WINDOW_DAYS} days, soonest first.</p>
      <Suspense fallback={<p className={shell.sub}>Loading…</p>}>
        <Renewals />
      </Suspense>
    </main>
  );
}

async function Renewals() {
  const { supabase, company } = await requireCompany();
  const { today, rows } = await loadScoredFleet(supabase, company);
  const due = dueWithin(rows, WINDOW_DAYS);

  const groups: [string, FleetItem[]][] = [
    ['Overdue', due.filter((x) => x.item.days! < 0)],
    ['Next 30 days', due.filter((x) => x.item.days! >= 0 && x.item.days! <= 30)],
    [`31–${WINDOW_DAYS} days`, due.filter((x) => x.item.days! > 30)],
  ];

  const side = (x: FleetItem) => `${dueText(x.item.days)}${x.item.due ? ` · ${fmtDate(x.item.due)}` : ''}`;

  return (
    <>
      {due.length === 0 && <p className={`${shell.card} ${shell.empty} ${shell.section}`}>Nothing due in the next {WINDOW_DAYS} days.</p>}
      {groups.map(([title, items]) => items.length > 0 && (
        <section key={title} className={shell.section}>
          <h2 className={shell.h2}>{title} ({items.length})</h2>
          <div className={shell.card}>
            <ItemList items={items} side={side} />
          </div>
        </section>
      ))}
      <p className={shell.foot}>As of {fmtDate(today)}. Missing documents are on the Overview and Drivers pages.</p>
    </>
  );
}
