import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requireCompany } from '@/lib/db/session';
import { DOC_TYPE_LABEL, type DocType } from '@/lib/engine';
import { Nav } from '../ui/nav';
import shell from '../ui/shell.module.css';
import styles from './inbox.module.css';
import { RejectButton } from './reject-button';

export const metadata: Metadata = { title: 'Inbox · FleetAudit' };

export default function InboxPage() {
  return (
    <main className={`${shell.main} ${shell.narrow}`}>
      <Nav />
      <h1 className={shell.title}>Inbox</h1>
      <p className={shell.sub}>Photos drivers sent from their upload links. Review each one to add it to their file.</p>
      <Suspense fallback={<p className={shell.sub}>Loading…</p>}>
        <Inbox />
      </Suspense>
    </main>
  );
}

const when = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

async function Inbox() {
  const { supabase, company } = await requireCompany();
  const { data, error } = await supabase
    .from('submissions')
    .select('id, driver_id, doc_type, photo_path, created_at, drivers(first_name, last_name)')
    .eq('company_id', company.id)
    .eq('status', 'pending')
    .order('created_at');
  if (error) throw error;

  if (data.length === 0) {
    return <p className={`${shell.card} ${shell.empty} ${shell.section}`}>Nothing waiting. New driver uploads will show up here.</p>;
  }

  return (
    <ul className={`${shell.card} ${shell.list} ${shell.section}`}>
      {data.map((s) => {
        const d = s.drivers as unknown as { first_name: string; last_name: string };
        const review = `/documents/review?driver=${s.driver_id}&photo=${encodeURIComponent(s.photo_path)}&submission=${s.id}`;
        return (
          <li key={s.id} className={styles.row}>
            <div>
              <p className={shell.rowMain}>{d.first_name} {d.last_name}</p>
              <p className={shell.rowSub}>{DOC_TYPE_LABEL[s.doc_type as DocType]} · sent {when.format(new Date(s.created_at))}</p>
            </div>
            <div className={styles.actions}>
              <RejectButton id={s.id} />
              <Link href={review} className={shell.primary}>Review</Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
