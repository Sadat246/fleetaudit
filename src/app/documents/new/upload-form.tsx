'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { shrinkImage } from '@/lib/images/resize';
import { createClient } from '@/lib/supabase/client';
import styles from '../documents.module.css';

interface Props {
  companyId: string;
  drivers: { id: string; name: string }[];
  initialDriver?: string;
}

export function UploadForm({ companyId, drivers, initialDriver }: Props) {
  const router = useRouter();
  const [driverId, setDriverId] = useState(drivers.some((d) => d.id === initialDriver) ? initialDriver! : '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Show the chosen photo, freeing the previous preview's memory.
  function choose(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!driverId || !file) return;
    setBusy(true);
    setError(null);
    try {
      const jpeg = await shrinkImage(file);
      // The first folder must be the company id: storage rules check it.
      const path = `${companyId}/${driverId}/${crypto.randomUUID()}.jpg`;
      const { error } = await createClient().storage.from('documents').upload(path, jpeg, { contentType: 'image/jpeg' });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      router.push(`/documents/review?driver=${driverId}&photo=${encodeURIComponent(path)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={upload} className={styles.form}>
      <label className={styles.label}>
        Driver
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} required className={styles.input}>
          <option value="" disabled>Choose a driver…</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>

      <label className={styles.label}>
        Photo of the document
        {/* On a phone, this offers the camera. */}
        <input
          type="file" accept="image/*" capture="environment" required className={styles.file}
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </label>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview, not a hosted image
        <img src={preview} alt="The photo you chose" className={styles.preview} />
      )}

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <button type="submit" disabled={busy || !driverId || !file} className={styles.button}>
        {busy ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
