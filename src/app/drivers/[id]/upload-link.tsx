'use client';

import { useState, useTransition } from 'react';
import { createLinkForDriver, textLinkToDriver } from './actions';
import styles from './driver.module.css';

interface Props {
  driverId: string;
  driverFirst: string;
  /** False when there's no phone number or the driver replied STOP. */
  canText: boolean;
  testMode: boolean;
}

/** Office tool: ask a driver for a document by text, or get a link to send yourself. */
export function UploadLink({ driverId, driverFirst, canText, testMode }: Props) {
  const [docType, setDocType] = useState('MEDICAL_EXAMINER_CERTIFICATE');
  const [url, setUrl] = useState<string | null>(null);
  const [sent, setSent] = useState<{ status: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function reset() {
    setError(null);
    setCopied(false);
    setSent(null);
    setUrl(null);
  }

  function text() {
    reset();
    start(async () => {
      const res = await textLinkToDriver(driverId, docType);
      if (res.error) setError(res.error);
      else setSent({ status: res.status!, body: res.body! });
    });
  }

  function create() {
    reset();
    start(async () => {
      const res = await createLinkForDriver(driverId, docType);
      if (res.error) setError(res.error);
      else setUrl(res.url!);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  }

  return (
    <div className={styles.linkBox}>
      <div className={styles.linkRow}>
        <select value={docType} onChange={(e) => { setDocType(e.target.value); reset(); }} className={styles.select} aria-label="Document to ask for">
          <option value="MEDICAL_EXAMINER_CERTIFICATE">Medical certificate</option>
          <option value="COMMERCIAL_DRIVERS_LICENSE">CDL</option>
        </select>
        <button type="button" onClick={text} disabled={pending || !canText} className={styles.primaryButton}>
          {pending ? 'Working…' : `Text ${driverFirst} a link`}
        </button>
        <button type="button" onClick={create} disabled={pending} className={styles.secondary}>
          Just make a link
        </button>
      </div>

      {sent && (
        <div className={sent.status === 'sent' ? styles.sentOk : sent.status === 'test' ? styles.sentTest : styles.sentFail} role="status">
          <b>{sent.status === 'sent' ? 'Text sent.' : sent.status === 'test' ? 'Test mode: not actually sent.' : 'The text failed to send.'}</b>
          <span>&ldquo;{sent.body}&rdquo;</span>
        </div>
      )}

      {url && (
        <>
          <div className={styles.linkRow}>
            <input readOnly value={url} className={styles.linkInput} onFocus={(e) => e.target.select()} aria-label="Upload link" />
            <button type="button" onClick={copy} className={styles.secondary}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className={styles.cite}>Send this to {driverFirst} yourself. It works once and expires in 7 days.</p>
        </>
      )}

      {!canText && <p className={styles.cite}>Add a phone number above to text {driverFirst}.</p>}
      {testMode && canText && !sent && <p className={styles.cite}>Texting is in test mode until Twilio is set up: messages are logged, not sent.</p>}
      {error && <p role="alert" className={styles.linkError}>{error}</p>}
    </div>
  );
}
