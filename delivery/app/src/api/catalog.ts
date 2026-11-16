import type {
  Category, Dish, DishQuote, Restaurant, RestaurantCard, RestaurantFilters, SearchResult, Zone,
} from './types';
import { read, type DB } from './db';
import { call } from './net';
import { ApiError } from './errors';
import { deliveryFor, resolveOptions, restaurantState, unitPrice } from './pricing';
import { dist, PX_TO_KM } from './geo';

export function selectedAddress(db: DB) {
  return db.profile.addresses.find((a) => a.id === db.profile.selectedAddressId) ?? null;
}

export function toCard(db: DB, r: Restaurant): RestaurantCard {
  const address = selectedAddress(db);
  const delivery = address ? deliveryFor(db, r, address.point) : null;
  const state = restaurantState(r);
  return {
    id: r.id, name: r.name, tagline: r.tagline, cover: r.cover, rating: r.rating, ratingCount: r.ratingCount,
    categoryIds: r.categoryIds, minOrder: r.minOrder,
    deliveryFee: delivery ? delivery.fee : null,
    eta: delivery ? delivery.eta : null,
    distanceKm: address ? Math.round(dist(r.location, address.point) * PX_TO_KM * 10) / 10 : null,
    isOpen: state.isOpen, opensAt: state.opensAt,
    hasDiscount: db.dishes.some((d) => d.restaurantId === r.id && d.available && d.oldPrice !== null && d.oldPrice > d.price),
    favorite: db.profile.favoriteRestaurants.includes(r.id),
    inZone: !!delivery,
  };
}

const visible = (db: DB) => db.restaurants.filter((r) => r.enabled).sort((a, b) => a.sort - b.sort);

export function filterCards(cards: RestaurantCard[], f: RestaurantFilters): RestaurantCard[] {
  let list = cards.slice();
  if (f.category) list = list.filter((c) => c.categoryIds.includes(f.category!));
  if (f.collection === 'fast') list = list.filter((c) => c.eta && c.eta.min <= 25);
  if (f.collection === 'near') list = list.filter((c) => c.distanceKm !== null && c.distanceKm <= 3.5);
  if (f.collection === 'discount') list = list.filter((c) => c.hasDiscount);
  if (f.minRating) list = list.filter((c) => c.rating >= f.minRating!);
  if (f.maxMinutes) list = list.filter((c) => c.eta && c.eta.max <= f.maxMinutes!);
  if (f.maxFee !== null && f.maxFee !== undefined) list = list.filter((c) => c.deliveryFee !== null && c.deliveryFee <= f.maxFee!);
  if (f.freeDelivery) list = list.filter((c) => c.deliveryFee === 0);

  const sort = f.sort ?? (f.collection === 'near' ? 'recommended' : 'recommended');
  const openFirst = (a: RestaurantCard, b: RestaurantCard) => Number(b.isOpen) - Number(a.isOpen);
  list.sort((a, b) => {
    const o = openFirst(a, b);
    if (o) return o;
    switch (sort) {
      case 'rating': return b.rating - a.rating;
      case 'time': return (a.eta?.min ?? 999) - (b.eta?.min ?? 999);
      case 'fee': return (a.deliveryFee ?? 999) - (b.deliveryFee ?? 999);
      default:
        if (f.collection === 'near') return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
        return 0; // порядок, заданный владельцем в админке
    }
  });
  return list;
}

/* ---------- Поиск ---------- */

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();
const EN = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.`';
const RU = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const fixLayout = (s: string) => s.toLowerCase().split('').map((ch) => { const i = EN.indexOf(ch); return i >= 0 ? RU[i] : ch; }).join('');

function score(text: string, q: string): number {
  const t = norm(text);
  if (!q) return 0;
  if (t.startsWith(q)) return 3;
  if (t.split(/[\s,.«»()-]+/).some((w) => w.startsWith(q))) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

function searchIn(db: DB, raw: string): SearchResult {
  const q = norm(raw);
  if (q.length < 1) return { restaurants: [], dishes: [] };
  const cats = db.categories;
  const rs = visible(db)
    .map((r) => {
      const catNames = r.categoryIds.map((id) => cats.find((c) => c.id === id)?.name ?? '').join(' ');
      const s = Math.max(score(r.name, q) * 2, score(catNames, q) * 1.5, score(r.tagline, q));
      return { r, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => toCard(db, x.r));
  const enabledIds = new Set(visible(db).map((r) => r.id));
  const ds = db.dishes
    .filter((d) => enabledIds.has(d.restaurantId))
    .map((d) => ({ d, s: Math.max(score(d.name, q) * 2, score(d.composition, q) * 0.8, score(d.description, q) * 0.6) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || Number(b.d.available) - Number(a.d.available))
    .slice(0, 24)
    .map(({ d }) => {
      const r = db.restaurants.find((x) => x.id === d.restaurantId)!;
      return { dish: d, restaurantName: r.name, restaurantOpen: restaurantState(r).isOpen };
    });
  return { restaurants: rs, dishes: ds };
}

/* ---------- Публичное API ---------- */

export const catalog = {
  categories(): Promise<Category[]> {
    return call(() => read((db) => db.categories), { safe: true });
  },

  restaurants(filters: RestaurantFilters = {}): Promise<RestaurantCard[]> {
    return call(() => read((db) => filterCards(visible(db).map((r) => toCard(db, r)), filters)));
  },

  restaurant(id: string, opts: { preview?: boolean } = {}): Promise<{
    restaurant: Restaurant; card: RestaurantCard; dishes: Dish[];
  }> {
    return call(() => read((db) => {
      const r = db.restaurants.find((x) => x.id === id);
      if (!r || (!r.enabled && !opts.preview)) {
        throw new ApiError(r ? 'restaurant_off' : 'not_found', r ? 'Ресторан временно не принимает заказы' : 'Такого ресторана нет — возможно, он закрылся');
      }
      const dishes = db.dishes.filter((d) => d.restaurantId === id).sort((a, b) => a.sort - b.sort);
      return { restaurant: r, card: toCard(db, r), dishes };
    }));
  },

  dish(id: string): Promise<{ dish: Dish; restaurant: { id: string; name: string; isOpen: boolean } }> {
    return call(() => read((db) => {
      const d = db.dishes.find((x) => x.id === id);
      const r = d && db.restaurants.find((x) => x.id === d.restaurantId);
      if (!d || !r) throw new ApiError('not_found', 'Это блюдо убрали из меню');
      return { dish: d, restaurant: { id: r.id, name: r.name, isOpen: restaurantState(r).isOpen } };
    }), { fast: true });
  },

  /** Цена блюда с добавками — считает сервис, а не UI. */
  quoteDish(dishId: string, optionIds: string[], qty: number): Promise<DishQuote> {
    return call(() => read((db) => {
      const d = db.dishes.find((x) => x.id === dishId);
      if (!d) throw new ApiError('not_found', 'Это блюдо убрали из меню');
      const res = resolveOptions(d, optionIds);
      const q = Math.max(1, Math.min(50, Math.floor(qty) || 1));
      // пока набор неполный (не выбран обязательный вариант) — цена с уже выбранными добавками
      const unit = res.ok
        ? unitPrice(d, res.options)
        : unitPrice(d, d.addonGroups.flatMap((g) => g.options).filter((o) => optionIds.includes(o.id)));
      return { unitPrice: unit, total: unit * q, valid: res.ok && d.available, message: d.available ? res.message : 'Сейчас нет в наличии' };
    }), { fast: true, safe: true });
  },

  search(q: string): Promise<SearchResult & { correctedQuery: string | null }> {
    return call(() => read((db) => {
      const direct = searchIn(db, q);
      if (direct.restaurants.length || direct.dishes.length || !/[a-z]/i.test(q)) return { ...direct, correctedQuery: null };
      const fixed = fixLayout(q);
      const second = searchIn(db, fixed);
      return { ...second, correctedQuery: second.restaurants.length || second.dishes.length ? fixed : null };
    }), { fast: true });
  },

  /** Активные зоны доставки — для карты. */
  zones(): Promise<Zone[]> {
    return call(() => read((db) => db.zones.filter((z) => z.enabled).sort((a, b) => a.sort - b.sort)), { fast: true, safe: true });
  },

  /** Популярное для пустого поиска. */
  popular(): Promise<{ dish: Dish; restaurantName: string }[]> {
    return call(() => read((db) => {
      const enabled = visible(db);
      const ids = new Set(enabled.map((r) => r.id));
      return db.dishes
        .filter((d) => ids.has(d.restaurantId) && d.available && d.tags.includes('hit'))
        .slice(0, 8)
        .map((d) => ({ dish: d, restaurantName: enabled.find((r) => r.id === d.restaurantId)!.name }));
    }), { fast: true, safe: true });
  },
};
