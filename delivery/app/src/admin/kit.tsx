// Общие элементы панели владельца.
import { useState, type ReactNode } from 'react';
import { IMAGE_LIBRARY } from '../api';
import { Icon } from '../components/Icon';
import { Img } from '../components/ui';
import { Sheet } from '../components/Sheet';

export function AdminPage({ title, sub, actions, children }: { title: string; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="a-page screen">
      <header className="a-page__head">
        <div>
          <h1 className="a-page__title">{title}</h1>
          {sub && <p className="a-page__sub">{sub}</p>}
        </div>
        {actions && <div className="a-page__actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function F({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`a-field${wide ? ' a-field--wide' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function NumInput({ value, onChange, suffix, ...rest }: { value: number | string | null; onChange: (v: string) => void; suffix?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <span className="a-num">
      <input className="input" inputMode="numeric" value={value ?? ''} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} {...rest} />
      {suffix && <span className="a-num__suffix">{suffix}</span>}
    </span>
  );
}

export function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'accent'; children: ReactNode }) {
  return <span className={`a-pill a-pill--${tone}`}>{children}</span>;
}

/** Выбор фото из нарезанных ассетов — владельцу не нужно ничего загружать. */
export function ImagePicker({ value, onChange, label = 'Фото' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState(IMAGE_LIBRARY.find((g) => value.includes(`/${g.folder}/`))?.folder ?? IMAGE_LIBRARY[0].folder);
  const group = IMAGE_LIBRARY.find((g) => g.folder === folder)!;
  return (
    <div className="a-field">
      <span className="field__label">{label}</span>
      <button type="button" className="img-pick" onClick={() => setOpen(true)}>
        <span className="img-pick__thumb">{value ? <Img src={value} alt="" /> : <Icon name="plus" size={20} />}</span>
        <span>{value ? 'Сменить фото' : 'Выбрать фото'}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Фото блюда" size="tall">
        <div className="tabs no-scrollbar img-lib__tabs">
          {IMAGE_LIBRARY.map((g) => (
            <button key={g.folder} type="button" className={`tab${g.folder === folder ? ' is-on' : ''}`} onClick={() => setFolder(g.folder)}>{g.title}</button>
          ))}
        </div>
        <div className="img-lib">
          {group.names.map((n) => {
            const src = `assets/cut/${group.folder}/${n}.webp`;
            return (
              <button key={n} type="button" className={`img-lib__item${src === value ? ' is-on' : ''}`} onClick={() => { onChange(src); setOpen(false); }} aria-label={n}>
                <Img src={src} alt="" />
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

export function RowActions({ onUp, onDown, first, last, children }: { onUp: () => void; onDown: () => void; first: boolean; last: boolean; children?: ReactNode }) {
  return (
    <div className="a-row-actions">
      <button type="button" className="icon-btn icon-btn--sm" onClick={onUp} disabled={first} aria-label="Выше"><Icon name="arrowUp" size={16} /></button>
      <button type="button" className="icon-btn icon-btn--sm" onClick={onDown} disabled={last} aria-label="Ниже"><Icon name="arrowDown" size={16} /></button>
      {children}
    </div>
  );
}
