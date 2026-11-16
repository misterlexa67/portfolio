import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { STATUS_LABEL } from '../api';
import { Icon } from './Icon';
import { Rolling, Money } from './ui';
import { useStore } from './AppStore';
import { rub } from '../lib/format';

export function Wordmark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="wordmark" aria-label="доставка.есть — на главную">
      доставка<span className="wordmark__dot">.</span>есть
    </Link>
  );
}

export function BalancePill() {
  const { wallet, openTopUp } = useStore();
  return (
    <button className="balance" onClick={() => openTopUp()} aria-label={`Демо-баланс ${rub(wallet?.balance ?? 0)}. Пополнить`}>
      <Icon name="wallet" size={18} />
      <span className="balance__value">{wallet ? <Money value={wallet.balance} /> : '—'}</span>
      <span className="balance__tag">демо</span>
    </button>
  );
}

export function AddressButton({ compact }: { compact?: boolean }) {
  const { address, openAddress } = useStore();
  return (
    <button className={`addr-btn${compact ? ' addr-btn--compact' : ''}`} onClick={openAddress} aria-label={`Адрес доставки: ${address?.street ?? 'не выбран'}. Изменить`}>
      <span className="addr-btn__label">Куда доставить?</span>
      <span className="addr-btn__value">
        <span className="addr-btn__text">{address?.street ?? 'Укажите адрес'}</span>
        <Icon name="chevronDown" size={16} stroke={2} />
      </span>
    </button>
  );
}

/** Шапка: на телефоне — на главной, на десктопе — всегда. */
export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { quote } = useStore();
  return (
    <header className="app-header">
      <div className="app-header__inner container">
        <Wordmark />
        <AddressButton />
        <button className="header-search" onClick={() => navigate('/search')} aria-label="Поиск блюд и ресторанов">
          <Icon name="search" size={18} />
          <span>Блюда и рестораны</span>
        </button>
        <div className="app-header__right">
          <BalancePill />
          <NavLink to="/profile" className="header-link" aria-label="Профиль"><Icon name="user" size={22} /></NavLink>
          {location.pathname !== '/cart' && (
            <NavLink to="/cart" className="header-link header-link--cart" aria-label={`Корзина, ${quote?.count ?? 0}`}>
              <span data-cart-target=""><Icon name="bag" size={22} /></span>
              {!!quote?.count && <span className="nav-badge num"><Rolling value={quote.count} /></span>}
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { quote } = useStore();
  const items = [
    { to: '/', label: 'Главная', icon: 'home' as const, end: true },
    { to: '/search', label: 'Поиск', icon: 'search' as const },
    { to: '/cart', label: 'Корзина', icon: 'bag' as const, cart: true },
    { to: '/profile', label: 'Профиль', icon: 'user' as const },
  ];
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}>
          <span className="bottom-nav__icon" data-cart-target={i.cart ? '' : undefined}>
            <Icon name={i.icon} size={24} />
            {i.cart && !!quote?.count && <span className="nav-badge num"><Rolling value={quote.count} /></span>}
          </span>
          <span className="bottom-nav__label">{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function PageHeader({ title, back = true, right, sub }: { title: string; back?: boolean; right?: React.ReactNode; sub?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="page-header">
      <div className="page-header__inner container">
        {back && (
          <button className="icon-btn page-header__back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Назад">
            <Icon name="back" size={22} />
          </button>
        )}
        <div className="page-header__titles">
          <h1 className="page-header__title">{title}</h1>
          {sub && <p className="page-header__sub">{sub}</p>}
        </div>
        {right && <div className="page-header__right">{right}</div>}
      </div>
    </div>
  );
}

export function ActiveOrderBar() {
  const { active } = useStore();
  const location = useLocation();
  const first = active[0];
  if (!first || location.pathname.startsWith('/order')) return null;
  const { order, tracking } = first;
  return (
    <Link to={`/order/${order.id}`} className="active-order fade-in" aria-label={`Заказ №${order.number}: ${STATUS_LABEL[order.status]}`}>
      <span className="active-order__icon"><Icon name={order.status === 'cooking' || order.status === 'paid_demo' ? 'flame' : 'scooter'} size={20} /></span>
      <span className="active-order__text">
        <b>{STATUS_LABEL[order.status]}</b>
        <span>{order.restaurant.name} · №{order.number}</span>
      </span>
      {tracking.minutesLeft !== null && <span className="active-order__eta num">{tracking.minutesLeft ? `${tracking.minutesLeft} мин` : 'Уже здесь'}</span>}
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}

export function DemoFooter() {
  return (
    <footer className="demo-footer container">
      <p>Демо-концепт, сервис вымышленный. Рестораны, курьеры и цены придуманы, деньги — демо-баланс.</p>
      <Link to="/admin" className="demo-footer__link"><Icon name="lock" size={14} /> Панель владельца (демо)</Link>
    </footer>
  );
}
