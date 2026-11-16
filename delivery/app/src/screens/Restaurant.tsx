import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useQuery } from '../lib/useQuery';
import { useStore } from '../components/AppStore';
import { Icon } from '../components/Icon';
import { Button, EmptyState, ErrorState, Money, Note, Skeleton } from '../components/ui';
import { RestaurantCover } from '../components/RestaurantCard';
import { DishCard, DishCardSkeleton } from '../components/DishCard';
import { eta, fee, plural, rating, ratingCount, rub } from '../lib/format';

export function RestaurantScreen() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const navigate = useNavigate();
  const store = useStore();
  const q = useQuery(() => api.catalog.restaurant(id, { preview }), [id, preview], ['catalog', 'profile']);
  const [active, setActive] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const clickLock = useRef(0);

  const sections = useMemo(() => {
    if (!q.data) return [];
    return q.data.restaurant.sections
      .map((s) => ({ ...s, dishes: q.data!.dishes.filter((d) => d.sectionId === s.id) }))
      .filter((s) => s.dishes.length > 0);
  }, [q.data]);

  // компактная шапка после обложки
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: '-64px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [q.data]);

  // scroll-spy по разделам меню
  useEffect(() => {
    if (!sections.length) return undefined;
    setActive((a) => a ?? sections[0].id);
    const els = sections.map((s) => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      if (Date.now() < clickLock.current) return;
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id.replace('sec-', ''));
    }, { rootMargin: '-140px 0px -55% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  // активная вкладка всегда видна в ленте
  useEffect(() => {
    const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-sec="${active}"]`);
    if (tab && tabsRef.current) {
      const box = tabsRef.current;
      box.scrollTo({ left: tab.offsetLeft - box.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' });
    }
  }, [active]);

  const goSection = (sid: string) => {
    setActive(sid);
    clickLock.current = Date.now() + 700;
    document.getElementById(`sec-${sid}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  if (q.error) {
    return (
      <div className="screen container page-pad">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="На главную"><Icon name="back" size={22} /></button>
        <EmptyState art="receipt" title={q.error.code === 'restaurant_off' ? 'Ресторан на перерыве' : 'Ресторан не найден'} text={q.error.code === 'network' ? q.error.message : 'Он временно не принимает заказы. Посмотрите другие места рядом — там тоже вкусно.'} action={q.error.code === 'network' ? <Button onClick={q.reload}>Повторить</Button> : <Button onClick={() => navigate('/')}>К ресторанам</Button>} />
      </div>
    );
  }

  const data = q.data;
  const card = data?.card;
  const r = data?.restaurant;
  const favorite = !!card?.favorite;
  const cartHere = store.quote && store.quote.restaurant?.id === id && store.quote.count > 0 ? store.quote : null;

  return (
    <div className="screen rest">
      {preview && <div className="preview-bar"><Icon name="eye" size={16} /> Предпросмотр для владельца{r && !r.enabled ? ' · ресторан скрыт от гостей' : ''}</div>}

      <div className={`rest-topbar${compact ? ' is-on' : ''}`}>
        <div className="rest-topbar__inner container">
          <button className="icon-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Назад"><Icon name="back" size={22} /></button>
          <span className="rest-topbar__name">{r?.name}</span>
          {card && <span className="rest-topbar__eta num">{eta(card.eta)}</span>}
        </div>
      </div>

      <div className="rest-hero" ref={heroRef}>
        {r ? <RestaurantCover cover={r.cover} alt={r.name} eager className="rest-hero__cover" /> : <Skeleton className="rest-hero__cover" r={0} />}
        <div className="rest-hero__actions container">
          <button className="glass-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Назад"><Icon name="back" size={22} /></button>
          {card && (
            <button className={`glass-btn${favorite ? ' is-on' : ''}`} onClick={() => store.toggleFavoriteRestaurant(card.id)} aria-pressed={favorite} aria-label={favorite ? 'Убрать из избранного' : 'В избранное'}>
              <Icon name="heart" size={21} filled={favorite} />
            </button>
          )}
        </div>
      </div>

      <div className="rest-info container">
        {!r || !card ? (
          <div className="stack-8"><Skeleton w="60%" h={32} /><Skeleton w="80%" h={16} /><Skeleton w="100%" h={56} r={16} /></div>
        ) : (
          <>
            <h1 className="h1">{r.name}</h1>
            <p className="rest-info__tagline">{r.tagline}</p>
            <ul className="rest-facts">
              <li><span className="rest-facts__v num"><Icon name="star" size={15} filled /> {rating(card.rating)}</span><span className="rest-facts__k">{card.ratingCount ? `${ratingCount(card.ratingCount)} ${plural(card.ratingCount, 'оценка', 'оценки', 'оценок')}` : 'нет оценок'}</span></li>
              <li><span className="rest-facts__v num">{eta(card.eta)}</span><span className="rest-facts__k">доставка</span></li>
              <li><span className={`rest-facts__v num${card.deliveryFee === 0 ? ' is-free' : ''}`}>{fee(card.deliveryFee)}</span><span className="rest-facts__k">до вас</span></li>
              <li><span className="rest-facts__v num">{rub(r.minOrder)}</span><span className="rest-facts__k">мин. заказ</span></li>
            </ul>
            {!card.isOpen && <Note tone="warn" icon="clock">Сейчас закрыто, откроется в {card.opensAt}. Можно собрать корзину и заказать ко времени.</Note>}
            {card.isOpen && <p className="rest-info__hours"><span className="live-dot" /> Открыто до {r.hours.close === '24:00' ? '00:00' : r.hours.close} · {r.address}</p>}
            {!card.inZone && <Note tone="warn" icon="map" action={<Button size="sm" variant="secondary" onClick={store.openAddress}>Сменить адрес</Button>}>Ресторан не доставляет по выбранному адресу.</Note>}
          </>
        )}
      </div>

      <nav className="rest-tabs" aria-label="Разделы меню">
        <div className="rest-tabs__inner container no-scrollbar" ref={tabsRef}>
          {sections.map((s) => (
            <button key={s.id} data-sec={s.id} className={`rest-tab${active === s.id ? ' is-on' : ''}`} aria-current={active === s.id ? 'true' : undefined} onClick={() => goSection(s.id)}>
              {s.name}
            </button>
          ))}
          {!data && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} w={84} h={34} r={999} />)}
        </div>
      </nav>

      <div className="rest-menu container">
        {!data && (
          <div className="dgrid">{Array.from({ length: 6 }, (_, i) => <DishCardSkeleton key={i} />)}</div>
        )}
        {sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="menu-sec" aria-labelledby={`h-${s.id}`}>
            <h2 className="h2 menu-sec__title" id={`h-${s.id}`}>{s.name}</h2>
            <div className="dgrid">
              {s.dishes.map((d) => <DishCard key={d.id} dish={d} closed={!card?.isOpen} />)}
            </div>
          </section>
        ))}
        {data && !sections.length && <EmptyState art="receipt" title="Меню скоро появится" text="Ресторан обновляет блюда. Загляните чуть позже." />}
        {q.error && <ErrorState message="Не удалось загрузить меню" onRetry={q.reload} />}
      </div>

      {cartHere && (
        <div className="cart-cta">
          <Link to="/cart" className="cart-cta__btn">
            <span className="cart-cta__count num">{cartHere.count}</span>
            <span className="cart-cta__label">Корзина{cartHere.eta ? <span className="cart-cta__eta num"> · {eta(cartHere.eta)}</span> : null}</span>
            <span className="cart-cta__sum"><Money value={cartHere.totals.items} /></span>
          </Link>
        </div>
      )}
    </div>
  );
}
