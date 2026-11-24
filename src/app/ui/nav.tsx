'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { signOut } from '../login/actions';
import styles from './shell.module.css';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/renewals', label: 'Renewals' },
  { href: '/inbox', label: 'Inbox' },
];

/** The page links. Reading the URL waits for the request, so this loads behind a boundary. */
function Links({ path }: { path: string | null }) {
  const active = (href: string) => path !== null && (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <div className={styles.links}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={styles.link} aria-current={active(l.href) ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function ActiveLinks() {
  return <Links path={usePathname()} />;
}

export function Nav() {
  return (
    <nav className={styles.nav} aria-label="Main">
      <Link href="/" className={styles.brand}>Fleet<span>Audit</span></Link>
      <Suspense fallback={<Links path={null} />}>
        <ActiveLinks />
      </Suspense>
      <div className={styles.actions}>
        <Link href="/documents/new" className={styles.primary}>+ Add document</Link>
        <form action={signOut}>
          <button type="submit" className={styles.textButton}>Sign out</button>
        </form>
      </div>
    </nav>
  );
}
