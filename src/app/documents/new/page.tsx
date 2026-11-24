import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { requireCompany } from '@/lib/db/session';
import styles from '../documents.module.css';
import { UploadForm } from './upload-form';

export const metadata: Metadata = { title: 'Add a document · FleetAudit' };

export default function NewDocumentPage(props: PageProps<'/documents/new'>) {
  return (
    <main className={styles.main}>
      <Link href="/" className={styles.back}>← Drivers</Link>
      <h1 className={styles.title}>Add a document</h1>
      <Suspense fallback={<p className={styles.sub}>Loading…</p>}>
        <Upload searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Upload({ searchParams }: { searchParams: PageProps<'/documents/new'>['searchParams'] }) {
  const { supabase, company } = await requireCompany();
  const { driver } = await searchParams;

  const { data, error } = await supabase
    .from('drivers')
    .select('id, first_name, last_name')
    .eq('company_id', company.id)
    .order('last_name');
  if (error) throw error;

  const drivers = data.map((d) => ({ id: d.id as string, name: `${d.first_name} ${d.last_name}` }));
  if (drivers.length === 0) return <p className={styles.sub}>Add a driver first.</p>;

  return <UploadForm companyId={company.id} drivers={drivers} initialDriver={typeof driver === 'string' ? driver : undefined} />;
}
