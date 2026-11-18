import type { Order, OrderStatus, Quote, Slot, Tracking } from './types';
import { emptyCart, newId, read, write, type DB } from './db';
import { call } from './net';
import { ApiError } from './errors';
import { quoteCart, resolveOptions } from './pricing';
import { currentQuote } from './cart';
import { COURIERS } from './seed';
import { buildSlots, now, mskLabel } from './time';
import { ACTIVE, advanceOrders, FINAL, needsAdvance, NEXT, trackingOf } from './tracking';

/** Ленивая симуляция: перед чтением продвигаем статусы, если подошло время. */
export function sync(): void {
  if (read((db) => needsAdvance(db))) write(['orders'], (db) => { advanceOrders(db); });
}

export function refund(db: DB, o: Order, reason: string): void {
  if (o.refunded || !o.customer.own) return;
  const paid = o.history.some((h) => h.status === 'paid_demo');
  if (!paid) return;
  db.wallet.balance += o.totals.total;
  db.wallet.transactions.unshift({ id: newId('txn'), kind: 'refund', amount: o.totals.total, at: now(), title: `Возврат за заказ №${o.number} · ${reason}`, orderId: o.id });
  o.refunded = true;
}

export function setStatus(o: Order, status: OrderStatus, t: number = now()): void {
  o.status = status;
  o.stageStartedAt = t;
  o.history.push({ status, at: t });
}

export interface PlaceOrderInput { idempotencyKey: string; addressId: string; slot: Slot }

const inflight = new Map<string, Promise<Order>>();

type PlaceError = { code: ApiError['code']; message: string; details: Record<string, unknown> };
type PlaceResult = { order: Order } | { error: PlaceError };
const fail = (e: ApiError): { error: PlaceError } => ({ error: { code: e.code, message: e.message, details: e.details } });

function placeInDb(db: DB, input: PlaceOrderInput): PlaceResult {
  // 0. Идемпотентность: повторный запрос с тем же ключом возвращает тот же заказ
  const existingId = db.idempotency[input.idempotencyKey];
  if (existingId) {
    const existing = db.orders.find((o) => o.id === existingId);
    if (existing) return { order: existing };
  }

  // 1. Корзина и адрес
  if (!db.cart.lines.length || !db.cart.restaurantId) return fail(new ApiError('cart_empty', 'Корзина пуста — добавьте что-нибудь вкусное'));
  const address = db.profile.addresses.find((a) => a.id === input.addressId);
  if (!address) return fail(new ApiError('no_address', 'Выберите адрес доставки'));

  // 2. Пересчёт всех цен по каталогу (цены из UI не принимаются)
  const q = quoteCart(db, db.cart, { address });
  const r = db.restaurants.find((x) => x.id === db.cart.restaurantId);
  if (!r || !r.enabled) return fail(new ApiError('restaurant_off', 'Ресторан временно не принимает заказы'));
  const bad = q.lines.filter((l) => !l.available);
  if (bad.length) {
    return fail(new ApiError('dish_unavailable', bad.length === 1 ? `«${bad[0].name}» только что закончился. Уберите его — и можно оформлять.` : 'Некоторые блюда только что закончились. Уберите их — и можно оформлять.'));
  }
  if (db.cart.promoCode && !q.promoResult?.applied) {
    const msg = q.promoResult?.message ?? 'Промокод больше не действует';
    db.cart.promoCode = null;
    return fail(new ApiError('promo_invalid', `${msg}. Мы убрали его — проверьте новую сумму.`));
  }

  // 3. Ресторан открыт (или слот корректен) и минимальная сумма набрана
  if (q.minOrderLeft > 0) return fail(new ApiError('min_order', `До минимального заказа ещё ${q.minOrderLeft.toLocaleString('ru-RU')} ₽`));

  // 4. Зона доставки
  if (!q.delivery) return fail(new ApiError('out_of_zone', 'По этому адресу пока не доставляем. Выберите точку в одной из зон на карте.'));

  if (input.slot.kind === 'asap') {
    if (!q.restaurant?.isOpen) return fail(new ApiError('restaurant_closed', `Ресторан сейчас закрыт и откроется в ${q.restaurant?.opensAt}. Выберите время доставки.`));
  } else {
    const slots = buildSlots(r.hours, q.delivery.eta.max);
    if (!slots.includes(input.slot.at)) return fail(new ApiError('slot_invalid', 'Это время уже недоступно — выберите другое'));
  }

  // 5. Баланс
  const total = q.totals.total;
  if (db.wallet.balance < total) {
    return fail(new ApiError('insufficient_funds', 'На балансе не хватает средств', { need: total, balance: db.wallet.balance, missing: total - db.wallet.balance }));
  }

  // 6. Атомарно: списание + создание заказа + очистка корзины
  const t = now();
  db.orderSeq += 1;
  const dishImage = db.dishes.find((d) => d.restaurantId === r.id)?.image ?? '';
  const order: Order = {
    id: newId('o'),
    number: String(db.orderSeq),
    idempotencyKey: input.idempotencyKey,
    createdAt: t,
    customer: { own: true, name: 'Вы' },
    restaurant: { id: r.id, name: r.name, address: r.address, location: r.location, image: r.cover.kind === 'photo' ? r.cover.src : dishImage },
    lines: q.lines.map((l) => {
      const cartLine = db.cart.lines.find((c) => c.id === l.lineId)!;
      return { dishId: l.dishId, name: l.name, image: l.image, qty: l.qty, unitPrice: l.unitPrice, total: l.total, options: l.options, optionIds: cartLine.optionIds };
    }),
    totals: q.totals,
    promoCode: q.promoResult?.applied ? q.promoResult.promo!.code : null,
    address: JSON.parse(JSON.stringify(address)),
    zone: { id: q.delivery.zone.id, name: q.delivery.zone.name },
    slot: input.slot,
    cutlery: db.cart.cutlery,
    comment: db.cart.comment,
    status: 'created',
    history: [{ status: 'created', at: t }],
    stageStartedAt: t,
    route: q.delivery.route,
    courier: COURIERS[db.orderSeq % COURIERS.length],
    eta: q.delivery.eta,
    rating: null,
    tip: 0,
    refunded: false,
  };
  db.wallet.balance -= total;
  db.wallet.transactions.unshift({ id: newId('txn'), kind: 'order', amount: -total, at: t, title: `Заказ №${order.number} · ${r.name}`, orderId: order.id });
  setStatus(order, 'paid_demo', t); // деньги списаны — только теперь заказ оплачен
  db.orders.unshift(order);
  db.idempotency[input.idempotencyKey] = order.id;
  db.cart = { ...emptyCart(), cutlery: 1 };

  // 7. Подтверждение
  return { order };
}

const own = (db: DB) => db.orders.filter((o) => o.customer.own);

export const orders = {
  place(input: PlaceOrderInput): Promise<Order> {
    const pending = inflight.get(input.idempotencyKey);
    if (pending) return pending; // двойной клик — тот же запрос
    const p = call(() => {
      const res = write(['cart', 'orders', 'wallet'], (db) => placeInDb(db, input));
      if ('error' in res) {
        throw new ApiError(res.error.code, res.error.message, res.error.details);
      }
      return res.order;
    });
    inflight.set(input.idempotencyKey, p);
    p.then(() => inflight.delete(input.idempotencyKey), () => inflight.delete(input.idempotencyKey));
    return p;
  },

  /** Варианты времени доставки для текущей корзины. */
  slots(): Promise<{ asapAvailable: boolean; opensAt: string | null; slots: { at: number; label: string }[] }> {
    return call(() => read((db) => {
      const q = quoteCart(db, db.cart, { address: db.profile.addresses.find((a) => a.id === db.profile.selectedAddressId) ?? null });
      const r = db.restaurants.find((x) => x.id === db.cart.restaurantId);
      if (!r) return { asapAvailable: false, opensAt: null, slots: [] };
      const lead = q.delivery?.eta.max ?? r.cookMinutes + 30;
      const slots = buildSlots(r.hours, lead).map((at) => ({ at, label: mskLabel(at) }));
      return { asapAvailable: !!q.restaurant?.isOpen, opensAt: q.restaurant?.opensAt ?? null, slots };
    }), { fast: true, safe: true });
  },

  get(id: string): Promise<{ order: Order; tracking: Tracking }> {
    return call(() => {
      sync();
      return read((db) => {
        const o = db.orders.find((x) => x.id === id && x.customer.own);
        if (!o) throw new ApiError('not_found', 'Заказ не найден');
        return { order: o, tracking: trackingOf(db, o) };
      });
    }, { fast: true, safe: true });
  },

  list(): Promise<Order[]> {
    return call(() => { sync(); return read((db) => own(db).sort((a, b) => b.createdAt - a.createdAt)); });
  },

  active(): Promise<{ order: Order; tracking: Tracking }[]> {
    return call(() => {
      sync();
      return read((db) => own(db).filter((o) => ACTIVE.includes(o.status)).map((o) => ({ order: o, tracking: trackingOf(db, o) })));
    }, { fast: true, safe: true });
  },

  cancel(id: string): Promise<Order> {
    return call(() => {
      sync();
      return write(['orders', 'wallet'], (db) => {
        const o = db.orders.find((x) => x.id === id && x.customer.own);
        if (!o) throw new ApiError('not_found', 'Заказ не найден');
        if (!['created', 'paid_demo'].includes(o.status)) throw new ApiError('conflict', 'Ресторан уже готовит заказ — отменить его нельзя');
        setStatus(o, 'cancelled');
        refund(db, o, 'отмена');
        return o;
      });
    });
  },

  rate(id: string, stars: number, comment: string): Promise<Order> {
    return call(() => write(['orders'], (db) => {
      const o = db.orders.find((x) => x.id === id && x.customer.own);
      if (!o) throw new ApiError('not_found', 'Заказ не найден');
      if (o.status !== 'delivered') throw new ApiError('conflict', 'Оценить можно после доставки');
      const s = Math.round(stars);
      if (s < 1 || s > 5) throw new ApiError('invalid', 'Поставьте от 1 до 5 звёзд');
      o.rating = { stars: s, comment: comment.trim().slice(0, 500), at: now() };
      return o;
    }));
  },

  tip(id: string, amount: number): Promise<Order> {
    return call(() => write(['orders', 'wallet'], (db) => {
      const o = db.orders.find((x) => x.id === id && x.customer.own);
      if (!o) throw new ApiError('not_found', 'Заказ не найден');
      if (o.status !== 'delivered') throw new ApiError('conflict', 'Чаевые можно оставить после доставки');
      if (o.tip > 0) throw new ApiError('conflict', 'Вы уже поблагодарили курьера за этот заказ');
      const a = Math.floor(amount);
      if (!(a > 0 && a <= 1000)) throw new ApiError('invalid', 'Сумма чаевых — от 1 до 1 000 ₽');
      if (db.wallet.balance < a) throw new ApiError('insufficient_funds', 'На балансе не хватает средств на чаевые', { need: a, balance: db.wallet.balance, missing: a - db.wallet.balance });
      db.wallet.balance -= a;
      db.wallet.transactions.unshift({ id: newId('txn'), kind: 'tip', amount: -a, at: now(), title: `Чаевые курьеру ${o.courier.name} · №${o.number}`, orderId: o.id });
      o.tip = a;
      return o;
    }));
  },

  /** Повторить заказ: собирает корзину по актуальному меню и ценам. */
  repeat(id: string, opts: { replace?: boolean } = {}): Promise<{ quote: Quote; skipped: string[]; added: number }> {
    return call(() => write(['cart'], (db) => {
      const o = db.orders.find((x) => x.id === id && x.customer.own);
      if (!o) throw new ApiError('not_found', 'Заказ не найден');
      const r = db.restaurants.find((x) => x.id === o.restaurant.id);
      if (!r || !r.enabled) throw new ApiError('restaurant_off', `«${o.restaurant.name}» сейчас не принимает заказы`);
      if (db.cart.restaurantId && db.cart.restaurantId !== r.id && db.cart.lines.length && !opts.replace) {
        const current = db.restaurants.find((x) => x.id === db.cart.restaurantId);
        throw new ApiError('cart_conflict', 'В корзине блюда из другого ресторана', { current: current?.name ?? '', next: r.name });
      }
      if (db.cart.restaurantId !== r.id) db.cart = emptyCart();
      db.cart.restaurantId = r.id;
      const skipped: string[] = [];
      let added = 0;
      for (const l of o.lines) {
        const d = db.dishes.find((x) => x.id === l.dishId);
        if (!d || !d.available || !resolveOptions(d, l.optionIds).ok) { skipped.push(l.name); continue; }
        const ex = db.cart.lines.find((c) => c.dishId === d.id && c.optionIds.slice().sort().join() === l.optionIds.slice().sort().join());
        if (ex) ex.qty = Math.min(50, ex.qty + l.qty);
        else db.cart.lines.push({ id: newId('line'), dishId: d.id, qty: l.qty, optionIds: l.optionIds.slice() });
        added += l.qty;
      }
      if (!db.cart.lines.length) db.cart = emptyCart();
      if (added === 0) throw new ApiError('dish_unavailable', 'Блюд из этого заказа сейчас нет в наличии');
      db.cart.updatedAt = now();
      return { quote: currentQuote(db), skipped, added };
    }));
  },
};

export { NEXT, FINAL, ACTIVE };
