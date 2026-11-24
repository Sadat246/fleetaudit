import Link from 'next/link';
import type { FleetItem } from '@/lib/engine';
import shell from './shell.module.css';

/** Rows of "Driver — checklist item — problem", each linking to the driver's page. */
export function ItemList({ items, side }: { items: FleetItem[]; side: (x: FleetItem) => string }) {
  return (
    <ul className={shell.list}>
      {items.map((x) => (
        <li key={`${x.driver.id}-${x.item.key}`}>
          <Link href={`/drivers/${x.driver.id}`} className={shell.rowLink}>
            <span className={shell.rowMain}>{x.driver.first} {x.driver.last} · {x.item.label}</span>
            <span className={shell.rowSub}>{x.item.issues[0]?.text ?? x.item.sum}</span>
            <span className={`${shell.rowSide} ${x.item.status === 'crit' ? shell.critText : x.item.status === 'warn' ? shell.warnText : ''}`}>{side(x)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
