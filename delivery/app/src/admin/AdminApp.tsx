import { useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, toFriendly } from '../api';
import { Icon, type IconName } from '../components/Icon';
import { Button } from '../components/ui';
import { Wordmark } from '../components/Chrome';
import { Dashboard } from './Dashboard';
import { OrdersAdmin } from './Orders';
import { RestaurantsAdmin } from './Restaurants';
import { MenuAdmin } from './Menu';
import { PromosAdmin } from './Promos';
import { ZonesAdmin } from './Zones';
import { SettingsAdmin } from './Settings';
import '../styles/admin.css';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/admin', label: 'Обзор', icon: 'chart', end: true },
  { to: '/admin/orders', label: 'Заказы', icon: 'list' },
  { to: '/admin/restaurants', label: 'Рестораны', icon: 'store' },
  { to: '/admin/menu', label: 'Меню', icon: 'cutlery' },
  { to: '/admin/promos', label: 'Промокоды', icon: 'tag' },
  { to: '/admin/zones', label: 'Зоны доставки', icon: 'map' },
  { to: '/admin/settings', label: 'Настройки', icon: 'settings' },
];

function Login({ onOk }: { onOk: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await api.admin.login(pin); onOk(); } catch (err) { setError(toFriendly(err).message); setPin(''); } finally { setBusy(false); }
  };
  return (
    <div className="a-login screen">
      <form className="a-login__card" onSubmit={submit}>
        <Wordmark to="/" />
        <h1 className="h2">Панель владельца</h1>
        <p className="muted">Управление ресторанами, меню, зонами и заказами без программиста.</p>
        <div className="a-login__demo"><Icon name="info" size={16} /> Демо-доступ: PIN <b>0000</b>. Настоящей авторизации нет.</div>
        <label className="field">
          <span className="field__label">PIN-код</span>
          <input className="input a-login__pin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus aria-invalid={!!error} />
        </label>
        {error && <p className="field__error" role="alert">{error}</p>}
        <Button size="lg" block loading={busy} disabled={pin.length < 4}>Войти</Button>
        <NavLink to="/" className="link link--muted a-login__back">← Вернуться в приложение</NavLink>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(api.admin.isAuthed());
  const navigate = useNavigate();
  if (!authed) return <Login onOk={() => setAuthed(true)} />;
  return (
    <div className="admin">
      <aside className="a-side">
        <div className="a-side__brand">
          <Wordmark to="/admin" />
          <span className="a-side__tag">владелец · демо</span>
        </div>
        <nav className="a-nav no-scrollbar" aria-label="Разделы панели">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `a-nav__item${isActive ? ' is-on' : ''}`}>
              <Icon name={n.icon} size={19} /><span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="a-side__foot">
          <a className="a-nav__item" href="#/" target="_blank" rel="noreferrer"><Icon name="eye" size={19} /><span>Открыть приложение</span></a>
          <button className="a-nav__item" onClick={() => { api.admin.logout(); setAuthed(false); navigate('/admin'); }}><Icon name="logout" size={19} /><span>Выйти</span></button>
        </div>
      </aside>
      <main className="a-main">
        <div className="a-demo"><Icon name="info" size={15} /> Демо-панель: изменения сохраняются в этом браузере и сразу видны в приложении.</div>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="restaurants" element={<RestaurantsAdmin />} />
          <Route path="menu" element={<MenuAdmin />} />
          <Route path="promos" element={<PromosAdmin />} />
          <Route path="zones" element={<ZonesAdmin />} />
          <Route path="settings" element={<SettingsAdmin />} />
        </Routes>
      </main>
    </div>
  );
}
