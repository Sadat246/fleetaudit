import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { documentFromRow, driverFromRow, type DocumentRow, type DriverRow } from '@/lib/db/mappers';
import { requireCompany } from '@/lib/db/session';
import { DOC_TYPE_LABEL, evaluateDriver, fmtDate, todayIn } from '@/lib/engine';
import { Nav } from '../../ui/nav';
import shell from '../../ui/shell.module.css';
import { dueText, Pill, Stamp } from '../../ui/status';
import styles from './driver.module.css';
import { PhoneForm } from './phone-form';
import { UploadLink } from './upload-link';
import { formatPhone } from '@/lib/sms/format';
import { smsMode } from '@/lib/sms/send';

export const metadata: Metadata = { title: 'Driver · FleetAudit' };

const sentAt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DriverPage(props: PageProps<'/drivers/[id]'>) {
  return (
    <main className={`${shell.main} ${shell.narrow}`}>
      <Nav />
      <Link href="/drivers" className={shell.back}>← All drivers</Link>
      <Suspense fallback={<p className={shell.sub}>Loading…</p>}>
        <DriverDetail params={props.params} />
      </Suspense>
    </main>
  );
}

async function DriverDetail({ params }: { params: PageProps<'/drivers/[id]'>['params'] }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, company } = await requireCompany();

  const [driverRes, docsRes, msgRes] = await Promise.all([
    supabase.from('drivers').select('*').eq('id', id).eq('company_id', company.id).maybeSingle(),
    supabase.from('documents').select('*').eq('driver_id', id).eq('company_id', company.id).order('created_at', { ascending: false }),
    supabase.from('messages').select('id, body, status, detail, created_at').eq('driver_id', id).eq('company_id', company.id).order('created_at', { ascending: false }).limit(5),
  ]);
  if (driverRes.error) throw driverRes.error;
  if (docsRes.error) throw docsRes.error;
  if (!driverRes.data) notFound();

  const driver = driverFromRow(driverRes.data as DriverRow);
  const optedOut = Boolean((driverRes.data as { sms_opt_out?: boolean }).sms_opt_out);
  const messages = msgRes.data ?? [];
  const rows = docsRes.data as (DocumentRow & { photo_path: string | null; created_at: string })[];
  const today = todayIn(company.timeZone);
  const result = evaluateDriver(driver, rows.map(documentFromRow), today);

  // Temporary (10-minute) links to the private photos.
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const photoUrl = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from('documents').createSignedUrls(paths, 600);
    data?.forEach((s) => s.path && s.signedUrl && photoUrl.set(s.path, s.signedUrl));
  }

  const meta = [
    driver.cdlState, driver.cdlClass && `Class ${driver.cdlClass}`, driver.cdlNumber,
    driver.hireDate && `Hired ${fmtDate(driver.hireDate)}`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <header className={shell.head}>
        <div>
          <h1 className={shell.title}>{driver.first} {driver.last}</h1>
          <p className={shell.sub}>{meta}</p>
        </div>
        <div className={styles.headSide}>
          <Stamp result={result} />
          <Link href={`/documents/new?driver=${driver.id}`} className={shell.primary}>+ Add document</Link>
        </div>
      </header>

      <section className={shell.section}>
        <h2 className={shell.h2}>DQ file checklist</h2>
        <ul className={`${shell.card} ${shell.list}`}>
          {result.items.map((item) => (
            <li key={item.key} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemLabel}>{item.label}</span>
                <Pill status={item.status} missing={item.missing} />
              </div>
              <p className={styles.itemSum}>
                {item.sum}
                {item.days !== null && item.status !== 'na' && <span className={styles.due}> · {dueText(item.days)}</span>}
              </p>
              {item.issues.length > 0 && (
                <ul className={styles.issues}>
                  {item.issues.map((i) => <li key={i.text} className={i.sev === 'crit' ? shell.critText : shell.warnText}>{i.text}</li>)}
                </ul>
              )}
              <p className={styles.cite}>{item.cite} · if missing: {item.risk.toLowerCase()}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>Ask {driver.first} for a document</h2>
        <div className={shell.card}>
          <PhoneForm driverId={driver.id} phone={driver.phone ? formatPhone(driver.phone) : ''} optedOut={optedOut} />
          <UploadLink driverId={driver.id} driverFirst={driver.first} canText={Boolean(driver.phone) && !optedOut} testMode={smsMode() === 'test'} />
        </div>
        {messages.length > 0 && (
          <ul className={`${shell.card} ${shell.list} ${styles.messages}`} aria-label="Recent texts">
            {messages.map((m) => (
              <li key={m.id} className={styles.message}>
                <span className={m.status === 'sent' ? shell.okText : m.status === 'test' ? shell.warnText : shell.critText}>
                  {m.status === 'sent' ? 'Sent' : m.status === 'test' ? 'Test (not sent)' : 'Failed'} · {sentAt.format(new Date(m.created_at))}
                </span>
                <span className={styles.messageBody}>{m.body}</span>
                {m.status === 'failed' && m.detail && <span className={styles.cite}>{m.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>Documents on file ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className={`${shell.card} ${shell.empty}`}>No documents yet.</p>
        ) : (
          <ul className={`${shell.card} ${shell.list}`}>
            {rows.map((r) => {
              const url = r.photo_path ? photoUrl.get(r.photo_path) : undefined;
              return (
                <li key={r.id} className={styles.doc}>
                  <div>
                    <span className={styles.itemLabel}>{DOC_TYPE_LABEL[r.type]}</span>
                    <p className={styles.itemSum}>
                      {[r.issued && fmtDate(r.issued), r.expires && `expires ${fmtDate(r.expires)}`].filter(Boolean).join(' · ') || 'No dates'}
                    </p>
                  </div>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.photoLink}>View photo</a>
                  ) : (
                    <span className={styles.noPhoto}>{r.photo_path ? 'Photo unavailable' : 'Sample data'}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
