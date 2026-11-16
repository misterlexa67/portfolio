import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Dish, type SearchResult } from '../api';
import { useStore } from '../components/AppStore';
import { Icon } from '../components/Icon';
import { EmptyState, Img, Price, Skeleton } from '../components/ui';
import { RestaurantCover } from '../components/RestaurantCard';
import { eta, rating } from '../lib/format';
import { useQuery } from '../lib/useQuery';

type Result = SearchResult & { correctedQuery: string | null };

function DishRow({ dish, restaurantName, onPick }: { dish: Dish; restaurantName: string; onPick: () => void }) {
  const store = useStore();
  const img = useRef<HTMLDivElement>(null);
  const simple = dish.addonGroups.length === 0;
  return (
    <li className={`srow${dish.available ? '' : ' is-off'}`}>
      <button className="srow__main" onClick={() => { onPick(); store.openDish(dish.id); }}>
        <div className="srow__img srow__img--dish" ref={img}><Img src={dish.image} alt="" /></div>
        <div className="srow__text">
          <span className="srow__title">{dish.name}</span>
          <span className="srow__sub">{restaurantName}{dish.available ? '' : ' · нет в наличии'}</span>
          <Price value={dish.price} old={dish.oldPrice} className="srow__price" />
        </div>
      </button>
      <button
        className="round-add"
        disabled={!dish.available}
        aria-label={`Добавить «${dish.name}»`}
        onClick={() => { onPick(); if (simple) store.addToCart(dish.id, [], 1, { el: img.current?.querySelector('img') ?? null, image: dish.image }); else store.openDish(dish.id); }}
      >
        <Icon name="plus" size={18} stroke={2} />
      </button>
    </li>
  );
}

export function Search() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { profile } = useStore();
  const popular = useQuery(() => api.catalog.popular(), [], ['catalog']);

  useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const v = q.trim();
    setParams(v ? { q: v } : {}, { replace: true });
    if (!v) { setRes(null); setBusy(false); return; }
    setBusy(true);
    let alive = true;
    const t = setTimeout(() => {
      api.catalog.search(v).then((r) => { if (alive) { setRes(r); setBusy(false); } }, () => { if (alive) setBusy(false); });
    }, 120);
    return () => { alive = false; clearTimeout(t); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const remember = () => { if (q.trim().length >= 2) api.profile.addRecentSearch(q.trim()); };
  const empty = res && !res.restaurants.length && !res.dishes.length;

  return (
    <div className="screen search-screen">
      <div className="search-bar">
        <div className="search-bar__inner container">
          <button className="icon-btn" aria-label="Назад" onClick={() => navigate(-1)}><Icon name="back" size={22} /></button>
          <form className="search-field" role="search" onSubmit={(e) => { e.preventDefault(); remember(); input.current?.blur(); }}>
            <Icon name="search" size={19} />
            <label htmlFor="q" className="sr-only">Блюда и рестораны</label>
            <input
              id="q"
              ref={input}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Блюда и рестораны"
              autoComplete="off"
              enterKeyHint="search"
            />
            {q && <button type="button" className="icon-btn icon-btn--sm" aria-label="Очистить" onClick={() => { setQ(''); input.current?.focus(); }}><Icon name="close" size={16} /></button>}
          </form>
        </div>
      </div>

      <div className="container search-body">
        {!q.trim() && (
          <>
            {!!profile?.recentSearches.length && (
              <section className="search-sec">
                <div className="search-sec__head">
                  <h2 className="h3">Вы искали</h2>
                  <button className="link link--muted" onClick={() => api.profile.clearRecentSearches()}>Очистить</button>
                </div>
                <div className="chips">
                  {profile.recentSearches.map((s) => <button key={s} className="chip" onClick={() => setQ(s)}><Icon name="clock" size={15} />{s}</button>)}
                </div>
              </section>
            )}
            <section className="search-sec">
              <h2 className="h3">Чаще всего заказывают</h2>
              <ul className="slist">
                {popular.loading && Array.from({ length: 4 }, (_, i) => <li key={i} className="srow"><Skeleton w={64} h={64} r={16} /><div className="srow__text"><Skeleton w="60%" h={16} /><Skeleton w="30%" h={14} /></div></li>)}
                {popular.data?.map((d) => <DishRow key={d.dish.id} dish={d.dish} restaurantName={d.restaurantName} onPick={() => {}} />)}
              </ul>
            </section>
          </>
        )}

        {q.trim() && busy && !res && (
          <ul className="slist">{Array.from({ length: 4 }, (_, i) => <li key={i} className="srow"><Skeleton w={64} h={64} r={16} /><div className="srow__text"><Skeleton w="60%" h={16} /><Skeleton w="30%" h={14} /></div></li>)}</ul>
        )}

        {res && res.correctedQuery && <p className="search-fix">Показываем результаты по запросу «{res.correctedQuery}»</p>}

        {res && q.trim() && !empty && (
          <div className={busy ? 'is-refreshing' : ''}>
            {res.restaurants.length > 0 && (
              <section className="search-sec">
                <h2 className="h3">Рестораны</h2>
                <ul className="slist">
                  {res.restaurants.map((r) => (
                    <li key={r.id} className="srow">
                      <Link to={`/r/${r.id}`} className="srow__main" onClick={remember}>
                        <div className="srow__img"><RestaurantCover cover={r.cover} alt="" /></div>
                        <div className="srow__text">
                          <span className="srow__title">{r.name}</span>
                          <span className="srow__sub num"><Icon name="star" size={13} filled /> {rating(r.rating)} · {r.isOpen ? eta(r.eta) : `откроется в ${r.opensAt}`}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {res.dishes.length > 0 && (
              <section className="search-sec">
                <h2 className="h3">Блюда</h2>
                <ul className="slist">
                  {res.dishes.map((d) => <DishRow key={d.dish.id} dish={d.dish} restaurantName={d.restaurantName} onPick={remember} />)}
                </ul>
              </section>
            )}
          </div>
        )}

        {empty && q.trim() && (
          <EmptyState
            art="search"
            title="Ничего не нашли"
            text={`По запросу «${q.trim()}» пусто. Попробуйте иначе: «бургер», «роллы», «кофе» или «боул».`}
            action={<div className="chips chips--center">{['Бургер', 'Филадельфия', 'Том ям', 'Капучино'].map((s) => <button key={s} className="chip" onClick={() => setQ(s)}>{s}</button>)}</div>}
          />
        )}
      </div>
    </div>
  );
}
