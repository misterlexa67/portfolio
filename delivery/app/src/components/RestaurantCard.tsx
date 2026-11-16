import { Link } from 'react-router-dom';
import type { Cover, RestaurantCard as Card } from '../api';
import { Icon } from './Icon';
import { Img, Skeleton } from './ui';
import { eta, fee, rating } from '../lib/format';
import { useStore } from './AppStore';

export function RestaurantCover({ cover, alt, eager, className = '' }: { cover: Cover; alt: string; eager?: boolean; className?: string }) {
  if (cover.kind === 'photo') {
    return (
      <div className={`cover cover--photo ${className}`} style={{ ['--pos' as string]: cover.position ?? '50% 50%' }}>
        <Img src={cover.src} alt={alt} eager={eager} />
      </div>
    );
  }
  return (
    <div className={`cover cover--still ${className}`} style={{ background: cover.tint }}>
      {cover.images.slice(0, 3).map((src, i) => (
        <Img key={src + i} src={src} alt={i === 0 ? alt : ''} eager={eager} className={`cover__item cover__item--${i + 1}`} />
      ))}
    </div>
  );
}

export function RestaurantCard({ card, eager }: { card: Card; eager?: boolean }) {
  const { toggleFavoriteRestaurant } = useStore();
  return (
    <article className={`rcard${card.isOpen ? '' : ' is-closed'}`}>
      <Link to={`/r/${card.id}`} className="rcard__link" aria-label={`${card.name}, рейтинг ${rating(card.rating)}, ${eta(card.eta)}`}>
        <div className="rcard__media">
          <RestaurantCover cover={card.cover} alt={card.name} eager={eager} />
          {!card.isOpen && <span className="rcard__closed">Откроется в {card.opensAt}</span>}
          {card.isOpen && card.eta && <span className="rcard__eta num">{eta(card.eta)}</span>}
          {card.hasDiscount && <span className="badge badge--accent rcard__badge">Скидки</span>}
        </div>
        <div className="rcard__body">
          <div className="rcard__row">
            <h3 className="rcard__name">{card.name}</h3>
            <span className="rcard__rating num"><Icon name="star" size={14} filled />{rating(card.rating)}</span>
          </div>
          <p className="rcard__meta">
            {card.inZone ? (
              <>
                <span className={card.deliveryFee === 0 ? 'is-free' : ''}>{card.deliveryFee === 0 ? 'Бесплатная доставка' : `Доставка ${fee(card.deliveryFee)}`}</span>
                <span className="dot" />
                <span>{card.tagline}</span>
              </>
            ) : <span>Не доставляет по выбранному адресу</span>}
          </p>
        </div>
      </Link>
      <button
        className={`fav-btn rcard__fav${card.favorite ? ' is-on' : ''}`}
        onClick={() => toggleFavoriteRestaurant(card.id)}
        aria-pressed={card.favorite}
        aria-label={card.favorite ? `Убрать «${card.name}» из избранного` : `Добавить «${card.name}» в избранное`}
      >
        <Icon name="heart" size={19} filled={card.favorite} />
      </button>
    </article>
  );
}

export function RestaurantCardSkeleton() {
  return (
    <div className="rcard rcard--skeleton" aria-hidden="true">
      <Skeleton className="rcard__media" r={20} />
      <div className="rcard__body"><Skeleton w="55%" h={20} /><Skeleton w="80%" h={14} /></div>
    </div>
  );
}
