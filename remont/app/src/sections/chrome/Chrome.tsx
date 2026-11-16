import { useEffect, useState } from 'react';
import { api, catalog, describeParams } from '../../api';
import { Icon } from '../../components/Icon';
import { useToast, useMagnet } from '../../components/ui';
import { scrollToId, useCalc } from '../../state/calc';
import { MESSENGERS, useNearest, useTexts } from '../shared';
import { telHref } from '../../lib/format';
import './chrome.css';

export function Logo({ href = './' }: { href?: string }) {
  return (
    <a className="logo" href={href} aria-label="Метр — на главную">
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 29V12l10 9 10-9v17" fill="none" stroke="var(--clay)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M8 33.5h24" stroke="currentColor" strokeWidth="1" />
        <path d="M8 32v3M32 32v3M20 32.5v2" stroke="currentColor" strokeWidth="1" />
      </svg>
      <span className="logo-word">Метр</span>
    </a>
  );
}

export function DemoBar() {
  return (
    <div className="demobar" role="note">
      <span className="mono">Демо-концепт, бизнес вымышленный</span>
      <span className="demobar-sep" aria-hidden="true" />
      <span className="demobar-hide mono">Заявки и сообщения никуда не отправляются</span>
    </div>
  );
}

const NAV = [
  { id: 'dom', label: 'Ваш дом' },
  { id: 'calc', label: 'Калькулятор' },
  { id: 'objects', label: 'Объекты' },
  { id: 'process', label: 'Как работаем' },
  { id: 'faq', label: 'Вопросы' },
];

export function Header() {
  const texts = useTexts();
  const [scrolled, setScrolled] = useState(false);
  const magnet = useMagnet();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`hdr${scrolled ? ' hdr-on' : ''}`}>
      <div className="wrap hdr-in">
        <Logo />
        <nav className="hdr-nav" aria-label="Разделы">
          {NAV.map((n) => <a key={n.id} href={`#${n.id}`} className="link">{n.label}</a>)}
        </nav>
        <div className="hdr-right">
          {texts && <a className="hdr-phone num" href={telHref(texts.contacts.phone)}>{texts.contacts.phone}</a>}
          <a className="btn btn-s btn-ghost hdr-cab" href="./cabinet/"><Icon name="user" size={18} /> <span>Кабинет</span></a>
          <button className="btn btn-s btn-primary hdr-zamer" onPointerMove={magnet} onClick={() => scrollToId('zamer')}>Замер</button>
        </div>
      </div>
    </header>
  );
}

/** Липкая панель на телефоне: «Рассчитать ремонт» + «Замер». */
export function StickyBar() {
  const [hidden, setHidden] = useState(false);
  const [past, setPast] = useState(false);
  useEffect(() => {
    // показываем панель, только когда кнопки первого экрана ушли из вида
    const cta = document.querySelector('.hero-cta');
    if (!cta || !('IntersectionObserver' in window)) { setPast(true); return; }
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(cta);
    return () => io.disconnect();
  }, []);
  const nearest = useNearest();
  useEffect(() => {
    // прячем, когда открыта клавиатура (фокус в поле) или видна форма записи
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.matches('input, textarea, select')) setHidden(true);
    };
    const onBlur = () => setHidden(false);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', onBlur);
    const target = document.getElementById('zamer-form');
    let io: IntersectionObserver | undefined;
    if (target && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => document.body.classList.toggle('booking-visible', e.isIntersecting), { threshold: 0.15 });
      io.observe(target);
    }
    return () => { document.removeEventListener('focusin', onFocus); document.removeEventListener('focusout', onBlur); io?.disconnect(); };
  }, []);
  return (
    <div className={`sticky${hidden || !past ? ' sticky-hide' : ''}`} aria-label="Быстрые действия">
      {nearest.slot && <div className="sticky-near mono">{nearest.text}</div>}
      <div className="sticky-row">
        <button className="btn btn-primary" onClick={() => scrollToId('calc')}>Рассчитать ремонт</button>
        <button className="btn btn-ghost sticky-zamer" onClick={() => scrollToId('zamer')}><Icon name="calendar" size={18} /> Замер</button>
      </div>
    </div>
  );
}

/** «Продолжить расчёт» для вернувшегося посетителя. */
export function ContinueBanner() {
  const { restore, shared } = useCalc();
  const [draft] = useState(() => (new URLSearchParams(window.location.search).get('calc') ? null : api.drafts.get()));
  const [open, setOpen] = useState(!!draft && !shared);
  if (!open || !draft) return null;
  return (
    <div className="continue" role="dialog" aria-label="Продолжить расчёт">
      <div className="continue-txt">
        <b>Продолжить расчёт?</b>
        <span className="small muted">{describeParams(draft.params)}</span>
      </div>
      <div className="continue-act">
        <button className="btn btn-s btn-primary" onClick={() => { restore(draft.params, draft.origin); setOpen(false); window.setTimeout(() => scrollToId('calc'), 50); }}>Продолжить расчёт</button>
        <button className="modal-close" aria-label="Скрыть" onClick={() => { api.drafts.clear(); setOpen(false); }}><Icon name="close" size={18} /></button>
      </div>
    </div>
  );
}

export function MessengerButtons({ compact }: { compact?: boolean }) {
  const toast = useToast();
  const texts = useTexts();
  return (
    <div className={`msg${compact ? ' msg-compact' : ''}`}>
      {MESSENGERS.map((m) => (
        <button key={m.id} className="btn btn-s btn-msg" onClick={() => {
          const handle = texts ? (texts.contacts as Record<string, string>)[m.id] : '';
          toast(<>Демо: здесь откроется чат в {m.label}{handle ? ` (${handle})` : ''}. Ничего не отправляется.</>);
        }}>
          <Icon name={m.icon} size={18} /> Написать в {m.label}
        </button>
      ))}
    </div>
  );
}

export function Footer() {
  const texts = useTexts();
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-top">
          <div className="ftr-brand">
            <Logo />
            <p className="ftr-claim display">Ремонт, в котором понятно, <em>за что вы платите</em>.</p>
          </div>
          <div className="ftr-col">
            <h4 className="mono">Контакты</h4>
            {texts && (
              <ul>
                <li><a className="link num" href={telHref(texts.contacts.phone)}>{texts.contacts.phone}</a></li>
                <li><a className="link" href={`mailto:${texts.contacts.email}`}>{texts.contacts.email}</a></li>
                <li className="muted">{texts.contacts.address}</li>
                <li className="muted">{texts.contacts.hours}</li>
              </ul>
            )}
          </div>
          <div className="ftr-col">
            <h4 className="mono">Работаем в районах</h4>
            <ul className="ftr-districts">{catalog.districts.map((d) => <li key={d.id}>{d.name}</li>)}</ul>
          </div>
          <div className="ftr-col">
            <h4 className="mono">Ещё</h4>
            <ul>
              <li><a className="link" href="./cabinet/">Кабинет клиента (демо)</a></li>
              <li><a className="link" href="./admin/">Панель владельца (демо)</a></li>
              <li><a className="link" href="./privacy/">Политика конфиденциальности</a></li>
            </ul>
          </div>
        </div>
        <MessengerButtons compact />
        <div className="ftr-bottom mono">
          <span>Демо-концепт, бизнес вымышленный</span>
          <span>Нижний Новгород · {new Date().getFullYear()}</span>
          <span>Все иллюстрации нарисованы кодом, фото не используются</span>
        </div>
      </div>
    </footer>
  );
}
