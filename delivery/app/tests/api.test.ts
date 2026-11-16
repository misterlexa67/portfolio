import { beforeEach, describe, expect, it } from 'vitest';
import { api, ApiError } from '../src/api';
import { __resetForTests, read, write } from '../src/api/db';
import { configureNet } from '../src/api/net';
import { setNow } from '../src/api/time';
import { session } from '../src/api/storage';

// 13:00 по Москве — все рестораны открыты
const NOON = Date.UTC(2026, 10, 16, 10, 0, 0);
const noDetails = { entrance: '', floor: '', apartment: '', comment: '' };

async function expectError(p: Promise<unknown>, code: string): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe(code);
    return e as ApiError;
  }
  throw new Error(`ожидалась ошибка ${code}`);
}

const classicOpts = () => read((db) => {
  const d = db.dishes.find((x) => x.id === 'bb-classic')!;
  return { medium: d.addonGroups[0].options[0].id, bacon: d.addonGroups[1].options[1].id };
});

beforeEach(() => {
  configureNet({ latency: false });
  setNow(NOON);
  __resetForTests();
  session.remove('dostavka-est:admin');
});

describe('каталог и поиск', () => {
  it('отдаёт 6 ресторанов с доставкой до выбранного адреса', async () => {
    const list = await api.catalog.restaurants();
    expect(list).toHaveLength(6);
    expect(list.every((r) => r.inZone && r.eta && r.deliveryFee !== null)).toBe(true);
  });
  it('фильтрует бесплатную доставку и сортирует по рейтингу', async () => {
    const free = await api.catalog.restaurants({ freeDelivery: true });
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((r) => r.deliveryFee === 0)).toBe(true);
    const byRating = await api.catalog.restaurants({ sort: 'rating' });
    expect(byRating[0].rating).toBeGreaterThanOrEqual(byRating[byRating.length - 1].rating);
  });
  it('ищет блюда и исправляет раскладку', async () => {
    const r = await api.catalog.search('филадельф');
    expect(r.dishes[0].dish.id).toBe('nb-phila');
    const wrong = await api.catalog.search('ifehvf'); // «шаурма» в английской раскладке
    expect(wrong.correctedQuery).toBe('шаурма');
    expect(wrong.dishes.length).toBeGreaterThan(0);
  });
});

describe('цены считает сервис', () => {
  it('цена блюда с добавками', async () => {
    const o = classicOpts();
    const q = await api.catalog.quoteDish('bb-classic', [o.medium, o.bacon], 2);
    expect(q.valid).toBe(true);
    expect(q.unitPrice).toBe(420 + 90);
    expect(q.total).toBe(1020);
  });
  it('без обязательной добавки — невалидно', async () => {
    const q = await api.catalog.quoteDish('bb-classic', [], 1);
    expect(q.valid).toBe(false);
    await expectError(api.cart.add('bb-classic', [], 1), 'invalid');
  });
  it('корзина пересчитывается по каталогу, а не по данным клиента', async () => {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 2);
    write(['catalog'], (db) => { db.dishes.find((d) => d.id === 'bb-classic')!.price = 500; });
    const q = await api.cart.get();
    expect(q.totals.items).toBe(1000);
    expect(q.totals.service).toBe(49);
    expect(q.totals.total).toBe(1000 + q.totals.delivery + 49);
  });
});

describe('правила корзины', () => {
  it('одна корзина — один ресторан', async () => {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 1);
    const e = await expectError(api.cart.add('nb-n-salmon', [], 1), 'cart_conflict');
    expect(e.details.current).toBe('Бургер Бюро');
    const q = await api.cart.add('nb-n-salmon', [], 1, { replace: true });
    expect(q.restaurant?.id).toBe('nori-bar');
    expect(q.lines).toHaveLength(1);
  });
  it('минимальный заказ', async () => {
    await api.cart.add('bb-ketchup', [], 1);
    const q = await api.cart.get();
    expect(q.minOrderLeft).toBe(600 - 50);
    expect(q.canCheckout).toBe(false);
    await expectError(api.orders.place({ idempotencyKey: 'k-min', addressId: 'a-home', slot: { kind: 'asap' } }), 'min_order');
  });
  it('промокод ЕСТЬ10 = −10%, регистр и латиница не важны', async () => {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 3); // 1260
    const q = await api.cart.applyPromo('ecть10');
    expect(q.promo?.applied).toBe(true);
    expect(q.totals.discount).toBe(126);
    await expectError(api.cart.applyPromo('НЕТТАКОГО'), 'promo_invalid');
    await expectError(api.cart.applyPromo('НОЧЬ15'), 'promo_invalid'); // выключен
  });
  it('промокод с минимальной суммой', async () => {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 1);
    await expectError(api.cart.applyPromo('ПЕРВЫЙ200'), 'promo_min_subtotal');
  });
});

describe('оформление заказа', () => {
  async function fillCart() {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium, o.bacon], 2);
    const size = read((db) => db.dishes.find((d) => d.id === 'bb-fries')!.addonGroups[0].options[0].id);
    await api.cart.add('bb-fries', [size], 1);
  }

  it('списывает баланс ровно на итог и переводит в paid_demo', async () => {
    await fillCart();
    await api.cart.applyPromo('ЕСТЬ10');
    const quote = await api.cart.get();
    const before = (await api.wallet.get()).balance;
    const order = await api.orders.place({ idempotencyKey: 'k1', addressId: 'a-home', slot: { kind: 'asap' } });
    expect(order.status).toBe('paid_demo');
    expect(order.history.map((h) => h.status)).toEqual(['created', 'paid_demo']);
    expect(order.totals.total).toBe(quote.totals.total);
    expect((await api.wallet.get()).balance).toBe(before - quote.totals.total);
    expect((await api.cart.get()).lines).toHaveLength(0);
  });

  it('двойной клик не создаёт второй заказ', async () => {
    await fillCart();
    const input = { idempotencyKey: 'k-double', addressId: 'a-home', slot: { kind: 'asap' } as const };
    const [a, b] = await Promise.all([api.orders.place(input), api.orders.place(input)]);
    const c = await api.orders.place(input);
    expect(a.id).toBe(b.id);
    expect(c.id).toBe(a.id);
    expect(read((db) => db.orders.filter((o) => o.customer.own).length)).toBe(1);
  });

  it('не хватает баланса — заказ не создаётся, деньги не трогаются', async () => {
    write(['wallet'], (db) => { db.wallet.balance = 100; });
    await fillCart();
    const e = await expectError(api.orders.place({ idempotencyKey: 'k2', addressId: 'a-home', slot: { kind: 'asap' } }), 'insufficient_funds');
    expect(e.details.missing).toBeGreaterThan(0);
    expect((await api.wallet.get()).balance).toBe(100);
    expect((await api.cart.get()).lines.length).toBe(2);
    await api.wallet.topUp(3000);
    const ok = await api.orders.place({ idempotencyKey: 'k2', addressId: 'a-home', slot: { kind: 'asap' } });
    expect(ok.status).toBe('paid_demo');
  });

  it('адрес вне зоны доставки', async () => {
    await fillCart();
    const a = await api.profile.saveAddress({ label: '', street: 'Бор, ул. Ленина, 97', details: noDetails, point: { x: 520, y: 110 } });
    await expectError(api.orders.place({ idempotencyKey: 'k3', addressId: a.id, slot: { kind: 'asap' } }), 'out_of_zone');
  });

  it('зоны дают разную стоимость доставки', async () => {
    await fillCart();
    const center = (await api.cart.get()).totals.delivery;
    await api.profile.saveAddress({ label: '', street: 'пр. Ленина, 100', details: noDetails, point: { x: 250, y: 600 } });
    const far = await api.cart.get();
    expect(far.zone?.name).toBe('Заречная часть');
    expect(far.totals.delivery).toBe(center + 120);
  });

  it('ресторан закрыт — только ко времени', async () => {
    setNow(Date.UTC(2026, 10, 16, 5, 0, 0)); // 08:00 МСК, бургерная с 10:00
    await fillCart();
    await expectError(api.orders.place({ idempotencyKey: 'k4', addressId: 'a-home', slot: { kind: 'asap' } }), 'restaurant_closed');
    const { slots, asapAvailable } = await api.orders.slots();
    expect(asapAvailable).toBe(false);
    expect(slots.length).toBeGreaterThan(0);
    const order = await api.orders.place({ idempotencyKey: 'k4', addressId: 'a-home', slot: { kind: 'time', at: slots[0].at } });
    expect(order.status).toBe('paid_demo');
  });

  it('блюдо закончилось после добавления в корзину', async () => {
    await fillCart();
    write(['catalog'], (db) => { db.dishes.find((d) => d.id === 'bb-fries')!.available = false; });
    const q = await api.cart.get();
    expect(q.lines.find((l) => l.dishId === 'bb-fries')!.available).toBe(false);
    expect(q.canCheckout).toBe(false);
    await expectError(api.orders.place({ idempotencyKey: 'k5', addressId: 'a-home', slot: { kind: 'asap' } }), 'dish_unavailable');
  });

  it('выключенный промокод снимается при оформлении', async () => {
    await fillCart();
    await api.cart.applyPromo('ЕСТЬ10');
    write(['catalog'], (db) => { db.promos.find((p) => p.code === 'ЕСТЬ10')!.enabled = false; });
    await expectError(api.orders.place({ idempotencyKey: 'k6', addressId: 'a-home', slot: { kind: 'asap' } }), 'promo_invalid');
    expect((await api.cart.get()).promo).toBeNull();
  });
});

describe('жизненный цикл заказа', () => {
  it('статусы идут по порядку, затем оценка, чаевые и повтор', async () => {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 2);
    const order = await api.orders.place({ idempotencyKey: 'k-life', addressId: 'a-home', slot: { kind: 'asap' } });
    const seen: string[] = [];
    for (let t = 0; t <= 80; t += 1) {
      setNow(NOON + t * 1000);
      const { order: cur } = await api.orders.get(order.id);
      if (seen[seen.length - 1] !== cur.status) seen.push(cur.status);
    }
    expect(seen).toEqual(['paid_demo', 'cooking', 'picked_up', 'on_the_way', 'at_door', 'delivered']);

    await expectError(api.orders.tip(order.id, 0), 'invalid');
    const balance = (await api.wallet.get()).balance;
    await api.orders.tip(order.id, 100);
    expect((await api.wallet.get()).balance).toBe(balance - 100);
    await expectError(api.orders.tip(order.id, 50), 'conflict');
    const rated = await api.orders.rate(order.id, 5, 'Горячий и вкусный');
    expect(rated.rating?.stars).toBe(5);

    const rep = await api.orders.repeat(order.id);
    expect(rep.added).toBe(2);
    expect(rep.quote.lines[0].dishId).toBe('bb-classic');
  });

  it('админ отменяет заказ — деньги возвращаются', async () => {
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 2);
    const before = (await api.wallet.get()).balance;
    const order = await api.orders.place({ idempotencyKey: 'k-cancel', addressId: 'a-home', slot: { kind: 'asap' } });
    await api.admin.login('0000');
    await api.admin.orders.advance(order.id);
    const cancelled = await api.admin.orders.cancel(order.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.refunded).toBe(true);
    expect((await api.wallet.get()).balance).toBe(before);
    await expectError(api.admin.orders.advance(order.id), 'conflict');
  });
});

describe('админка', () => {
  it('без PIN — нет доступа', async () => {
    await expectError(api.admin.stats(), 'unauthorized');
    await expectError(api.admin.login('1234'), 'unauthorized');
  });

  it('CRUD ресторанов, блюд, промокодов и зон видно клиенту', async () => {
    await api.admin.login('0000');
    const r = await api.admin.restaurants.save({
      name: 'Тестовая кухня', tagline: 'Проверка', categoryIds: ['healthy'], cookMinutes: 10, baseDeliveryFee: 0, minOrder: 300,
      hours: { open: '00:00', close: '00:00' }, address: 'ул. Минина, 1', location: { x: 600, y: 300 },
      cover: { kind: 'still', tint: '#EEEEEE', images: ['assets/cut/healthy/caprese.webp'] },
      sections: [{ id: '', name: 'Основное' }], enabled: true,
    });
    expect((await api.catalog.restaurants()).some((x) => x.id === r.id)).toBe(true);

    const d = await api.admin.dishes.save({
      restaurantId: r.id, sectionId: r.sections[0].id, name: 'Салат дня', description: '', composition: '', price: 350, oldPrice: null,
      weight: 200, unit: 'г', calories: 200, image: 'assets/cut/healthy/caprese.webp', available: true, tags: [], addonGroups: [],
    });
    expect((await api.catalog.restaurant(r.id)).dishes[0].name).toBe('Салат дня');
    await api.admin.dishes.setAvailable(d.id, false);
    expect((await api.catalog.restaurant(r.id)).dishes[0].available).toBe(false);
    await expectError(api.cart.add(d.id, [], 1), 'dish_unavailable');

    await api.admin.restaurants.move(r.id, -1);
    const order = (await api.admin.restaurants.list()).map((x) => x.id);
    expect(order.indexOf(r.id)).toBe(order.length - 2);

    await api.admin.restaurants.setEnabled(r.id, false);
    expect((await api.catalog.restaurants()).some((x) => x.id === r.id)).toBe(false);
    await api.admin.restaurants.remove(r.id);
    await expectError(api.catalog.restaurant(r.id), 'not_found');

    const p = await api.admin.promos.save({ code: 'ЛЕТО', kind: 'fixed', value: 100, minSubtotal: 0, maxDiscount: null, description: '', enabled: true });
    const o = classicOpts();
    await api.cart.add('bb-classic', [o.medium], 2);
    expect((await api.cart.applyPromo('лето')).totals.discount).toBe(100);
    await api.admin.promos.setEnabled(p.id, false);
    expect((await api.cart.get()).promo?.applied).toBe(false);

    const before = (await api.cart.get()).totals.delivery;
    await api.admin.zones.setEnabled('z-center', false);
    expect((await api.cart.get()).zone?.name).toBe('Нагорная часть');
    expect((await api.cart.get()).totals.delivery).toBe(before + 60);
    await api.admin.zones.save({ name: 'Бор', description: '', surcharge: 300, extraMinutes: 30, enabled: true, polygon: [{ x: 400, y: 40 }, { x: 700, y: 40 }, { x: 700, y: 160 }, { x: 400, y: 160 }] });
    const bor = await api.profile.checkPoint({ x: 520, y: 110 });
    expect(bor.zone?.name).toBe('Бор');

    const s = await api.admin.settings.get();
    await api.admin.settings.save({ ...s, serviceFee: 0 });
    expect((await api.cart.get()).totals.service).toBe(0);
  });

  it('валидация форм — человеческие ошибки', async () => {
    await api.admin.login('0000');
    const e = await expectError(api.admin.dishes.save({
      restaurantId: 'burger-buro', sectionId: 'burgers', name: 'Бургер', description: '', composition: '', price: 300, oldPrice: 200,
      weight: 100, unit: 'г', calories: 100, image: 'x', available: true, tags: [], addonGroups: [],
    }), 'invalid');
    expect(e.message).toMatch(/Старая цена/);
  });

  it('сброс демо-данных покупателя сохраняет каталог владельца', async () => {
    await api.admin.login('0000');
    await api.admin.dishes.setAvailable('bb-fries', false);
    write(['wallet'], (db) => { db.wallet.balance = 5; });
    await api.profile.resetDemo();
    expect((await api.wallet.get()).balance).toBe(3000);
    expect((await api.catalog.restaurant('burger-buro')).dishes.find((d) => d.id === 'bb-fries')!.available).toBe(false);
  });
});
