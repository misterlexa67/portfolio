import { useEffect, useState } from 'react';
import { api } from '../api';
import { Icon, type IconName } from '../components/Icon';
import { Spinner, useToast } from '../components/ui';
import { humanError } from '../lib/hooks';
import { Logo } from '../sections/chrome/Chrome';
import { Dashboard } from './Dashboard';
import { Leads } from './Leads';
import { CalendarAdmin } from './CalendarAdmin';
import { Prices } from './Prices';
import { ProjectsAdmin } from './ProjectsAdmin';
import { FaqAdmin } from './FaqAdmin';
import { TextsAdmin } from './TextsAdmin';
import { CabinetAdmin } from './CabinetAdmin';
import './admin.css';

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Обзор', icon: 'grid' },
  { id: 'leads', label: 'Заявки', icon: 'list' },
  { id: 'calendar', label: 'Календарь', icon: 'calendar' },
  { id: 'prices', label: 'Цены', icon: 'coins' },
  { id: 'projects', label: 'Объекты', icon: 'pin' },
  { id: 'faq', label: 'FAQ', icon: 'info' },
  { id: 'texts', label: 'Тексты', icon: 'edit' },
  { id: 'cabinet', label: 'Кабинет', icon: 'user' },
];

export function useHashRoute(): [string, string | undefined, (r: string) => void] {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => { setRoute(read()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [tab, id] = route.split('/');
  return [tab, id, (r: string) => { window.location.hash = `/${r}`; }];
}

export function AdminApp() {
  const [authed, setAuthed] = useState(() => api.auth.session().admin);
  return authed ? <Shell onLogout={() => setAuthed(false)} /> : <PinGate onOk={() => setAuthed(true)} />;
}

function PinGate({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api.auth.adminLogin(pin); onOk(); } catch (ex) { setErr(humanError(ex)); setPin(''); } finally { setBusy(false); }
  };
  return (
    <>
      <main className="adm-gate">
        <form className="adm-gate-card" onSubmit={submit}>
          <Logo href="../" />
          <h1 className="display">Панель владельца</h1>
          <p className="small muted">Заявки, замеры, цены и контент сайта — без программиста.</p>
          <label className="field"><span>PIN-код</span>
            <input className="input adm-pin num" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-invalid={!!err || undefined} autoFocus />
          </label>
          <p className="adm-pin-hint">PIN: 0000</p>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-primary btn-block" disabled={pin.length < 4 || busy}>{busy ? <Spinner /> : <Icon name="lock" size={18} />} Войти</button>
        </form>
      </main>
    </>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [tab, id, go] = useHashRoute();
  const toast = useToast();
  const logout = async () => { await api.auth.logout('admin'); onLogout(); };
  const reset = async () => {
    if (!window.confirm('Вернуть все данные к исходным? Заявки, цены и тексты сбросятся.')) return;
    await api.demo.reset();
    toast('Данные восстановлены', 'ok');
  };
  return (
    <div className="adm">
      <header className="adm-hdr">
        <div className="adm-hdr-in">
          <Logo href="../" />
          <span className="mono adm-k">Панель владельца</span>
          <a className="btn btn-s btn-ghost adm-site" href="../" target="_blank" rel="noopener"><Icon name="external" size={16} /> <span>Открыть сайт</span></a>
          <button className="btn btn-s btn-quiet" onClick={reset} title="Сбросить данные"><Icon name="settings" size={16} /><span className="adm-hide-s">Сброс</span></button>
          <button className="btn btn-s btn-quiet" onClick={logout} aria-label="Выйти"><Icon name="logout" size={16} /></button>
        </div>
        <nav className="adm-tabs" aria-label="Разделы панели">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={`adm-tab${tab === t.id ? ' on' : ''}`} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={18} /><span>{t.label}</span>
            </a>
          ))}
        </nav>
      </header>
      <main className="adm-main">
        {tab === 'dashboard' && <Dashboard go={go} />}
        {tab === 'leads' && <Leads id={id} go={go} />}
        {tab === 'calendar' && <CalendarAdmin go={go} />}
        {tab === 'prices' && <Prices />}
        {tab === 'projects' && <ProjectsAdmin />}
        {tab === 'faq' && <FaqAdmin />}
        {tab === 'texts' && <TextsAdmin />}
        {tab === 'cabinet' && <CabinetAdmin />}
      </main>
    </div>
  );
}

/* ---------- общие поля ---------- */

export function NumField({ label, value, onChange, step = 1, suffix, min = 0, max }: {
  label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string; min?: number; max?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { if (Number(text.replace(',', '.')) !== value) setText(String(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="nf">
      <span>{label}</span>
      <span className="nf-in">
        <input
          className="input num" inputMode="decimal" value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(',', '.').replace(/\s/g, ''));
            if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n);
          }}
          step={step}
        />
        {suffix && <span className="nf-suf">{suffix}</span>}
      </span>
    </label>
  );
}

export function AdmHead({ title, children, sub }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="adm-head">
      <div><h1 className="display">{title}</h1>{sub && <p className="small muted">{sub}</p>}</div>
      {children && <div className="adm-head-act">{children}</div>}
    </div>
  );
}
