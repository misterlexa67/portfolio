import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ACTIVE, STATUS_LABEL, toFriendly } from '../api';
import { useQuery } from '../lib/useQuery';
import { useStore } from '../components/AppStore';
import { useToast } from '../components/Toast';
import { Confirm } from '../components/Sheet';
import { Button, EmptyState, ErrorState, Img, Money, Segmented, Skeleton } from '../components/ui';
import { Icon } from '../components/Icon';
import { RestaurantCard } from '../components/RestaurantCard';
import { DemoFooter } from '../components/Chrome';
import { plural, rub, when } from '../lib/format';

function WalletCard() {
  const { wallet, openTopUp } = useStore();
  const [open, setOpen] = useState(false);
  const tx = wallet?.transactions ?? [];
  return (
    <section className="wallet-card" aria-labelledby="w-title">
      <div className="wallet-card__top">
        <div>
          <p className="wallet-card__label" id="w-title">Баланс</p>
          <p className="wallet-card__value">{wallet ? <Money value={wallet.balance} /> : <Skeleton w={120} h={36} />}</p>
          <p className="wallet-card__note">Для оплаты заказов и чаевых</p>
        </div>
        <span className="wallet-card__icon"><Icon name="wallet" size={24} /></span>
      </div>
      <Button size="lg" block onClick={() => openTopUp()} icon="plus">Пополнить баланс</Button>
      {tx.length > 0 && (
        <>
          <ul className="tx-list">
            {(open ? tx : tx.slice(0, 3)).map((t) => (
              <li key={t.id} className="tx">
                <span className="tx__title">{t.title}<span className="tx__when">{when(t.at)}</span></span>
                <span className={`tx__amount price${t.amount > 0 ? ' is-plus' : ''}`}>{t.amount > 0 ? '+' : '−'}{rub(Math.abs(t.amount))}</span>
              </li>
            ))}
          </ul>
          {tx.length > 3 && <button className="link link--muted" onClick={() => setOpen((v) => !v)}>{open ? 'Свернуть' : `Все операции (${tx.length})`}</button>}
        </>
      )}
    </section>
  );
}

function Orders() {
  const { repeatOrder } = useStore();
  const q = useQuery(() => api.orders.list(), [], ['orders']);
  const [showAll, setShowAll] = useState(false);
  if (q.loading) return <div className="stack-8">{[0, 1].map((i) => <Skeleton key={i} w="100%" h={96} r={20} />)}</div>;
  if (q.error) return <ErrorState message={q.error.message} onRetry={q.reload} />;
  const list = q.data ?? [];
  if (!list.length) return <EmptyState art="receipt" title="Заказов пока нет" text="Первый заказ появится здесь — его можно будет повторить в одно касание." action={<Link to="/" className="btn btn--secondary btn--md"><span className="btn__content">Выбрать ресторан</span></Link>} />;
  return (
    <>
      <ul className="orders-list">
        {(showAll ? list : list.slice(0, 4)).map((o) => {
          const activeNow = ACTIVE.includes(o.status);
          return (
            <li key={o.id} className="order-row">
              <Link to={`/order/${o.id}`} className="order-row__main">
                <span className="order-row__img"><Img src={o.lines[0]?.image ?? o.restaurant.image} alt="" /></span>
                <span className="order-row__text">
                  <b>{o.restaurant.name}</b>
                  <span className="order-row__sub">{when(o.createdAt)} · {o.lines.reduce((s, l) => s + l.qty, 0)} {plural(o.lines.reduce((s, l) => s + l.qty, 0), 'блюдо', 'блюда', 'блюд')}</span>
                  <span className={`status-pill status-pill--${activeNow ? 'active' : o.status}`}>{STATUS_LABEL[o.status]}</span>
                </span>
                <span className="order-row__sum price">{rub(o.totals.total)}</span>
              </Link>
              {!activeNow && <Button variant="secondary" size="sm" icon="refresh" onClick={() => repeatOrder(o.id)}>Повторить</Button>}
              {activeNow && <Link to={`/order/${o.id}`} className="btn btn--primary btn--sm"><span className="btn__content">Отследить</span></Link>}
            </li>
          );
        })}
      </ul>
      {list.length > 4 && <button className="link link--muted" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Свернуть' : `Показать все (${list.length})`}</button>}
    </>
  );
}

function Favorites() {
  const [tab, setTab] = useState<'r' | 'd'>('r');
  const store = useStore();
  const q = useQuery(() => api.profile.favorites(), [], ['profile', 'catalog']);
  const list = q.data;
  return (
    <>
      <Segmented label="Избранное" value={tab} onChange={setTab} options={[{ value: 'r', label: 'Рестораны' }, { value: 'd', label: 'Блюда' }]} />
      {q.loading && <Skeleton w="100%" h={120} r={20} />}
      {list && tab === 'r' && (list.restaurants.length
        ? <div className="rgrid rgrid--compact">{list.restaurants.map((r) => <RestaurantCard key={r.id} card={r} />)}</div>
        : <EmptyState art="heart" title="Пока нет любимых ресторанов" text="Нажмите на сердечко на карточке ресторана — он появится здесь." />)}
      {list && tab === 'd' && (list.dishes.length
        ? (
          <ul className="slist">
            {list.dishes.map(({ dish, restaurantName }) => (
              <li key={dish.id} className={`srow${dish.available ? '' : ' is-off'}`}>
                <button className="srow__main" onClick={() => store.openDish(dish.id)}>
                  <span className="srow__img srow__img--dish"><Img src={dish.image} alt="" /></span>
                  <span className="srow__text">
                    <span className="srow__title">{dish.name}</span>
                    <span className="srow__sub">{restaurantName}{dish.available ? '' : ' · нет в наличии'}</span>
                    <span className="price srow__price">{rub(dish.price)}</span>
                  </span>
                </button>
                <button className="icon-btn fav-inline is-on" aria-label={`Убрать «${dish.name}» из избранного`} onClick={() => store.toggleFavoriteDish(dish.id)}><Icon name="heart" size={20} filled /></button>
              </li>
            ))}
          </ul>
        )
        : <EmptyState art="heart" title="Нет избранных блюд" text="Откройте блюдо и нажмите на сердечко, чтобы быстро находить его потом." />)}
    </>
  );
}

function Addresses() {
  const { profile, openAddress } = useStore();
  const toast = useToast();
  const [removeId, setRemoveId] = useState<string | null>(null);
  if (!profile) return <Skeleton w="100%" h={80} r={16} />;
  return (
    <>
      {profile.addresses.length === 0 && <EmptyState art="map" title="Адресов пока нет" text="Добавьте адрес — покажем рестораны, которые до вас доставляют." />}
      <ul className="addr-list">
        {profile.addresses.map((a) => (
          <li key={a.id} className={`addr-row${a.id === profile.selectedAddressId ? ' is-on' : ''}`}>
            <button className="addr-row__main" onClick={async () => { await api.profile.selectAddress(a.id); toast({ text: `Доставим: ${a.street}`, icon: 'pin' }); }}>
              <span className="addr-row__icon"><Icon name={a.label === 'Дом' ? 'home' : a.label === 'Работа' ? 'store' : 'pin'} size={20} /></span>
              <span className="addr-row__text">
                <span className="addr-row__street">{a.street}</span>
                <span className="addr-row__sub">{[a.label, a.district].filter(Boolean).join(' · ')}</span>
              </span>
              {a.id === profile.selectedAddressId && <Icon name="check" size={20} className="addr-row__check" />}
            </button>
            <button className="icon-btn" aria-label={`Удалить адрес ${a.street}`} onClick={() => setRemoveId(a.id)}><Icon name="trash" size={18} /></button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" icon="plus" onClick={openAddress}>Добавить адрес</Button>
      <Confirm
        open={!!removeId}
        title="Удалить адрес?"
        text="Его можно будет добавить заново в любой момент."
        confirmLabel="Удалить"
        danger
        onConfirm={async () => { const id = removeId!; setRemoveId(null); await api.profile.removeAddress(id); toast({ text: 'Адрес удалён', icon: 'trash' }); }}
        onClose={() => setRemoveId(null)}
      />
    </>
  );
}

export function ProfileScreen() {
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      await api.profile.resetDemo();
      setConfirmReset(false);
      toast({ text: 'Данные сброшены: баланс, заказы и корзина как в первый раз', tone: 'success' });
      navigate('/');
    } catch (e) { toast({ text: toFriendly(e).message, tone: 'danger' }); } finally { setBusy(false); }
  };

  return (
    <div className="screen profile">
      <div className="container profile__head">
        <span className="profile__avatar" aria-hidden="true"><Icon name="user" size={26} /></span>
        <div>
          <h1 className="h1">Профиль</h1>
          <p className="muted">Гость</p>
        </div>
      </div>
      <div className="container profile__grid">
        <div className="profile__col">
          <WalletCard />
          <section className="p-sec" aria-labelledby="p-orders"><h2 className="h3" id="p-orders">Мои заказы</h2><Orders /></section>
        </div>
        <div className="profile__col">
          <section className="p-sec" aria-labelledby="p-fav"><h2 className="h3" id="p-fav">Избранное</h2><Favorites /></section>
          <section className="p-sec" aria-labelledby="p-addr"><h2 className="h3" id="p-addr">Адреса</h2><Addresses /></section>
          <section className="p-sec p-sec--quiet">
            <Link to="/admin" className="p-link"><Icon name="lock" size={20} /><span><b>Панель владельца</b><span className="muted t-sm">PIN: 0000</span></span><Icon name="chevronRight" size={18} /></Link>
            <button className="p-link p-link--danger" onClick={() => setConfirmReset(true)}><Icon name="refresh" size={20} /><span><b>Сбросить данные</b><span className="muted t-sm">Баланс, заказы, корзина и адреса — как при первом входе</span></span></button>
          </section>
        </div>
      </div>
      <DemoFooter />
      <Confirm
        open={confirmReset}
        title="Сбросить данные?"
        text="Вернём стартовый баланс, очистим заказы, корзину, избранное и адреса. Меню ресторанов останется как настроил владелец."
        confirmLabel="Сбросить"
        danger
        loading={busy}
        onConfirm={reset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
