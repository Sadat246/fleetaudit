'use client';

import { useTransition } from 'react';
import { rejectSubmission } from './actions';
import styles from './inbox.module.css';

export function RejectButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={styles.reject}
      disabled={pending}
      onClick={() => {
        if (confirm('Reject this photo? It will leave the inbox. Send the driver a new link if you still need the document.')) {
          start(() => rejectSubmission(id));
        }
      }}
    >
      {pending ? 'Rejecting…' : 'Reject'}
    </button>
  );
}
