import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type RestaurantFilters } from '../api';
import { useQuery } from '../lib/useQuery';
import { useStore } from '../components/AppStore';
import { Icon } from '../components/Icon';
import { Button, EmptyState, ErrorState, Img, Note, Skeleton } from '../components/ui';
import { RestaurantCard, RestaurantCardSkeleton } from '../components/RestaurantCard';
import { FiltersSheet, EMPTY_FILTERS, activeFilterCount, type Filters } from '../components/FiltersSheet';
import { DemoFooter } from '../components/Chrome';
import { useToast } from '../components/Toast';
import { plural } from '../lib/format';

type Collection = 'all' | 'fast' | 'near' | 'discount';
const COLLECTIONS: { id: Collection; label: string; icon?: 'bolt' | 'navigation' | 'tag' }[] = [
  { id: 'all', label: 'Все' },
  { id: 'fast', label: 'Быстро', icon: 'bolt' },
  { id: 'near', label: 'Рядом', icon: 'navigation' },
  { id: 'discount', label: 'Со скидкой', icon: 'tag' },
];

export function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const { address, openAddress } = useStore();
  const [category, setCategory] = useState<string | null>(null);
  const [collection, setCollection] = useState<Collection>('all');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const base: RestaurantFilters = useMemo(() => ({ category, collection: collection === 'all' ? null : collection }), [category, collection]);
  const cats = useQuery(() => api.catalog.categories(), [], ['catalog']);
  const all = useQuery(() => api.catalog.restaurants(), [], ['catalog', 'profile']);
  const list = useQuery(() => api.catalog.restaurants({ ...base, ...filters }), [base, filters], ['catalog', 'profile']);

  const fastest = useMemo(() => {
    const open = (all.data ?? []).filter((r) => r.isOpen && r.eta);
    return open.length ? Math.min(...open.map((r) => r.eta!.min)) : null;
  }, [all.data]);
  const openCount = (all.data ?? []).filter((r) => r.isOpen && r.inZone).length;
  const outOfZone = !!all.data && all.data.length > 0 && all.data.every((r) => !r.inZone);
  const fCount = activeFilterCount(filters);

  const copyPromo = async () => {
    try { await navigator.clipboard?.writeText('ЕСТЬ10'); } catch { /* буфер недоступен — не страшно */ }
    toast({ text: 'Промокод ЕСТЬ10 скопирован — введите его в корзине', icon: 'tag' });
  };

  return (
    <div className="screen home">
      <section className="hero container">
        <div className="hero__text">
          <h1 className="h-display">
            Горячая еда<br />
            {fastest ? <>за <span className="num">{fastest}</span> минут</> : 'к вашей двери'}
          </h1>
          <p className="hero__sub">
            {all.loading ? <Skeleton w={220} h={16} /> : address
              ? <>{openCount} {plural(openCount, 'ресторан', 'ресторана', 'ресторанов')} готовы привезти на {address.street}</>
              : 'Укажите адрес — покажем, кто привезёт быстрее'}
          </p>
          <button className="hero__search" onClick={() => navigate('/search')}>
            <Icon name="search" size={20} />
            <span>Найти блюдо или ресторан</span>
          </button>
        </div>
        <div className="hero__art" aria-hidden="true">
          <Img src="assets/cut/burgers/classic.webp" alt="" eager className="hero__a1" />
          <Img src="assets/cut/sushi/philadelphia.webp" alt="" eager className="hero__a2" />
          <Img src="assets/cut/coffee/cappuccino.webp" alt="" eager className="hero__a3" />
        </div>
      </section>

      <section className="container cats-wrap" aria-label="Категории">
        <div className="cats no-scrollbar">
          {cats.loading && Array.from({ length: 6 }, (_, i) => <div key={i} className="cat"><Skeleton w={64} h={64} r={20} /><Skeleton w={52} h={12} /></div>)}
          {cats.data?.map((c) => {
            const on = category === c.id;
            return (
              <button key={c.id} className={`cat${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => setCategory(on ? null : c.id)}>
                <span className="cat__img"><Img src={c.image} alt="" /></span>
                <span className="cat__label">{c.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="container">
        <button className="promo-banner" onClick={copyPromo}>
          <span className="promo-banner__code">ЕСТЬ10</span>
          <span className="promo-banner__text"><b>−10% на любой заказ</b></span>
          <Icon name="copy" size={18} />
        </button>
      </section>

      <section className="container list-section" aria-labelledby="rest-title">
        <div className="list-head">
          <h2 className="h2" id="rest-title">{category ? cats.data?.find((c) => c.id === category)?.name : 'Рестораны'}</h2>
        </div>
        <div className="toolbar">
          <div className="tabs no-scrollbar" role="tablist" aria-label="Подборки">
            {COLLECTIONS.map((c) => (
              <button key={c.id} role="tab" aria-selected={collection === c.id} className={`tab${collection === c.id ? ' is-on' : ''}`} onClick={() => setCollection(c.id)}>
                {c.icon && <Icon name={c.icon} size={15} />}{c.label}
              </button>
            ))}
          </div>
          <button className={`filter-btn${fCount ? ' is-on' : ''}`} onClick={() => setFiltersOpen(true)} aria-label={`Фильтры${fCount ? `, выбрано ${fCount}` : ''}`}>
            <Icon name="filter" size={18} /><span>Фильтры</span>{fCount > 0 && <span className="filter-btn__count num">{fCount}</span>}
          </button>
        </div>

        {outOfZone && (
          <Note tone="warn" icon="map" action={<Button size="sm" variant="secondary" onClick={openAddress}>Сменить адрес</Button>}>
            <b>По этому адресу пока не доставляем.</b> Выберите точку в Нагорной или Заречной части.
          </Note>
        )}

        {list.error && <ErrorState message={list.error.message} onRetry={list.reload} />}
        <div className="rgrid">
          {list.loading && Array.from({ length: 4 }, (_, i) => <RestaurantCardSkeleton key={i} />)}
          {list.data?.map((r, i) => <RestaurantCard key={r.id} card={r} eager={i < 2} />)}
        </div>
        {list.data && list.data.length === 0 && (
          <EmptyState
            art="search"
            title="Ничего не нашли"
            text="Под такие условия ресторанов нет. Попробуйте ослабить фильтры."
            action={<Button variant="secondary" onClick={() => { setFilters(EMPTY_FILTERS); setCollection('all'); setCategory(null); }}>Сбросить всё</Button>}
          />
        )}
      </section>

      <DemoFooter />

      <FiltersSheet open={filtersOpen} value={filters} base={base} onApply={setFilters} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
