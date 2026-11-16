import type { Quote } from './types';
import { emptyCart, newId, read, write, type DB } from './db';
import { call } from './net';
import { ApiError } from './errors';
import { evaluatePromo, publicQuote, quoteCart, resolveOptions } from './pricing';
import { selectedAddress } from './catalog';
import { now } from './time';

export const currentQuote = (db: DB) => publicQuote(quoteCart(db, db.cart, { address: selectedAddress(db) }));

const sameOptions = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export const cart = {
  get(): Promise<Quote> {
    return call(() => read(currentQuote), { fast: true, safe: true });
  },

  add(dishId: string, optionIds: string[], qty = 1, opts: { replace?: boolean } = {}): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      const dish = db.dishes.find((d) => d.id === dishId);
      if (!dish) throw new ApiError('not_found', 'Это блюдо убрали из меню');
      const r = db.restaurants.find((x) => x.id === dish.restaurantId);
      if (!r || !r.enabled) throw new ApiError('restaurant_off', 'Ресторан временно не принимает заказы');
      if (!dish.available) throw new ApiError('dish_unavailable', `«${dish.name}» сейчас нет в наличии`);
      const res = resolveOptions(dish, optionIds);
      if (!res.ok) throw new ApiError('invalid', res.message ?? 'Проверьте выбранные добавки');
      const n = Math.max(1, Math.min(50, Math.floor(qty)));

      if (db.cart.restaurantId && db.cart.restaurantId !== r.id && db.cart.lines.length > 0) {
        if (!opts.replace) {
          const current = db.restaurants.find((x) => x.id === db.cart.restaurantId);
          throw new ApiError('cart_conflict', 'В корзине блюда из другого ресторана', { current: current?.name ?? 'другого ресторана', next: r.name });
        }
        db.cart = emptyCart();
      }
      db.cart.restaurantId = r.id;
      const ids = res.options.map((o) => o.id);
      const existing = db.cart.lines.find((l) => l.dishId === dishId && sameOptions(l.optionIds, ids));
      if (existing) existing.qty = Math.min(50, existing.qty + n);
      else db.cart.lines.push({ id: newId('line'), dishId, qty: n, optionIds: ids });
      db.cart.updatedAt = now();
      return currentQuote(db);
    }), { fast: true });
  },

  setQty(lineId: string, qty: number): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      const line = db.cart.lines.find((l) => l.id === lineId);
      if (!line) return currentQuote(db);
      const n = Math.floor(qty);
      if (n <= 0) db.cart.lines = db.cart.lines.filter((l) => l.id !== lineId);
      else line.qty = Math.min(50, n);
      if (db.cart.lines.length === 0) db.cart = emptyCart();
      db.cart.updatedAt = now();
      return currentQuote(db);
    }), { fast: true });
  },

  /** Изменить количество блюда без учёта добавок (степпер на карточке меню). */
  setDishQty(dishId: string, qty: number): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      const lines = db.cart.lines.filter((l) => l.dishId === dishId);
      if (!lines.length) return currentQuote(db);
      const last = lines[lines.length - 1];
      const others = lines.slice(0, -1).reduce((s, l) => s + l.qty, 0);
      const n = Math.max(0, Math.floor(qty) - others);
      if (n <= 0) db.cart.lines = db.cart.lines.filter((l) => l.id !== last.id);
      else last.qty = Math.min(50, n);
      if (db.cart.lines.length === 0) db.cart = emptyCart();
      return currentQuote(db);
    }), { fast: true });
  },

  removeUnavailable(): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      db.cart.lines = db.cart.lines.filter((l) => {
        const d = db.dishes.find((x) => x.id === l.dishId);
        return d && d.available && resolveOptions(d, l.optionIds).ok;
      });
      if (db.cart.lines.length === 0) db.cart = emptyCart();
      return currentQuote(db);
    }), { fast: true });
  },

  clear(): Promise<Quote> {
    return call(() => write(['cart'], (db) => { db.cart = emptyCart(); return currentQuote(db); }), { fast: true });
  },

  setCutlery(n: number): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      db.cart.cutlery = Math.max(0, Math.min(10, Math.floor(n)));
      return currentQuote(db);
    }), { fast: true, safe: true });
  },

  setComment(text: string): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      db.cart.comment = text.slice(0, 300);
      return currentQuote(db);
    }), { fast: true, safe: true });
  },

  applyPromo(code: string): Promise<Quote> {
    return call(() => write(['cart'], (db) => {
      if (!code.trim()) throw new ApiError('promo_invalid', 'Введите промокод');
      const q = quoteCart(db, db.cart, { address: selectedAddress(db) });
      if (q.totals.items === 0) throw new ApiError('cart_empty', 'Сначала добавьте блюда в корзину');
      const res = evaluatePromo(db.promos, code, q.totals.items);
      if (!res.promo) throw new ApiError('promo_invalid', res.message);
      if (!res.applied) throw new ApiError('promo_min_subtotal', res.message);
      db.cart.promoCode = res.promo.code;
      return currentQuote(db);
    }));
  },

  removePromo(): Promise<Quote> {
    return call(() => write(['cart'], (db) => { db.cart.promoCode = null; return currentQuote(db); }), { fast: true, safe: true });
  },
};
