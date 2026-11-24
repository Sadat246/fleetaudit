import type { ChecklistItem, DriverResult, Status } from '@/lib/engine';
import styles from './status.module.css';

const ICON = { ok: '✓', warn: '!', crit: '✕', na: '–' } as const;

/** One checklist cell on the roster: ✓ 265d, ! 25d, ✕ 12d late, Missing… */
export function Cell({ item }: { item: ChecklistItem }) {
  if (item.missing) {
    return <span className={`${styles.cell} ${styles.miss} ${item.status === 'warn' ? styles.missWarn : ''}`}>{item.key === 'inq' ? 'Open' : 'Missing'}</span>;
  }
  if (item.status === 'na') return <span className={`${styles.cell} ${styles.na}`}>n/a</span>;
  const days = item.days == null || item.days > 999 ? '' : item.days < 0 ? `${-item.days}d late` : `${item.days}d`;
  return (
    <span className={`${styles.cell} ${styles[item.status]}`} title={item.sum}>
      <span aria-hidden="true">{ICON[item.status]}</span> {days}
    </span>
  );
}

/** A driver's overall status: Fully compliant, Audit warning, Critical… */
export function Stamp({ result }: { result: DriverResult }) {
  const text = result.status === 'ok' ? 'Fully compliant' : result.status === 'warn' ? 'Audit warning' : result.oos ? 'Critical · OOS risk' : 'Critical violation';
  return <span className={`${styles.stamp} ${styles[result.status]}`}>{text}</span>;
}

/** A small coloured label for one item's status. */
export function Pill({ status, missing }: { status: Status; missing?: boolean }) {
  const text = missing ? 'Missing' : { ok: 'OK', warn: 'Warning', crit: 'Critical', na: 'Not due' }[status];
  return <span className={`${styles.pill} ${styles[status]}`}>{text}</span>;
}

/** "12 days late", "due in 21 days", "due today". */
export function dueText(days: number | null) {
  if (days === null) return '';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} late`;
  if (days === 0) return 'due today';
  return `due in ${days} day${days === 1 ? '' : 's'}`;
}
