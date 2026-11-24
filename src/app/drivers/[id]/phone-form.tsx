'use client';

import { useActionState, useTransition } from 'react';
import { allowTextsAgain, savePhone, type PhoneState } from './actions';
import styles from './driver.module.css';

export function PhoneForm({ driverId, phone, optedOut }: { driverId: string; phone: string; optedOut: boolean }) {
  const [state, action, pending] = useActionState(savePhone, {} as PhoneState);
  const [clearing, start] = useTransition();

  return (
    <div className={styles.linkBox}>
      <form action={action} className={styles.linkRow}>
        <input type="hidden" name="driverId" value={driverId} />
        <input
          name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="(555) 234-5678"
          defaultValue={phone} className={styles.select} aria-label="Mobile number"
        />
        <button type="submit" disabled={pending} className={styles.secondary}>{pending ? 'Saving…' : 'Save number'}</button>
        {state.saved && <span className={styles.savedNote} role="status">Saved</span>}
      </form>
      {state.error && <p role="alert" className={styles.linkError}>{state.error}</p>}
      {optedOut && (
        <p className={styles.linkError}>
          This driver replied STOP, so they won&apos;t get texts. If they text START to opt back in,{' '}
          <button type="button" className={styles.inlineButton} disabled={clearing} onClick={() => start(() => allowTextsAgain(driverId))}>
            allow texts again
          </button>.
        </p>
      )}
    </div>
  );
}
