'use client';

import { useActionState } from 'react';
import styles from '../login/login.module.css';
import { createCompany, type SetupState } from './actions';

export function CompanyForm() {
  const [state, action, pending] = useActionState(createCompany, {} as SetupState);

  return (
    <form action={action} className={styles.form}>
      <h2 className={styles.title}>Set up your company</h2>
      <label className={styles.label}>
        Company name
        <input name="name" required maxLength={200} autoComplete="organization" className={styles.input} />
      </label>
      <label className={styles.check}>
        <input name="sample" type="checkbox" defaultChecked /> Load 12 sample drivers so I can try it out
      </label>
      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? 'Setting up…' : 'Create company'}
      </button>
    </form>
  );
}
