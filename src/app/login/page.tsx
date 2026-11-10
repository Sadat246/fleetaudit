import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import styles from './login.module.css';

export const metadata: Metadata = { title: 'Sign in · FleetAudit' };

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <p className={styles.brand}>Fleet<span>Audit</span></p>
      <LoginForm />
    </main>
  );
}
