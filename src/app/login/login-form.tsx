'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, type AuthState } from './actions';
import styles from './login.module.css';

export function LoginForm() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [inState, inAction, inPending] = useActionState(signIn, {} as AuthState);
  const [upState, upAction, upPending] = useActionState(signUp, {} as AuthState);
  const state = mode === 'in' ? inState : upState;
  const pending = inPending || upPending;

  return (
    <form action={mode === 'in' ? inAction : upAction} className={styles.form}>
      <h1 className={styles.title}>{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>

      <label className={styles.label}>
        Email
        <input name="email" type="email" autoComplete="email" required defaultValue={state.email} className={styles.input} />
      </label>
      <label className={styles.label}>
        Password
        <input
          name="password" type="password" required minLength={8}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'} className={styles.input}
        />
      </label>

      {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
      {state.message && <p role="status" className={styles.message}>{state.message}</p>}

      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>

      <p className={styles.switch}>
        {mode === 'in' ? 'New to FleetAudit?' : 'Already have an account?'}{' '}
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className={styles.link}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </form>
  );
}
