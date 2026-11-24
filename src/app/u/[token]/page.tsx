import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { DOC_TYPE_LABEL } from '@/lib/engine';
import { createAdminClient } from '@/lib/supabase/admin';
import { findUploadLink } from '@/lib/uploads/links';
import { DriverUploadForm } from './driver-upload-form';
import styles from './upload.module.css';

// Drivers open this from a text message. No login; the link itself is the key.
export const metadata: Metadata = { title: 'Send a document', robots: { index: false, follow: false } };

export default function DriverUploadPage(props: PageProps<'/u/[token]'>) {
  return (
    <main className={styles.main}>
      <p className={styles.brand}>Fleet<span>Audit</span></p>
      <Suspense fallback={<p className={styles.sub}>Loading…</p>}>
        <Upload params={props.params} />
      </Suspense>
    </main>
  );
}

async function Upload({ params }: { params: PageProps<'/u/[token]'>['params'] }) {
  await connection();
  const { token } = await params;
  const admin = createAdminClient();
  const { state, link } = await findUploadLink(admin, token);

  if (state !== 'ok' || !link) {
    const why = state === 'used' ? 'This link was already used.' : state === 'expired' ? 'This link has expired.' : "This link isn't valid.";
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Link not working</h1>
        <p className={styles.sub}>{why} Ask your office to send you a new one.</p>
      </div>
    );
  }

  // A one-time upload slot in this company's folder for this driver.
  const path = `${link.companyId}/${link.driverId}/${crypto.randomUUID()}.jpg`;
  const { data: slot, error } = await admin.storage.from('documents').createSignedUploadUrl(path);
  if (error || !slot) throw error ?? new Error('Could not prepare the upload.');

  const what = DOC_TYPE_LABEL[link.docType].toLowerCase();
  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Hi {link.driverFirst}</h1>
      <p className={styles.sub}>
        {link.companyName} needs a photo of your new <b>{what}</b>. Lay it flat in good light and make sure every corner shows.
      </p>
      <DriverUploadForm linkToken={token} path={slot.path} uploadToken={slot.token} companyName={link.companyName} />
    </div>
  );
}
