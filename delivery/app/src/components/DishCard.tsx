import { useRef } from 'react';
import type { Dish, DishTag } from '../api';
import { Icon } from './Icon';
import { Img, Price, Skeleton, Stepper } from './ui';
import { useStore } from './AppStore';

const TAGS: Record<DishTag, { label: string; icon: 'flame' | 'leaf' | 'spark' | 'star' }> = {
  hit: { label: 'Хит', icon: 'star' },
  new: { label: 'Новинка', icon: 'spark' },
  spicy: { label: 'Острое', icon: 'flame' },
  veg: { label: 'Без мяса', icon: 'leaf' },
};

export function DishTags({ tags }: { tags: DishTag[] }) {
  if (!tags.length) return null;
  return (
    <ul className="dish-tags">
      {tags.map((t) => <li key={t} className={`dish-tag dish-tag--${t}`}><Icon name={TAGS[t].icon} size={13} />{TAGS[t].label}</li>)}
    </ul>
  );
}

export function DishCard({ dish, closed }: { dish: Dish; closed?: boolean }) {
  const store = useStore();
  const media = useRef<HTMLDivElement>(null);
  const qty = store.cartQty(dish.id);
  const simple = dish.addonGroups.length === 0;

  const quickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!simple) { store.openDish(dish.id); return; }
    store.addToCart(dish.id, [], 1, { el: media.current?.querySelector('img') ?? null, image: dish.image });
  };

  return (
    <article className={`dcard${dish.available ? '' : ' is-off'}`}>
      <button className="dcard__open" onClick={() => store.openDish(dish.id)} aria-label={`${dish.name}, подробнее`}>
        <div className="dcard__media" ref={media}>
          <Img src={dish.image} alt={dish.name} />
          {!dish.available && <span className="dcard__off">Нет в наличии</span>}
          {dish.available && dish.oldPrice && <span className="badge badge--accent dcard__sale">−{Math.round((1 - dish.price / dish.oldPrice) * 100)}%</span>}
        </div>
        <div className="dcard__body">
          <Price value={dish.price} old={dish.oldPrice} className="dcard__price" />
          <h3 className="dcard__name">{dish.name}</h3>
          <span className="dcard__weight">{dish.weight} {dish.unit}{closed ? ' · ко времени' : ''}</span>
        </div>
      </button>
      <div className="dcard__action">
        {dish.available && qty > 0 && simple ? (
          <Stepper size="sm" value={qty} onChange={(v) => (v > qty ? store.addToCart(dish.id, [], 1) : store.setDishQty(dish.id, v))} label={`Количество «${dish.name}»`} />
        ) : (
          <button className={`dcard__add${qty > 0 ? ' has-qty' : ''}`} onClick={quickAdd} disabled={!dish.available} aria-label={dish.available ? `Добавить «${dish.name}»` : 'Нет в наличии'}>
            {qty > 0 ? <span className="num">{qty}</span> : <Icon name="plus" size={18} stroke={2} />}
            <span>{dish.available ? (qty > 0 ? 'Ещё' : 'Добавить') : 'Нет'}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function DishCardSkeleton() {
  return (
    <div className="dcard" aria-hidden="true">
      <Skeleton className="dcard__media" r={18} />
      <div className="dcard__body"><Skeleton w="40%" h={18} /><Skeleton w="85%" h={14} /><Skeleton w="30%" h={12} /></div>
    </div>
  );
}
