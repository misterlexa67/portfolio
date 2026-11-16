// Нижняя шторка: мягкая пружина без перелёта, закрытие свайпом вниз,
// на планшете и десктопе — аккуратное модальное окно по центру.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

let locks = 0;
function lockScroll(on: boolean) {
  locks += on ? 1 : -1;
  document.documentElement.classList.toggle('is-locked', locks > 0);
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'auto' | 'tall' | 'full';
  hero?: ReactNode;        // контент над заголовком (фото блюда)
  label?: string;
  className?: string;
}

export function Sheet({ open, onClose, title, children, footer, size = 'auto', hero, label, className = '' }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; dy: number; active: boolean } | null>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    lockScroll(true);
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    setTimeout(() => panel.current?.focus({ preventScroll: true }), 60);

    // клавиатура не должна перекрывать поля ввода
    const vv = window.visualViewport;
    const onVV = () => {
      if (!vv || !panel.current) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      panel.current.style.setProperty('--kb', `${kb}px`);
    };
    vv?.addEventListener('resize', onVV);
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches('input, textarea')) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    };
    panel.current?.addEventListener('focusin', onFocusIn);
    const p = panel.current;
    return () => {
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      vv?.removeEventListener('resize', onVV);
      p?.removeEventListener('focusin', onFocusIn);
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [mounted]);

  if (!mounted) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [data-no-drag]')) return;
    const inBody = body.current?.contains(target);
    if (inBody && (body.current?.scrollTop ?? 0) > 0) return;
    drag.current = { y: e.clientY, t: performance.now(), dy: 0, active: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (dy > 6) { d.active = true; panel.current.setPointerCapture?.(e.pointerId); panel.current.classList.add('is-dragging'); }
      else if (dy < -6) { drag.current = null; return; }
      else return;
    }
    d.dy = Math.max(0, dy);
    panel.current.style.transform = `translate3d(0, ${d.dy}px, 0)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active || !panel.current) return;
    panel.current.classList.remove('is-dragging');
    const velocity = d.dy / Math.max(1, performance.now() - d.t);
    panel.current.style.transform = '';
    if (d.dy > 110 || velocity > 0.6) onClose();
  };

  return createPortal(
    <div className={`sheet-root${visible ? ' is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={`sheet sheet--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet__grip" aria-hidden="true"><span /></div>
        <button className="sheet__close icon-btn" onClick={onClose} aria-label="Закрыть"><Icon name="close" size={20} /></button>
        <div ref={body} className="sheet__body">
          {hero}
          {title && <h2 id={titleId} className="sheet__title">{title}</h2>}
          {children}
        </div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Диалог подтверждения ---------- */

export function Confirm({ open, title, text, confirmLabel, cancelLabel = 'Отмена', danger, onConfirm, onClose, loading }: {
  open: boolean; title: string; text?: ReactNode; confirmLabel: string; cancelLabel?: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void; loading?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} className="sheet--dialog">
      {text && <p className="dialog-text">{text}</p>}
      <div className="dialog-actions">
        <button className={`btn btn--${danger ? 'danger' : 'primary'} btn--lg btn--block`} onClick={onConfirm} disabled={loading}>
          <span className="btn__content">{confirmLabel}</span>
        </button>
        <button className="btn btn--quiet btn--lg btn--block" onClick={onClose}><span className="btn__content">{cancelLabel}</span></button>
      </div>
    </Sheet>
  );
}
