import { useEffect, useRef, useState } from 'react';
import { api, toFriendly, type Dish, type DishQuote } from '../api';
import { Sheet } from './Sheet';
import { Button, Img, Note, Price, Skeleton, Stepper, ErrorState } from './ui';
import { Icon } from './Icon';
import { useStore } from './AppStore';
import { useToast } from './Toast';
import { rub } from '../lib/format';
import { DishTags } from './DishCard';

function defaults(d: Dish): string[] {
  return d.addonGroups.filter((g) => g.kind === 'single' && g.required).map((g) => g.options[0].id);
}

export function DishSheet({ dishId, onClose }: { dishId: string | null; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [data, setData] = useState<{ dish: Dish; restaurant: { id: string; name: string; isOpen: boolean } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<DishQuote | null>(null);
  const [adding, setAdding] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  const load = (id: string) => {
    setError(null);
    api.catalog.dish(id).then((d) => {
      setData(d);
      setOptions(defaults(d.dish));
      setQty(1);
    }, (e) => setError(toFriendly(e).message));
  };

  useEffect(() => {
    if (!dishId) return;
    if (data?.dish.id !== dishId) { setData(null); setPrice(null); }
    load(dishId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId]);

  // живой пересчёт цены — сервисом
  useEffect(() => {
    if (!data) return;
    let alive = true;
    api.catalog.quoteDish(data.dish.id, options, qty).then((q) => { if (alive) setPrice(q); }, () => {});
    return () => { alive = false; };
  }, [data, options, qty]);

  const dish = data?.dish;
  const favorite = !!dish && !!store.profile?.favoriteDishes.includes(dish.id);

  const toggle = (groupId: string, optionId: string) => {
    if (!dish) return;
    const g = dish.addonGroups.find((x) => x.id === groupId)!;
    setOptions((cur) => {
      const inGroup = g.options.map((o) => o.id);
      if (g.kind === 'single') return [...cur.filter((id) => !inGroup.includes(id)), optionId];
      if (cur.includes(optionId)) return cur.filter((id) => id !== optionId);
      const picked = cur.filter((id) => inGroup.includes(id));
      if (g.max && picked.length >= g.max) {
        toast({ text: `Можно выбрать не больше ${g.max}`, icon: 'info' });
        return cur;
      }
      return [...cur, optionId];
    });
  };

  const add = async () => {
    if (!dish || !price?.valid) {
      if (price?.message) toast({ text: price.message, icon: 'info' });
      return;
    }
    setAdding(true);
    const imgEl = imgRef.current?.querySelector('img') ?? null;
    const ok = await store.addToCart(dish.id, options, qty, { el: imgEl, image: dish.image });
    setAdding(false);
    if (ok) onClose();
  };

  const hero = dish ? (
    <div className="dish-hero" ref={imgRef}>
      <Img src={dish.image} alt={dish.name} eager className={dish.available ? '' : 'is-off'} />
      <button
        className={`fav-btn dish-hero__fav${favorite ? ' is-on' : ''}`}
        onClick={() => store.toggleFavoriteDish(dish.id)}
        aria-pressed={favorite}
        aria-label={favorite ? 'Убрать из избранного' : 'В избранное'}
      >
        <Icon name="heart" size={20} filled={favorite} />
      </button>
    </div>
  ) : (
    <div className="dish-hero"><Skeleton w="60%" h="70%" r={24} /></div>
  );

  const footer = dish ? (
    <div className="dish-footer">
      <Stepper value={qty} onChange={setQty} min={1} max={20} disabled={!dish.available} />
      <Button size="lg" block onClick={add} loading={adding} disabled={!dish.available}>
        {dish.available ? <>Добавить · <span className="price">{rub(price?.total ?? dish.price * qty)}</span></> : 'Нет в наличии'}
      </Button>
    </div>
  ) : undefined;

  return (
    <Sheet open={!!dishId} onClose={onClose} hero={hero} footer={footer} size="tall" label={dish?.name ?? 'Блюдо'} className="dish-sheet">
      {error && <ErrorState message={error} onRetry={() => dishId && load(dishId)} />}
      {!dish && !error && (
        <div className="stack-8">
          <Skeleton w="70%" h={28} /><Skeleton w="40%" h={18} /><Skeleton w="100%" h={60} />
        </div>
      )}
      {dish && (
        <div className="dish-info">
          <div className="dish-info__head">
            <h2 className="h2">{dish.name}</h2>
            <div className="dish-info__meta">
              <Price value={dish.price} old={dish.oldPrice} />
              <span className="dot" />
              <span>{dish.weight} {dish.unit}</span>
              <span className="dot" />
              <span>{dish.calories} ккал</span>
            </div>
            <DishTags tags={dish.tags} />
          </div>
          {!dish.available && <Note tone="warn" icon="info">Это блюдо закончилось. Загляните позже — или выберите что-то похожее.</Note>}
          {data && !data.restaurant.isOpen && dish.available && <Note icon="clock">«{data.restaurant.name}» сейчас закрыт — блюдо можно заказать ко времени.</Note>}
          {dish.description && <p className="dish-info__desc">{dish.description}</p>}
          {dish.composition && (
            <details className="dish-info__comp">
              <summary>Состав</summary>
              <p>{dish.composition}</p>
            </details>
          )}
          {dish.addonGroups.map((g) => (
            <fieldset key={g.id} className="addon-group" disabled={!dish.available}>
              <legend className="addon-group__title">
                {g.name}
                <span className="addon-group__hint">{g.required ? 'обязательно' : g.max ? `до ${g.max}` : 'по желанию'}</span>
              </legend>
              {g.options.map((o) => {
                const checked = options.includes(o.id);
                return (
                  <label key={o.id} className={`addon${checked ? ' is-checked' : ''}`}>
                    <input
                      type={g.kind === 'single' ? 'radio' : 'checkbox'}
                      name={g.id}
                      checked={checked}
                      onChange={() => toggle(g.id, o.id)}
                      onClick={(e) => { if (g.kind === 'single' && checked && !g.required) { e.preventDefault(); setOptions((c) => c.filter((x) => x !== o.id)); } }}
                    />
                    <span className={`addon__mark addon__mark--${g.kind}`} aria-hidden="true"><Icon name="check" size={14} stroke={2.4} /></span>
                    <span className="addon__name">{o.name}</span>
                    <span className="addon__price price">{o.price > 0 ? `+${rub(o.price)}` : ''}</span>
                  </label>
                );
              })}
            </fieldset>
          ))}
          {price && !price.valid && price.message && dish.available && <p className="dish-info__warn">{price.message}</p>}
        </div>
      )}
    </Sheet>
  );
}
