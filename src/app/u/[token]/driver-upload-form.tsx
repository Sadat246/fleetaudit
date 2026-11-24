'use client';

import { useState } from 'react';
import { shrinkImage } from '@/lib/images/resize';
import { createClient } from '@/lib/supabase/client';
import { finishDriverUpload } from './actions';
import styles from './upload.module.css';

interface Props {
  linkToken: string;
  path: string;
  uploadToken: string;
  companyName: string;
}

export function DriverUploadForm({ linkToken, path, uploadToken, companyName }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  function choose(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setError(null);
  }

  async function send() {
    if (!file) return;
    setState('sending');
    setError(null);
    try {
      const jpeg = await shrinkImage(file);
      const up = await createClient().storage.from('documents').uploadToSignedUrl(path, uploadToken, jpeg, { contentType: 'image/jpeg' });
      if (up.error) throw new Error('The upload failed. Check your signal and try again.');
      const res = await finishDriverUpload(linkToken, path);
      if (res.error) throw new Error(res.error);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>✓ Sent</p>
        <p>Thanks. {companyName} will review it. You can close this page.</p>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <label className={styles.pick}>
        {file ? 'Retake photo' : 'Take a photo'}
        <input type="file" accept="image/*" capture="environment" className={styles.hiddenInput} onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      </label>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- local preview
        <img src={preview} alt="Your photo" className={styles.preview} />
      )}

      {error && <p role="alert" className={styles.error}>{error}</p>}

      {file && (
        <button type="button" onClick={send} disabled={state === 'sending'} className={styles.send}>
          {state === 'sending' ? 'Sending…' : 'Send to office'}
        </button>
      )}
    </div>
  );
}
