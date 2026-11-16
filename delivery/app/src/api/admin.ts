// API владельца. Демо-авторизация по PIN — честно помечена в интерфейсе.
import type {
  AddonGroup, AdminStats, Dish, Order, OrderStatus, PromoCode, Restaurant, Settings, Zone,
} from './types';
import { ORDER_STATUSES } from './types';
import { emptyCart, newId, read, resetAll, write, type DB } from './db';
import { call } from './net';
import { ApiError } from './errors';
import { session } from './storage';
import { mskDayStart, mskMinutes, parseHM } from './time';
import { normalizeCode } from './pricing';
import { ACTIVE, FINAL, NEXT, trackingOf } from './tracking';
import { refund, setStatus, sync } from './orders';
import { clampToMap } from './geo';

const SESSION_KEY = 'dostavka-est:admin';

function ensure(): void {
  if (session.get(SESSION_KEY) !== 'ok') throw new ApiError('unauthorized', 'Войдите в панель владельца');
}

const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.floor(n) !== n || n < min || n > max) {
    throw new ApiError('invalid', `${label}: целое число от ${min.toLocaleString('ru-RU')} до ${max.toLocaleString('ru-RU')}`);
  }
  return n;
};
const text = (v: unknown, label: string, min = 1, max = 200): string => {
  const s = String(v ?? '').trim();
  if (s.length < min) throw new ApiError('invalid', `Заполните поле «${label}»`);
  return s.slice(0, max);
};
const hm = (v: string, label: string): string => {
  if (!/^([01]\d|2[0-4]):[0-5]\d$/.test(v) || parseHM(v) > 1440) throw new ApiError('invalid', `${label}: время в формате ЧЧ:ММ`);
  return v;
};

function move<T extends { id: string; sort: number }>(list: T[], id: string, dir: -1 | 1): void {
  const sorted = list.slice().sort((a, b) => a.sort - b.sort);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  sorted.forEach((x, k) => { x.sort = k + 1; });
}

function cleanAddons(groups: AddonGroup[]): AddonGroup[] {
  return groups.map((g) => {
    const name = text(g.name, 'Название группы добавок', 1, 40);
    if (!g.options.length) throw new ApiError('invalid', `В группе «${name}» нет вариантов`);
    return {
      id: g.id || newId('g'),
      name,
      kind: g.kind === 'single' ? 'single' : 'multi',
      required: g.kind === 'single' ? !!g.required : false,
      max: g.kind === 'multi' && g.max ? int(g.max, 'Максимум в группе', 1, 20) : undefined,
      options: g.options.map((o) => ({ id: o.id || newId('o'), name: text(o.name, 'Вариант добавки', 1, 40), price: int(o.price, `Цена «${o.name || 'варианта'}»`, 0, 10000) })),
    };
  });
}

function detachRestaurant(db: DB, id: string): void {
  if (db.cart.restaurantId === id) db.cart = emptyCart();
  db.profile.favoriteRestaurants = db.profile.favoriteRestaurants.filter((x) => x !== id);
}

export type RestaurantInput = Omit<Restaurant, 'id' | 'sort' | 'rating' | 'ratingCount'>;
export type DishInput = Omit<Dish, 'id' | 'sort'>;
export type ZoneInput = Omit<Zone, 'id' | 'sort'>;
export type PromoInput = Omit<PromoCode, 'id'>;

export const admin = {
  isAuthed(): boolean { return session.get(SESSION_KEY) === 'ok'; },

  login(pin: string): Promise<void> {
    return call(() => {
      const ok = read((db) => db.settings.adminPin) === pin.trim();
      if (!ok) throw new ApiError('unauthorized', 'Неверный PIN. В демо-версии это 0000');
      session.set(SESSION_KEY, 'ok');
    }, { safe: true });
  },

  logout(): void { session.remove(SESSION_KEY); },

  stats(): Promise<AdminStats> {
    return call(() => {
      ensure();
      sync();
      return read((db) => {
        const start = mskDayStart();
        const today = db.orders.filter((o) => o.createdAt >= start);
        const paid = today.filter((o) => o.status !== 'cancelled');
        const revenue = paid.reduce((s, o) => s + o.totals.total, 0);
        const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
        db.orders.forEach((o) => { byStatus[o.status] += 1; });
        const hourNow = Math.floor(mskMinutes() / 60);
        const hourly = Array.from({ length: hourNow + 1 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }));
        paid.forEach((o) => {
          const h = Math.floor(mskMinutes(o.createdAt) / 60);
          if (hourly[h]) { hourly[h].orders += 1; hourly[h].revenue += o.totals.total; }
        });
        const dishCount = new Map<string, number>();
        paid.forEach((o) => o.lines.forEach((l) => dishCount.set(l.name, (dishCount.get(l.name) ?? 0) + l.qty)));
        const topDishes = [...dishCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
        return {
          ordersToday: today.length,
          revenueToday: revenue,
          averageCheck: paid.length ? Math.round(revenue / paid.length) : 0,
          activeOrders: db.orders.filter((o) => ACTIVE.includes(o.status)).length,
          byStatus,
          hourly,
          topDishes,
        };
      });
    });
  },

  /* ---------- Заказы ---------- */
  orders: {
    list(status?: OrderStatus | 'active' | null): Promise<Order[]> {
      return call(() => {
        ensure();
        sync();
        return read((db) => db.orders
          .filter((o) => !status || (status === 'active' ? ACTIVE.includes(o.status) : o.status === status))
          .sort((a, b) => b.createdAt - a.createdAt));
      });
    },
    get(id: string) {
      return call(() => {
        ensure();
        sync();
        return read((db) => {
          const o = db.orders.find((x) => x.id === id);
          if (!o) throw new ApiError('not_found', 'Заказ не найден');
          return { order: o, tracking: trackingOf(db, o) };
        });
      }, { fast: true });
    },
    advance(id: string): Promise<Order> {
      return call(() => {
        ensure();
        sync();
        return write(['orders'], (db) => {
          const o = db.orders.find((x) => x.id === id);
          if (!o) throw new ApiError('not_found', 'Заказ не найден');
          const next = NEXT[o.status];
          if (!next || FINAL.includes(o.status)) throw new ApiError('conflict', 'Этот заказ уже завершён');
          setStatus(o, next);
          return o;
        });
      });
    },
    cancel(id: string): Promise<Order> {
      return call(() => {
        ensure();
        sync();
        return write(['orders', 'wallet'], (db) => {
          const o = db.orders.find((x) => x.id === id);
          if (!o) throw new ApiError('not_found', 'Заказ не найден');
          if (FINAL.includes(o.status)) throw new ApiError('conflict', 'Этот заказ уже завершён');
          setStatus(o, 'cancelled');
          refund(db, o, 'отменён рестораном');
          return o;
        });
      });
    },
  },

  /* ---------- Рестораны ---------- */
  restaurants: {
    list(): Promise<(Restaurant & { dishCount: number; unavailableCount: number })[]> {
      return call(() => {
        ensure();
        return read((db) => db.restaurants.slice().sort((a, b) => a.sort - b.sort).map((r) => {
          const ds = db.dishes.filter((d) => d.restaurantId === r.id);
          return { ...r, dishCount: ds.length, unavailableCount: ds.filter((d) => !d.available).length };
        }));
      });
    },
    save(input: RestaurantInput, id?: string): Promise<Restaurant> {
      return call(() => {
        ensure();
        return write(['catalog', 'cart'], (db) => {
          const sections = input.sections
            .map((s) => ({ id: s.id || newId('sec'), name: text(s.name, 'Раздел меню', 1, 40) }));
          if (!sections.length) throw new ApiError('invalid', 'Добавьте хотя бы один раздел меню');
          if (!input.categoryIds.length) throw new ApiError('invalid', 'Выберите категорию кухни');
          const cover = input.cover.kind === 'photo'
            ? { kind: 'photo' as const, src: text(input.cover.src, 'Обложка'), position: input.cover.position }
            : { kind: 'still' as const, tint: /^#[0-9a-f]{6}$/i.test(input.cover.tint) ? input.cover.tint : '#F3EFEA', images: input.cover.images.slice(0, 3) };
          if (cover.kind === 'still' && !cover.images.length) throw new ApiError('invalid', 'Выберите хотя бы одно фото для обложки');
          const data = {
            name: text(input.name, 'Название', 2, 40),
            tagline: text(input.tagline, 'Описание', 0, 80),
            categoryIds: input.categoryIds.filter((c) => db.categories.some((x) => x.id === c)),
            cookMinutes: int(input.cookMinutes, 'Время приготовления, мин', 5, 120),
            baseDeliveryFee: int(input.baseDeliveryFee, 'Базовая доставка, ₽', 0, 1000),
            minOrder: int(input.minOrder, 'Минимальный заказ, ₽', 0, 10000),
            hours: { open: hm(input.hours.open, 'Открытие'), close: hm(input.hours.close, 'Закрытие') },
            address: text(input.address, 'Адрес ресторана', 3, 80),
            location: clampToMap(input.location),
            cover,
            sections,
            enabled: !!input.enabled,
          };
          if (id) {
            const r = db.restaurants.find((x) => x.id === id);
            if (!r) throw new ApiError('not_found', 'Ресторан не найден');
            const removed = r.sections.filter((s) => !sections.some((n) => n.id === s.id));
            for (const s of removed) {
              if (db.dishes.some((d) => d.restaurantId === id && d.sectionId === s.id)) {
                throw new ApiError('conflict', `В разделе «${s.name}» есть блюда — сначала перенесите или удалите их`);
              }
            }
            Object.assign(r, data);
            if (!r.enabled) detachRestaurant(db, r.id);
            return r;
          }
          const r: Restaurant = { ...data, id: newId('r'), rating: 0, ratingCount: 0, sort: db.restaurants.length + 1 };
          db.restaurants.push(r);
          return r;
        });
      });
    },
    setEnabled(id: string, enabled: boolean): Promise<void> {
      return call(() => {
        ensure();
        write(['catalog', 'cart'], (db) => {
          const r = db.restaurants.find((x) => x.id === id);
          if (!r) throw new ApiError('not_found', 'Ресторан не найден');
          r.enabled = enabled;
          if (!enabled) detachRestaurant(db, id);
        });
      }, { fast: true });
    },
    move(id: string, dir: -1 | 1): Promise<void> {
      return call(() => { ensure(); write(['catalog'], (db) => move(db.restaurants, id, dir)); }, { fast: true });
    },
    remove(id: string): Promise<void> {
      return call(() => {
        ensure();
        write(['catalog', 'cart', 'profile'], (db) => {
          db.restaurants = db.restaurants.filter((r) => r.id !== id);
          const removedDishes = new Set(db.dishes.filter((d) => d.restaurantId === id).map((d) => d.id));
          db.dishes = db.dishes.filter((d) => d.restaurantId !== id);
          db.profile.favoriteDishes = db.profile.favoriteDishes.filter((d) => !removedDishes.has(d));
          detachRestaurant(db, id);
          db.restaurants.sort((a, b) => a.sort - b.sort).forEach((r, i) => { r.sort = i + 1; });
        });
      });
    },
  },

  /* ---------- Меню ---------- */
  dishes: {
    list(restaurantId: string): Promise<Dish[]> {
      return call(() => { ensure(); return read((db) => db.dishes.filter((d) => d.restaurantId === restaurantId).sort((a, b) => a.sort - b.sort)); });
    },
    save(input: DishInput, id?: string): Promise<Dish> {
      return call(() => {
        ensure();
        return write(['catalog', 'cart'], (db) => {
          const r = db.restaurants.find((x) => x.id === input.restaurantId);
          if (!r) throw new ApiError('not_found', 'Ресторан не найден');
          if (!r.sections.some((s) => s.id === input.sectionId)) throw new ApiError('invalid', 'Выберите раздел меню');
          const price = int(input.price, 'Цена, ₽', 1, 100000);
          const oldPrice = input.oldPrice === null || input.oldPrice === undefined || String(input.oldPrice) === '' ? null : int(input.oldPrice, 'Старая цена, ₽', 1, 100000);
          if (oldPrice !== null && oldPrice <= price) throw new ApiError('invalid', 'Старая цена должна быть больше текущей — иначе это не скидка');
          const data = {
            restaurantId: r.id,
            sectionId: input.sectionId,
            name: text(input.name, 'Название блюда', 2, 60),
            description: text(input.description, 'Описание', 0, 240),
            composition: text(input.composition, 'Состав', 0, 300),
            price,
            oldPrice,
            weight: int(input.weight, 'Вес / объём', 0, 5000),
            unit: (['г', 'мл', 'шт'] as const).includes(input.unit) ? input.unit : 'г',
            calories: int(input.calories, 'Калорийность, ккал', 0, 5000),
            image: text(input.image, 'Фото'),
            available: !!input.available,
            tags: input.tags.filter((t) => ['hit', 'new', 'spicy', 'veg'].includes(t)),
            addonGroups: cleanAddons(input.addonGroups),
          };
          if (id) {
            const d = db.dishes.find((x) => x.id === id);
            if (!d) throw new ApiError('not_found', 'Блюдо не найдено');
            if (d.restaurantId !== data.restaurantId) throw new ApiError('invalid', 'Блюдо нельзя перенести в другой ресторан');
            Object.assign(d, data);
            return d;
          }
          const d: Dish = { ...data, id: newId('d'), sort: db.dishes.filter((x) => x.restaurantId === r.id).length + 1 };
          db.dishes.push(d);
          return d;
        });
      });
    },
    setAvailable(id: string, available: boolean): Promise<void> {
      return call(() => {
        ensure();
        write(['catalog', 'cart'], (db) => {
          const d = db.dishes.find((x) => x.id === id);
          if (!d) throw new ApiError('not_found', 'Блюдо не найдено');
          d.available = available;
        });
      }, { fast: true });
    },
    move(id: string, dir: -1 | 1): Promise<void> {
      return call(() => {
        ensure();
        write(['catalog'], (db) => {
          const d = db.dishes.find((x) => x.id === id);
          if (!d) return;
          move(db.dishes.filter((x) => x.restaurantId === d.restaurantId), id, dir);
        });
      }, { fast: true });
    },
    remove(id: string): Promise<void> {
      return call(() => {
        ensure();
        write(['catalog', 'cart', 'profile'], (db) => {
          db.dishes = db.dishes.filter((d) => d.id !== id);
          db.cart.lines = db.cart.lines.filter((l) => l.dishId !== id);
          if (!db.cart.lines.length) db.cart = emptyCart();
          db.profile.favoriteDishes = db.profile.favoriteDishes.filter((d) => d !== id);
        });
      });
    },
  },

  /* ---------- Промокоды ---------- */
  promos: {
    list(): Promise<PromoCode[]> { return call(() => { ensure(); return read((db) => db.promos); }); },
    save(input: PromoInput, id?: string): Promise<PromoCode> {
      return call(() => {
        ensure();
        return write(['cart', 'settings'], (db) => {
          const code = text(input.code, 'Код', 3, 20).toUpperCase().replace(/\s+/g, '');
          if (db.promos.some((p) => p.id !== id && normalizeCode(p.code) === normalizeCode(code))) throw new ApiError('conflict', 'Такой код уже есть');
          const kind = input.kind === 'fixed' ? 'fixed' : 'percent';
          const data = {
            code,
            kind,
            value: kind === 'percent' ? int(input.value, 'Скидка, %', 1, 90) : int(input.value, 'Скидка, ₽', 1, 10000),
            minSubtotal: int(input.minSubtotal, 'Минимальная сумма, ₽', 0, 100000),
            maxDiscount: input.maxDiscount === null || String(input.maxDiscount) === '' ? null : int(input.maxDiscount, 'Максимальная скидка, ₽', 1, 100000),
            description: text(input.description, 'Описание', 0, 80),
            enabled: !!input.enabled,
          } as const;
          if (id) {
            const p = db.promos.find((x) => x.id === id);
            if (!p) throw new ApiError('not_found', 'Промокод не найден');
            Object.assign(p, data);
            return p;
          }
          const p: PromoCode = { ...data, id: newId('p') };
          db.promos.push(p);
          return p;
        });
      });
    },
    setEnabled(id: string, enabled: boolean): Promise<void> {
      return call(() => { ensure(); write(['cart', 'settings'], (db) => { const p = db.promos.find((x) => x.id === id); if (p) p.enabled = enabled; }); }, { fast: true });
    },
    remove(id: string): Promise<void> {
      return call(() => {
        ensure();
        write(['cart', 'settings'], (db) => {
          const p = db.promos.find((x) => x.id === id);
          db.promos = db.promos.filter((x) => x.id !== id);
          if (p && db.cart.promoCode && normalizeCode(db.cart.promoCode) === normalizeCode(p.code)) db.cart.promoCode = null;
        });
      });
    },
  },

  /* ---------- Зоны ---------- */
  zones: {
    list(): Promise<Zone[]> { return call(() => { ensure(); return read((db) => db.zones.slice().sort((a, b) => a.sort - b.sort)); }); },
    save(input: ZoneInput, id?: string): Promise<Zone> {
      return call(() => {
        ensure();
        return write(['catalog', 'cart', 'settings'], (db) => {
          if (input.polygon.length < 3) throw new ApiError('invalid', 'Отметьте на карте минимум 3 точки границы зоны');
          const data = {
            name: text(input.name, 'Название зоны', 2, 40),
            description: text(input.description, 'Описание', 0, 120),
            surcharge: int(input.surcharge, 'Надбавка к доставке, ₽', 0, 2000),
            extraMinutes: int(input.extraMinutes, 'Дополнительное время, мин', 0, 180),
            polygon: input.polygon.map(clampToMap),
            enabled: !!input.enabled,
          };
          if (id) {
            const z = db.zones.find((x) => x.id === id);
            if (!z) throw new ApiError('not_found', 'Зона не найдена');
            Object.assign(z, data);
            return z;
          }
          const z: Zone = { ...data, id: newId('z'), sort: db.zones.length + 1 };
          db.zones.push(z);
          return z;
        });
      });
    },
    setEnabled(id: string, enabled: boolean): Promise<void> {
      return call(() => { ensure(); write(['catalog', 'cart', 'settings'], (db) => { const z = db.zones.find((x) => x.id === id); if (z) z.enabled = enabled; }); }, { fast: true });
    },
    remove(id: string): Promise<void> {
      return call(() => { ensure(); write(['catalog', 'cart', 'settings'], (db) => { db.zones = db.zones.filter((z) => z.id !== id); }); });
    },
  },

  /* ---------- Настройки ---------- */
  settings: {
    get(): Promise<Settings> { return call(() => { ensure(); return read((db) => db.settings); }); },
    save(input: Omit<Settings, 'adminPin'>): Promise<Settings> {
      return call(() => {
        ensure();
        return write(['settings', 'cart', 'catalog'], (db) => {
          db.settings.serviceFee = int(input.serviceFee, 'Сервисный сбор, ₽', 0, 500);
          db.settings.startingBalance = int(input.startingBalance, 'Стартовый демо-баланс, ₽', 0, 100000);
          db.settings.demoSpeed = [0.5, 1, 2, 4].includes(input.demoSpeed) ? input.demoSpeed : 1;
          db.settings.simulateErrors = !!input.simulateErrors;
          return db.settings;
        });
      }, { safe: true });
    },
  },

  categories() { return call(() => { ensure(); return read((db) => db.categories); }, { fast: true }); },

  /** Вернуть всё к исходным демо-данным: каталог, зоны, промокоды, настройки и данные покупателя. */
  resetEverything(): Promise<void> {
    return call(() => { ensure(); resetAll('all'); });
  },
};

