import type { Address, AddressDetails, Dish, Point, Profile, RestaurantCard, Wallet } from './types';
import { newId, read, resetAll, write } from './db';
import { call } from './net';
import { ApiError } from './errors';
import { now } from './time';
import { clampToMap, districtOf } from './geo';
import { zoneFor } from './pricing';
import { toCard } from './catalog';

export const wallet = {
  get(): Promise<Wallet> {
    return call(() => read((db) => db.wallet), { fast: true, safe: true });
  },
  topUp(amount: number): Promise<Wallet> {
    return call(() => write(['wallet'], (db) => {
      const a = Math.floor(amount);
      if (!(a >= 100 && a <= 50000)) throw new ApiError('invalid', 'Пополнить можно на сумму от 100 до 50 000 ₽');
      db.wallet.balance += a;
      db.wallet.transactions.unshift({ id: newId('txn'), kind: 'topup', amount: a, at: now(), title: 'Пополнение баланса' });
      return db.wallet;
    }));
  },
};

export interface AddressInput { label: string; street: string; details: AddressDetails; point: Point }

export const profile = {
  get(): Promise<Profile> {
    return call(() => read((db) => db.profile), { fast: true, safe: true });
  },

  /** Проверка точки: зона, район — для подсказок при выборе на карте. */
  checkPoint(p: Point): Promise<{ district: string; zone: { id: string; name: string; surcharge: number; extraMinutes: number } | null }> {
    return call(() => read((db) => {
      const z = zoneFor(db.zones, p);
      return { district: districtOf(p), zone: z ? { id: z.id, name: z.name, surcharge: z.surcharge, extraMinutes: z.extraMinutes } : null };
    }), { fast: true, safe: true });
  },

  saveAddress(input: AddressInput, id?: string): Promise<Address> {
    return call(() => write(['profile', 'catalog', 'cart'], (db) => {
      const street = input.street.trim();
      if (street.length < 3) throw new ApiError('invalid', 'Укажите улицу и дом');
      const point = clampToMap(input.point);
      const data: Address = {
        id: id ?? newId('a'),
        label: input.label.trim().slice(0, 20),
        street: street.slice(0, 80),
        district: districtOf(point),
        details: {
          entrance: input.details.entrance.trim().slice(0, 6),
          floor: input.details.floor.trim().slice(0, 4),
          apartment: input.details.apartment.trim().slice(0, 8),
          comment: input.details.comment.trim().slice(0, 140),
        },
        point,
      };
      const i = db.profile.addresses.findIndex((a) => a.id === data.id);
      if (i >= 0) db.profile.addresses[i] = data;
      else db.profile.addresses.unshift(data);
      db.profile.selectedAddressId = data.id;
      return data;
    }));
  },

  selectAddress(id: string): Promise<Profile> {
    return call(() => write(['profile', 'catalog', 'cart'], (db) => {
      if (!db.profile.addresses.some((a) => a.id === id)) throw new ApiError('not_found', 'Адрес не найден');
      db.profile.selectedAddressId = id;
      return db.profile;
    }), { fast: true });
  },

  removeAddress(id: string): Promise<Profile> {
    return call(() => write(['profile', 'catalog', 'cart'], (db) => {
      db.profile.addresses = db.profile.addresses.filter((a) => a.id !== id);
      if (db.profile.selectedAddressId === id) db.profile.selectedAddressId = db.profile.addresses[0]?.id ?? null;
      return db.profile;
    }), { fast: true });
  },

  toggleFavoriteRestaurant(id: string): Promise<boolean> {
    return call(() => write(['profile', 'catalog'], (db) => {
      const list = db.profile.favoriteRestaurants;
      const on = !list.includes(id);
      db.profile.favoriteRestaurants = on ? [id, ...list] : list.filter((x) => x !== id);
      return on;
    }), { fast: true, safe: true });
  },

  toggleFavoriteDish(id: string): Promise<boolean> {
    return call(() => write(['profile'], (db) => {
      const list = db.profile.favoriteDishes;
      const on = !list.includes(id);
      db.profile.favoriteDishes = on ? [id, ...list] : list.filter((x) => x !== id);
      return on;
    }), { fast: true, safe: true });
  },

  favorites(): Promise<{ restaurants: RestaurantCard[]; dishes: { dish: Dish; restaurantName: string }[] }> {
    return call(() => read((db) => ({
      restaurants: db.profile.favoriteRestaurants
        .map((id) => db.restaurants.find((r) => r.id === id && r.enabled))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r) => toCard(db, r)),
      dishes: db.profile.favoriteDishes
        .map((id) => db.dishes.find((d) => d.id === id))
        .filter((d): d is Dish => !!d && db.restaurants.some((r) => r.id === d.restaurantId && r.enabled))
        .map((d) => ({ dish: d, restaurantName: db.restaurants.find((r) => r.id === d.restaurantId)!.name })),
    })));
  },

  addRecentSearch(q: string): Promise<string[]> {
    return call(() => write(['profile'], (db) => {
      const v = q.trim();
      if (v.length < 2) return db.profile.recentSearches;
      db.profile.recentSearches = [v, ...db.profile.recentSearches.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8);
      return db.profile.recentSearches;
    }), { fast: true, safe: true });
  },

  clearRecentSearches(): Promise<string[]> {
    return call(() => write(['profile'], (db) => { db.profile.recentSearches = []; return []; }), { fast: true, safe: true });
  },

  /** Полный сброс демо-данных: баланс, заказы, корзина, адреса и изменения админки. */
  resetDemo(): Promise<void> {
    return call(() => { resetAll(); });
  },
};
