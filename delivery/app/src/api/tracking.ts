// Симуляция жизненного цикла заказа (ускоренная для демо).
// Статус вычисляется по времени на стороне сервиса; UI только отображает его.
import type { Order, OrderStatus, Point, Tracking } from './types';
import type { DB } from './db';
import { pointAlong } from './geo';
import { now } from './time';

/** Длительность этапов в секундах демо-времени при скорости ×1. */
export const STAGE_SECONDS: Partial<Record<OrderStatus, number>> = {
  paid_demo: 4,
  cooking: 20,
  picked_up: 6,
  on_the_way: 32,
  at_door: 10,
};

export const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  created: 'paid_demo',
  paid_demo: 'cooking',
  cooking: 'picked_up',
  picked_up: 'on_the_way',
  on_the_way: 'at_door',
  at_door: 'delivered',
};

export const FINAL: OrderStatus[] = ['delivered', 'cancelled'];
export const ACTIVE: OrderStatus[] = ['created', 'paid_demo', 'cooking', 'picked_up', 'on_the_way', 'at_door'];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  created: 'Заказ создан',
  paid_demo: 'Оплачен демо-балансом',
  cooking: 'Ресторан готовит',
  picked_up: 'Курьер забрал заказ',
  on_the_way: 'Курьер в пути',
  at_door: 'У двери',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const stageMs = (status: OrderStatus, speed: number) => ((STAGE_SECONDS[status] ?? 0) * 1000) / Math.max(0.25, speed);

/** Момент старта для заказа ко времени: начинаем готовить заранее, чтобы успеть к слоту. */
export function scheduledStart(o: Order): number | null {
  if (o.slot.kind !== 'time') return null;
  return o.slot.at - o.eta.max * 60000;
}

/** Продвигает статусы по времени. Возвращает true, если что-то изменилось. */
export function advanceOrders(db: DB, t: number = now()): boolean {
  let changed = false;
  const speed = db.settings.demoSpeed;
  for (const o of db.orders) {
    let guard = 0;
    while (!FINAL.includes(o.status) && guard++ < 10) {
      if (o.status === 'paid_demo') {
        const start = scheduledStart(o);
        if (start !== null && t < start) break;
        if (start !== null && o.stageStartedAt < start) o.stageStartedAt = start;
      }
      const end = o.stageStartedAt + stageMs(o.status, speed);
      if (t < end) break;
      const next = NEXT[o.status];
      if (!next) break;
      o.status = next;
      o.stageStartedAt = end;
      o.history.push({ status: next, at: end });
      changed = true;
    }
  }
  return changed;
}

export function needsAdvance(db: DB, t: number = now()): boolean {
  const speed = db.settings.demoSpeed;
  return db.orders.some((o) => {
    if (FINAL.includes(o.status)) return false;
    const start = o.status === 'paid_demo' ? scheduledStart(o) : null;
    if (start !== null && t < start) return false;
    return t >= Math.max(o.stageStartedAt, start ?? 0) + stageMs(o.status, speed);
  });
}

export function trackingOf(db: DB, o: Order, t: number = now()): Tracking {
  const speed = db.settings.demoSpeed;
  const start = scheduledStart(o);
  const waiting = o.status === 'paid_demo' && start !== null && t < start;
  const stageEndsAt = FINAL.includes(o.status) || waiting ? null : o.stageStartedAt + stageMs(o.status, speed);

  let minutesLeft: number | null = null;
  if (!FINAL.includes(o.status) && !waiting) {
    // оставшееся демо-время → «настоящие» минуты по прогнозу заказа
    const order: OrderStatus[] = ['paid_demo', 'cooking', 'picked_up', 'on_the_way', 'at_door'];
    const total = order.reduce((s, st) => s + stageMs(st, speed), 0);
    const idx = order.indexOf(o.status);
    let left = Math.max(0, (stageEndsAt ?? t) - t);
    for (let i = idx + 1; i < order.length; i++) left += stageMs(order[i], speed);
    minutesLeft = Math.max(1, Math.ceil((left / total) * o.eta.max));
    if (o.status === 'at_door') minutesLeft = 0;
  }
  return { status: o.status, stageStartedAt: o.stageStartedAt, stageEndsAt, serverNow: t, minutesLeft, startsAt: waiting ? start : null };
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/**
 * Позиция курьера на маршруте в момент t. Чистая функция — UI вызывает её
 * в requestAnimationFrame для плавности, данные берутся из ответа сервиса.
 */
export function courierPosition(o: Pick<Order, 'status' | 'route' | 'stageStartedAt'>, tracking: Pick<Tracking, 'stageEndsAt'>, t: number): Point | null {
  const route = o.route;
  if (!route.length) return null;
  switch (o.status) {
    case 'picked_up': return route[0];
    case 'on_the_way': {
      if (!tracking.stageEndsAt) return route[0];
      const p = (t - o.stageStartedAt) / (tracking.stageEndsAt - o.stageStartedAt);
      return pointAlong(route, easeInOut(Math.max(0, Math.min(1, p))));
    }
    case 'at_door':
    case 'delivered': return route[route.length - 1];
    default: return null;
  }
}
