// Чистые функции расчёта денег. Работают только с данными каталога —
// цены из UI сюда не попадают никогда. Используются и корзиной, и оформлением заказа.
import type {
  Address, AddonOption, Blocker, Cart, Dish, OpenHours, Point, PromoCode, Quote, QuoteLine, Restaurant, Settings, Zone,
} from './types';
import { buildRoute, pointInPolygon, travelMinutes } from './geo';
import { isOpenAt, opensAtLabel } from './time';

export interface Catalog {
  restaurants: Restaurant[];
  dishes: Dish[];
  zones: Zone[];
  promos: PromoCode[];
  settings: Settings;
}

/* ---------- Добавки ---------- */

export interface ResolvedOptions { ok: boolean; options: AddonOption[]; message: string | null }

export function resolveOptions(dish: Dish, optionIds: string[]): ResolvedOptions {
  const chosen = new Set(optionIds);
  const options: AddonOption[] = [];
  const known = new Set<string>();
  for (const group of dish.addonGroups) {
    const picked = group.options.filter((o) => chosen.has(o.id));
    group.options.forEach((o) => known.add(o.id));
    if (group.kind === 'single' && picked.length > 1) {
      return { ok: false, options: [], message: `В «${group.name}» можно выбрать только один вариант` };
    }
    if (group.required && picked.length === 0) {
      return { ok: false, options: [], message: `Выберите: ${group.name.toLowerCase()}` };
    }
    if (group.kind === 'multi' && group.max && picked.length > group.max) {
      return { ok: false, options: [], message: `В «${group.name}» — не больше ${group.max}` };
    }
    options.push(...picked);
  }
  if (optionIds.some((id) => !known.has(id))) {
    return { ok: false, options: [], message: 'Состав добавок изменился — выберите их заново' };
  }
  return { ok: true, options, message: null };
}

export const unitPrice = (dish: Dish, options: AddonOption[]): number =>
  dish.price + options.reduce((s, o) => s + o.price, 0);

/** Подпись выбранных добавок: бесплатные обязательные варианты тоже показываем. */
export const optionLabels = (options: AddonOption[]): string[] => options.map((o) => o.name);

/* ---------- Зоны и доставка ---------- */

export function zoneFor(zones: Zone[], p: Point): Zone | null {
  const list = zones.filter((z) => z.enabled && z.polygon.length >= 3).sort((a, b) => a.sort - b.sort);
  return list.find((z) => pointInPolygon(p, z.polygon)) ?? null;
}

export interface DeliveryInfo {
  zone: Zone;
  fee: number;
  eta: { min: number; max: number };
  route: Point[];
}

export function deliveryFor(catalog: Catalog, r: Restaurant, p: Point): DeliveryInfo | null {
  const zone = zoneFor(catalog.zones, p);
  if (!zone) return null;
  const route = buildRoute(r.location, p);
  const total = r.cookMinutes + travelMinutes(route) + zone.extraMinutes;
  const min = Math.max(15, Math.ceil(total / 5) * 5);
  return { zone, fee: Math.max(0, r.baseDeliveryFee + zone.surcharge), eta: { min, max: min + 10 }, route };
}

/* ---------- Промокоды ---------- */

const LOOKALIKE: Record<string, string> = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
};
/** Регистр, пробелы и латинские двойники кириллицы не важны: «ecть10» == «ЕСТЬ10». */
export const normalizeCode = (code: string): string =>
  code.trim().toUpperCase().replace(/\s+/g, '').replace(/Ё/g, 'Е').split('').map((ch) => LOOKALIKE[ch] ?? ch).join('');

export interface PromoResult { promo: PromoCode | null; applied: boolean; discount: number; message: string }

export function evaluatePromo(promos: PromoCode[], code: string, subtotal: number): PromoResult {
  const norm = normalizeCode(code);
  const promo = promos.find((p) => normalizeCode(p.code) === norm) ?? null;
  if (!promo || !promo.enabled) {
    return { promo: null, applied: false, discount: 0, message: 'Такого промокода нет или он больше не действует' };
  }
  if (subtotal < promo.minSubtotal) {
    return { promo, applied: false, discount: 0, message: `Промокод сработает в заказе от ${promo.minSubtotal.toLocaleString('ru-RU')} ₽` };
  }
  let discount = promo.kind === 'percent' ? Math.floor((subtotal * promo.value) / 100) : promo.value;
  if (promo.maxDiscount !== null) discount = Math.min(discount, promo.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { promo, applied: true, discount, message: promo.description };
}

/* ---------- Корзина ---------- */

export interface QuoteContext { address: Address | null; now?: number }

export function restaurantState(r: Restaurant, at?: number): { isOpen: boolean; opensAt: string | null; hours: OpenHours } {
  return { isOpen: isOpenAt(r.hours, at), opensAt: opensAtLabel(r.hours, at), hours: r.hours };
}

export interface FullQuote extends Quote { delivery: DeliveryInfo | null; promoResult: PromoResult | null }

export function quoteCart(catalog: Catalog, cart: Cart, ctx: QuoteContext): FullQuote {
  const blockers: Blocker[] = [];
  const r = cart.restaurantId ? catalog.restaurants.find((x) => x.id === cart.restaurantId) ?? null : null;
  const lines: QuoteLine[] = [];
  let items = 0;
  let count = 0;

  for (const line of cart.lines) {
    const dish = catalog.dishes.find((d) => d.id === line.dishId);
    if (!dish) continue; // блюдо удалено владельцем — тихо убираем из расчёта
    const resolved = resolveOptions(dish, line.optionIds);
    const available = dish.available && resolved.ok;
    const price = unitPrice(dish, resolved.ok ? resolved.options : []);
    const total = available ? price * line.qty : 0;
    if (available) { items += total; count += line.qty; }
    lines.push({
      lineId: line.id, dishId: dish.id, name: dish.name, image: dish.image, qty: line.qty,
      unitPrice: price, total, options: optionLabels(resolved.options), available,
      weight: `${dish.weight} ${dish.unit}`,
    });
  }

  if (lines.length === 0 || !r) blockers.push({ code: 'empty', message: 'Корзина пуста' });
  if (r && !r.enabled) blockers.push({ code: 'restaurant_off', message: 'Ресторан временно не принимает заказы' });
  const unavailable = lines.filter((l) => !l.available);
  if (unavailable.length) {
    blockers.push({ code: 'unavailable', message: unavailable.length === 1 ? `«${unavailable[0].name}» сейчас нет в наличии — уберите его из корзины` : 'Некоторых блюд сейчас нет в наличии — уберите их из корзины' });
  }
  const state = r ? restaurantState(r, ctx.now) : null;
  if (r && state && !state.isOpen) blockers.push({ code: 'closed', message: `Ресторан откроется в ${state.opensAt} — можно заказать ко времени` });

  let delivery: DeliveryInfo | null = null;
  if (!ctx.address) blockers.push({ code: 'no_address', message: 'Укажите адрес доставки' });
  else if (r) {
    delivery = deliveryFor(catalog, r, ctx.address.point);
    if (!delivery) blockers.push({ code: 'out_of_zone', message: 'Сюда пока не доставляем — выберите адрес в зоне доставки' });
  }

  const minOrderLeft = r ? Math.max(0, r.minOrder - items) : 0;
  if (r && items > 0 && minOrderLeft > 0) {
    blockers.push({ code: 'min_order', message: `До минимального заказа ещё ${minOrderLeft.toLocaleString('ru-RU')} ₽` });
  }

  let promoResult: PromoResult | null = null;
  if (cart.promoCode && items > 0) promoResult = evaluatePromo(catalog.promos, cart.promoCode, items);
  const discount = promoResult?.applied ? promoResult.discount : 0;
  const deliveryFee = items > 0 && delivery ? delivery.fee : 0;
  const service = items > 0 ? catalog.settings.serviceFee : 0;

  const hardBlock = blockers.some((b) => ['empty', 'restaurant_off', 'unavailable', 'min_order'].includes(b.code));

  return {
    restaurant: r && state ? { id: r.id, name: r.name, ...state } : null,
    lines,
    count,
    totals: { items, delivery: deliveryFee, service, discount, total: items + deliveryFee + service - discount },
    minOrder: r?.minOrder ?? 0,
    minOrderLeft,
    promo: cart.promoCode
      ? { code: promoResult?.promo?.code ?? cart.promoCode, applied: !!promoResult?.applied, message: promoResult?.message ?? '', discount }
      : null,
    zone: delivery ? { id: delivery.zone.id, name: delivery.zone.name } : null,
    eta: delivery?.eta ?? null,
    cutlery: cart.cutlery,
    comment: cart.comment,
    blockers,
    canCheckout: !hardBlock,
    delivery,
    promoResult,
  };
}

/** Публичная версия квоты — без внутренних полей. */
export function publicQuote(q: FullQuote): Quote {
  const { delivery: _d, promoResult: _p, ...rest } = q;
  return rest;
}
