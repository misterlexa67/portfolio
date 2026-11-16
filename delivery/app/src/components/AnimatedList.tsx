// Список с анимацией: удалённые элементы плавно уходят, оставшиеся подъезжают (FLIP),
// новые появляются. Только transform и opacity.
import { useEffect, useLayoutEffect, useReducer, useRef, type ReactNode } from 'react';

const LEAVE_MS = 220;
const MOVE_MS = 260;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export type ItemPhase = 'idle' | 'entering' | 'leaving';

interface Props<T> {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T, phase: ItemPhase) => ReactNode;
  className?: string;
  itemClassName?: string;
}

export function AnimatedList<T>({ items, getKey, render, className = '', itemClassName = '' }: Props<T>) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const prevItems = useRef<T[]>(items);
  const leaving = useRef(new Map<string, { item: T; index: number; at: number }>());
  const entering = useRef(new Set<string>());
  const mounted = useRef(false);
  const box = useRef<HTMLUListElement>(null);
  const tops = useRef(new Map<string, number>());

  // сравнение с прошлым набором — прямо при рендере, чтобы ушедший элемент не мигнул
  if (prevItems.current !== items) {
    const now = new Set(items.map(getKey));
    const before = new Set(prevItems.current.map(getKey));
    prevItems.current.forEach((it, index) => {
      const k = getKey(it);
      if (!now.has(k) && !leaving.current.has(k)) leaving.current.set(k, { item: it, index, at: Date.now() });
    });
    items.forEach((it) => {
      const k = getKey(it);
      leaving.current.delete(k);
      if (mounted.current && !before.has(k)) entering.current.add(k);
    });
    prevItems.current = items;
  }

  // убираем ушедшие после анимации
  useEffect(() => {
    if (!leaving.current.size) return undefined;
    const t = setTimeout(() => {
      const limit = Date.now() - LEAVE_MS + 10;
      let changed = false;
      leaving.current.forEach((v, k) => { if (v.at <= limit) { leaving.current.delete(k); changed = true; } });
      if (changed) rerender();
    }, LEAVE_MS);
    return () => clearTimeout(t);
  });

  useEffect(() => { mounted.current = true; }, []);

  // FLIP: элементы, сменившие место, плавно доезжают
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const base = el.getBoundingClientRect().top;
    const next = new Map<string, number>();
    el.querySelectorAll<HTMLElement>(':scope > [data-key]').forEach((node) => {
      const k = node.dataset.key!;
      const top = node.getBoundingClientRect().top - base;
      next.set(k, top);
      const old = tops.current.get(k);
      if (old !== undefined && Math.abs(old - top) > 1 && !reduced() && node.dataset.phase !== 'leaving') {
        node.animate([{ transform: `translate3d(0, ${old - top}px, 0)` }, { transform: 'none' }], { duration: MOVE_MS, easing: EASE });
      }
    });
    tops.current = next;
    entering.current.clear();
  });

  const list: { item: T; key: string; phase: ItemPhase }[] = items.map((item) => {
    const key = getKey(item);
    return { item, key, phase: entering.current.has(key) ? 'entering' : 'idle' };
  });
  [...leaving.current.entries()]
    .sort((a, b) => a[1].index - b[1].index)
    .forEach(([key, v]) => list.splice(Math.min(v.index, list.length), 0, { item: v.item, key, phase: 'leaving' }));

  return (
    <ul className={className} ref={box}>
      {list.map(({ item, key, phase }) => (
        <li key={key} data-key={key} data-phase={phase} className={`${itemClassName} anim-item anim-item--${phase}`} aria-hidden={phase === 'leaving' || undefined}>
          {render(item, phase)}
        </li>
      ))}
    </ul>
  );
}

/** Сколько ещё «уходят» элементов — чтобы пустое состояние не появлялось раньше времени. */
export const LEAVE_DURATION = LEAVE_MS;
