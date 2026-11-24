'use client';

import { useActionState, useState } from 'react';
import { FIELDS, ISSUED_LABEL, type Draft } from '@/lib/ai/review';
import { DOC_TYPE_LABEL, DOC_TYPES, type DocType } from '@/lib/engine';
import styles from '../documents.module.css';
import { saveDocument, type SaveState } from './actions';

const TYPE_LABEL: Record<DocType, string> = { ...DOC_TYPE_LABEL, UNKNOWN_OR_UNCORRELATED: 'Choose a type…' };

interface Props {
  draft: Draft;
  driverId: string;
  photo: string;
  checks: string[];
  notes: string[];
  /** Set when this photo came from a driver's upload link. */
  submissionId?: string;
}

export function ReviewForm({ draft, driverId, photo, checks, notes, submissionId }: Props) {
  const [type, setType] = useState<DocType>(draft.type);
  const [state, action, pending] = useActionState(saveDocument, {} as SaveState);
  const show = new Set(FIELDS[type]);

  const textField = (name: keyof Draft, label: string, hint?: string) =>
    show.has(name) && (
      <label className={styles.label}>
        {label}
        <input name={name} defaultValue={draft[name] as string} className={styles.input} />
        {hint && <span className={styles.hint}>{hint}</span>}
      </label>
    );
  const checkbox = (name: 'sigDriver' | 'sigReviewer', label: string) =>
    show.has(name) && (
      <label className={styles.checkRow}>
        <input type="checkbox" name={name} defaultChecked={draft[name]} /> {label}
      </label>
    );

  return (
    <form action={action} className={styles.form}>
      <h2 className={styles.h2}>Check and save</h2>

      {checks.length > 0 && (
        <ul className={styles.checks} aria-label="Things to double-check">
          {checks.map((c) => <li key={c}>{c}</li>)}
        </ul>
      )}

      <input type="hidden" name="driverId" value={driverId} />
      <input type="hidden" name="photo" value={photo} />
      {submissionId && <input type="hidden" name="submissionId" value={submissionId} />}

      <label className={styles.label}>
        Document type
        <select name="type" value={type} onChange={(e) => setType(e.target.value as DocType)} className={styles.input}>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t} disabled={t === 'UNKNOWN_OR_UNCORRELATED'}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
      </label>

      <div className={styles.row}>
        <label className={styles.label}>
          {ISSUED_LABEL[type]}
          <input type="date" name="issued" defaultValue={draft.issued} className={styles.input} />
        </label>
        {show.has('expires') && (
          <label className={styles.label}>
            Expires
            <input type="date" name="expires" defaultValue={draft.expires} className={styles.input} />
          </label>
        )}
      </div>

      {textField('examiner', "Examiner's name")}
      {textField('nrcme', 'National Registry number', 'Should be 10 digits.')}
      {textField('cdlClass', 'License class')}
      {textField('endorsements', 'Endorsements', 'Separate with commas, e.g. H, N, T')}
      {textField('restrictions', 'Restrictions', 'Separate with commas')}
      {textField('waivers', 'Waivers or exemptions', 'Separate with commas')}
      {checkbox('sigDriver', 'Driver signed')}
      {checkbox('sigReviewer', type === 'MEDICAL_EXAMINER_CERTIFICATE' ? 'Examiner signed' : 'Reviewer signed')}

      {notes.length > 0 && (
        <details className={styles.aiNotes}>
          <summary>AI notes ({notes.length})</summary>
          <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </details>
      )}

      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}

      <button type="submit" disabled={pending || type === 'UNKNOWN_OR_UNCORRELATED'} className={styles.button}>
        {pending ? 'Saving…' : 'Save to driver'}
      </button>
    </form>
  );
}
