import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { rollNumber } from '../lib/motion';
import { maskPhone } from '../lib/format';
import './ui.css';

/* ---------- Модальное окно / шторка ---------- */

export function Modal({ open, onClose, title, children, wide, label }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean; label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], .modal-close')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : label}>
        <div className="modal-head">
          {title ? <h3 id={titleId} className="modal-title">{title}</h3> : <span />}
          <button className="modal-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Подсказка «что входит» ---------- */

export function Popover({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [side, setSide] = useState<'left' | 'right'>('left');
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setSide(r.left > window.innerWidth / 2 ? 'right' : 'left');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span className={`pop ${className ?? ''}`} ref={ref}>
      <button type="button" className="pop-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <span id={id} role="dialog" className={`pop-body pop-${side}`}>
          {children}
        </span>
      )}
    </span>
  );
}

/* ---------- Тосты ---------- */

interface Toast { id: number; text: ReactNode; tone?: 'info' | 'ok' | 'warn' }
const ToastCtx = createContext<(text: ReactNode, tone?: Toast['tone']) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: ReactNode, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setItems([{ id, text, tone }]); // по одному: новый заменяет предыдущий
    window.setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'ok' && <Icon name="check" size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Прокрутка чисел ---------- */

export function Rolling({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const cur = useRef(value);
  useEffect(() => rollNumber(cur.current, value, (v) => { cur.current = v; setShown(v); }), [value]);
  return <span className={`num ${className ?? ''}`} aria-live="polite">{format(shown)}</span>;
}

/* ---------- Сегментированный выбор ---------- */

export function Segmented<T extends string | number>({ value, options, onChange, label, className }: {
  value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; className?: string;
}) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`seg ${className ?? ''}`} role="radiogroup" aria-label={label}>
      <span className="seg-thumb" style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${idx * 100}%)` }} />
      {options.map((o) => (
        <button
          key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const n = (idx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
              onChange(options[n].value);
            }
          }}
          tabIndex={o.value === value ? 0 : -1}
        >{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Телефон с маской ---------- */

export function PhoneInput({ value, onChange, invalid, id, describedBy }: {
  value: string; onChange: (v: string) => void; invalid?: boolean; id?: string; describedBy?: string;
}) {
  return (
    <input
      id={id} className="input num" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__"
      value={value} aria-invalid={invalid || undefined} aria-describedby={describedBy}
      onFocus={() => { if (!value) onChange('+7'); }}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').length <= 1 && e.target.value.length < 3 ? e.target.value : maskPhone(e.target.value))}
      onBlur={() => { if (value === '+7') onChange(''); }}
    />
  );
}

/* ---------- Кнопка с бликом за курсором ---------- */

export function useMagnet() {
  return (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
}

export function Spinner() { return <span className="spinner" aria-hidden="true" />; }

/* ---------- Бейдж изменения суммы: «+12 300 ₽» / «−8 000 ₽» ---------- */

export function DeltaBadge({ value, format, className }: { value: number | undefined; format: (n: number) => string; className?: string }) {
  const prev = useRef<number | undefined>(value);
  const [delta, setDelta] = useState<{ d: number; id: number } | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = value;
    if (p === undefined || value === undefined || p === value) return;
    setDelta({ d: value - p, id: Date.now() });
    const t = window.setTimeout(() => setDelta(null), 1600);
    return () => window.clearTimeout(t);
  }, [value]);
  if (!delta) return <span className={`delta ${className ?? ''}`} aria-hidden="true" />;
  return (
    <span key={delta.id} className={`delta delta-on ${delta.d > 0 ? 'up' : 'down'} ${className ?? ''}`} aria-live="polite">
      {delta.d > 0 ? '+' : '−'}{format(Math.abs(delta.d))}
    </span>
  );
}

/** Короткая подсветка элементов, которые поменялись (ключи + момент). */
export function useFlash(changed: { keys: string[]; at: number }, ms = 1900) {
  const [active, setActive] = useState<string[]>([]);
  useEffect(() => {
    if (!changed.at) return;
    setActive(changed.keys);
    const t = window.setTimeout(() => setActive([]), ms);
    return () => window.clearTimeout(t);
  }, [changed.at]); // eslint-disable-line react-hooks/exhaustive-deps
  return (k: string) => (active.includes(k) ? ' flash' : '');
}
