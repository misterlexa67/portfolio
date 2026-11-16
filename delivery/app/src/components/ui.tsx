import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { rub } from '../lib/format';

/* ---------- Кнопка ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: IconName;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, children, className = '', disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''}${loading ? ' is-loading' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span className="btn__content">
        {icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
        {children}
      </span>
    </button>
  );
});

export function IconButton({ icon, label, className = '', size = 22, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: number }) {
  return (
    <button className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ---------- Катящиеся цифры ---------- */

export function Rolling({ value, format = (v: number) => String(v) }: { value: number; format?: (v: number) => string }) {
  const [shown, setShown] = useState({ cur: value, prev: value, dir: 0, key: 0 });
  useEffect(() => {
    setShown((s) => (s.cur === value ? s : { cur: value, prev: s.cur, dir: value > s.cur ? 1 : -1, key: s.key + 1 }));
  }, [value]);
  return (
    <span className="roll num" aria-live="polite">
      <span key={shown.key} className={`roll__in${shown.dir > 0 ? ' up' : shown.dir < 0 ? ' down' : ''}`}>{format(shown.cur)}</span>
      {shown.dir !== 0 && <span key={`o${shown.key}`} className={`roll__out${shown.dir > 0 ? ' up' : ' down'}`} aria-hidden="true">{format(shown.prev)}</span>}
    </span>
  );
}

export const Money = ({ value, className = '' }: { value: number; className?: string }) => (
  <span className={`price ${className}`}><Rolling value={value} format={rub} /></span>
);

/* ---------- Степпер ---------- */

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md';
  label?: string;
  disabled?: boolean;
  zeroLabel?: string;
}

export function Stepper({ value, onChange, min = 0, max = 50, size = 'md', label = 'Количество', disabled, zeroLabel }: StepperProps) {
  return (
    <div className={`stepper stepper--${size}`} role="group" aria-label={label}>
      <button type="button" className="stepper__btn" onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Уменьшить">
        <Icon name="minus" size={18} stroke={2} />
      </button>
      <span className="stepper__value">{value === 0 && zeroLabel ? <span className="t-sm">{zeroLabel}</span> : <Rolling value={value} />}</span>
      <button type="button" className="stepper__btn" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Увеличить">
        <Icon name="plus" size={18} stroke={2} />
      </button>
    </div>
  );
}

/* ---------- Скелетоны ---------- */

export const Skeleton = ({ w, h, r, className = '' }: { w?: number | string; h?: number | string; r?: number; className?: string }) => (
  <span className={`skeleton ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
);

/* ---------- Пустые состояния ---------- */

const ILLUSTRATIONS = {
  bag: (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="38" ry="5" fill="var(--c-surface-2)" />
      <path d="M30 34h60l-5 46a4 4 0 0 1-4 3.5H39A4 4 0 0 1 35 80z" fill="var(--c-surface)" stroke="var(--c-line-strong)" strokeWidth="1.5" />
      <path d="M46 34v-5a14 14 0 0 1 28 0v5" fill="none" stroke="var(--c-ink-3)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="60" cy="58" r="9" fill="var(--c-accent-tint)" />
      <path d="M56 58h8" stroke="var(--c-accent)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="38" ry="5" fill="var(--c-surface-2)" />
      <circle cx="54" cy="44" r="24" fill="var(--c-surface)" stroke="var(--c-line-strong)" strokeWidth="1.5" />
      <path d="m72 62 14 14" stroke="var(--c-ink-3)" strokeWidth="3" strokeLinecap="round" />
      <path d="M45 46c3-4 15-4 18 0" fill="none" stroke="var(--c-accent)" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="47" cy="38" r="2" fill="var(--c-ink-3)" /><circle cx="61" cy="38" r="2" fill="var(--c-ink-3)" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="38" ry="5" fill="var(--c-surface-2)" />
      <path d="M60 74S32 58 32 38a14 14 0 0 1 28-4 14 14 0 0 1 28 4c0 20-28 36-28 36z" fill="var(--c-surface)" stroke="var(--c-line-strong)" strokeWidth="1.5" />
      <path d="M50 40a6 6 0 0 1 8-3" fill="none" stroke="var(--c-accent)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="38" ry="5" fill="var(--c-surface-2)" />
      <path d="M38 14h44v66l-7-5-7 5-8-5-8 5-7-5-7 5z" fill="var(--c-surface)" stroke="var(--c-line-strong)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M48 32h24M48 42h24M48 52h14" stroke="var(--c-ink-3)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="70" cy="58" r="5" fill="var(--c-accent-tint)" stroke="var(--c-accent)" strokeWidth="1.5" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 120 96" aria-hidden="true">
      <ellipse cx="60" cy="86" rx="38" ry="5" fill="var(--c-surface-2)" />
      <path d="m26 26 22-8 24 8 22-8v54l-22 8-24-8-22 8z" fill="var(--c-surface)" stroke="var(--c-line-strong)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M26 50c20-6 40 8 68-4" fill="none" stroke="var(--c-map-water-edge)" strokeWidth="5" strokeLinecap="round" />
      <path d="M60 52s-9-8-9-15a9 9 0 0 1 18 0c0 7-9 15-9 15z" fill="var(--c-accent)" />
      <circle cx="60" cy="37" r="3" fill="#fff" />
    </svg>
  ),
};

export function EmptyState({ art, title, text, action }: { art: keyof typeof ILLUSTRATIONS; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty fade-in">
      <div className="empty__art">{ILLUSTRATIONS[art]}</div>
      <h3 className="h3">{title}</h3>
      {text && <p className="empty__text">{text}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

/* ---------- Ошибка загрузки ---------- */

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state fade-in" role="alert">
      <Icon name="info" size={22} />
      <p>{message}</p>
      {onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Повторить</Button>}
    </div>
  );
}

/* ---------- Заметка / баннер ---------- */

export function Note({ tone = 'neutral', icon = 'info', children, action }: { tone?: 'neutral' | 'warn' | 'danger' | 'success' | 'accent'; icon?: IconName; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`note note--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon name={icon} size={20} />
      <div className="note__body">{children}</div>
      {action && <div className="note__action">{action}</div>}
    </div>
  );
}

/* ---------- Переключатель ---------- */

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle__knob" />
    </button>
  );
}

/* ---------- Сегменты ---------- */

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`segmented__item${value === o.value ? ' is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Изображение с плавной загрузкой ---------- */

export function Img({ src, alt, className = '', eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => { if (ref.current?.complete) setLoaded(true); }, [src]);
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`img${loaded ? ' is-loaded' : ''} ${className}`}
      onLoad={() => setLoaded(true)}
      draggable={false}
    />
  );
}

export const Price = ({ value, old, className = '' }: { value: number; old?: number | null; className?: string }) => (
  <span className={`price-tag ${className}`}>
    <span className={`price${old ? ' price--sale' : ''}`}>{rub(value)}</span>
    {old ? <s className="price price--old">{rub(old)}</s> : null}
  </span>
);
