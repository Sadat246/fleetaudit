import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { extractDocument, ExtractionError, type Extraction } from '@/lib/ai/extract';
import { requireCompany } from '@/lib/db/session';
import { todayIn, type IsoDate } from '@/lib/engine';
import { reviewChecks, toDraft } from '@/lib/ai/review';
import { ReviewForm } from './review-form';
import { Nav } from '../../ui/nav';
import shell from '../../ui/shell.module.css';
import styles from '../documents.module.css';

export const metadata: Metadata = { title: 'Review document · FleetAudit' };

export default function ReviewPage(props: PageProps<'/documents/review'>) {
  return (
    <main className={`${shell.main} ${shell.narrow}`}>
      <Nav />
      <Link href="/drivers" className={shell.back}>← Drivers</Link>
      <h1 className={styles.title}>Review document</h1>
      <Suspense fallback={<p className={styles.sub}>Loading…</p>}>
        <Review searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Review({ searchParams }: { searchParams: PageProps<'/documents/review'>['searchParams'] }) {
  const { supabase, company } = await requireCompany();
  const { driver: driverId, photo } = await searchParams;
  if (typeof driverId !== 'string' || typeof photo !== 'string') notFound();

  // The photo must be in this company's folder, for this driver.
  if (!photo.startsWith(`${company.id}/${driverId}/`)) notFound();

  const { data: driver } = await supabase
    .from('drivers').select('first_name, last_name').eq('id', driverId).eq('company_id', company.id).maybeSingle();
  if (!driver) notFound();

  // A temporary link (10 minutes) to the private photo.
  const { data: signed, error } = await supabase.storage.from('documents').createSignedUrl(photo, 600);
  if (error || !signed) notFound();

  return (
    <div className={styles.review}>
      <p className={styles.sub}>{driver.first_name} {driver.last_name}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img src={signed.signedUrl} alt="Uploaded document" className={styles.photo} />
      <Suspense fallback={<p className={styles.note}>Reading the document… this takes a few seconds.</p>}>
        <AiFields
          photo={photo}
          today={todayIn(company.timeZone)}
          driverId={driverId}
          driver={{ first: driver.first_name, last: driver.last_name }}
        />
      </Suspense>
    </div>
  );
}

async function AiFields(props: { photo: string; today: IsoDate; driverId: string; driver: { first: string; last: string } }) {
  const { supabase } = await requireCompany();
  const { data: file, error } = await supabase.storage.from('documents').download(props.photo);
  if (error || !file) return <p role="alert" className={styles.error}>Couldn&apos;t load the photo for reading.</p>;

  let x: Extraction;
  try {
    x = await extractDocument(await file.arrayBuffer(), props.today);
  } catch (err) {
    const msg = err instanceof ExtractionError ? err.message : 'Reading the document failed. Refresh to try again.';
    if (!(err instanceof ExtractionError)) console.error('extractDocument failed', err);
    return <p role="alert" className={styles.error}>{msg}</p>;
  }

  return (
    <ReviewForm
      draft={toDraft(x)}
      checks={reviewChecks(x, props.driver)}
      notes={x.notes}
      driverId={props.driverId}
      photo={props.photo}
    />
  );
}
