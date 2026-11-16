import { PLANS, rectsArea } from './seed/plans';
import type { CalcParams, FloorPlan, PlanRoom } from './types';

/* Подбор планировки под параметры расчёта: типовая → нужное число комнат и санузлов → масштаб под площадь.
   Геометрия — тоже бизнес-данные, поэтому живёт в сервисном слое. */

const clone = (p: FloorPlan): FloorPlan => JSON.parse(JSON.stringify(p));

export function basePlan(house: FloorPlan['house'], rooms: number): FloorPlan {
  const r = Math.min(3, Math.max(1, rooms));
  return clone(PLANS.find((p) => p.house === house && p.rooms === r) ?? PLANS[0]);
}

function recount(plan: FloorPlan): FloorPlan {
  plan.items.forEach((i) => { i.area = rectsArea(i.rects); });
  plan.bathrooms = plan.items.filter((i) => i.kind === 'bath').length;
  plan.rooms = plan.items.filter((i) => i.kind === 'living' || i.kind === 'bedroom').length;
  plan.area = Math.round(plan.items.filter((i) => i.kind !== 'balcony').reduce((s, i) => s + i.area, 0) * 10) / 10;
  return plan;
}

/** Делит самую большую жилую комнату пополам по длинной стороне — так получается 4-я комната. */
function addRoom(plan: FloorPlan) {
  const living = plan.items
    .filter((i) => (i.kind === 'living' || i.kind === 'bedroom') && i.rects.length === 1)
    .sort((a, b) => b.area - a.area)[0];
  if (!living) return;
  const q = living.rects[0];
  const horizontal = q.w >= q.h;
  const a = horizontal ? { ...q, w: q.w / 2 } : { ...q, h: q.h / 2 };
  const b = horizontal ? { ...q, x: q.x + q.w / 2, w: q.w / 2 } : { ...q, y: q.y + q.h / 2, h: q.h / 2 };
  living.rects = [a];
  plan.items.push({ id: `bedroom-x${plan.items.length}`, kind: 'bedroom', name: 'Спальня', rects: [b], area: 0 });
}

function setBathrooms(plan: FloorPlan, n: number) {
  let baths = plan.items.filter((i) => i.kind === 'bath');
  // больше санузлов: превращаем кладовую или туалет в санузел
  while (baths.length < n) {
    const donor = plan.items.find((i) => i.kind === 'storage') ?? plan.items.find((i) => i.kind === 'wc');
    if (!donor) break;
    donor.kind = 'bath';
    donor.name = baths.length ? 'Гостевой санузел' : 'Санузел';
    baths = plan.items.filter((i) => i.kind === 'bath');
  }
  // меньше: лишний санузел становится кладовой
  while (baths.length > n) {
    const extra = baths[baths.length - 1];
    extra.kind = 'storage';
    extra.name = 'Кладовая';
    baths = plan.items.filter((i) => i.kind === 'bath');
  }
}

export function planFor(p: Pick<CalcParams, 'house' | 'rooms' | 'bathrooms' | 'area' | 'planId'>): FloorPlan {
  const plan = basePlan(p.house, p.rooms);
  if (p.rooms >= 4) addRoom(plan);
  setBathrooms(plan, p.bathrooms);
  recount(plan);
  const k = Math.sqrt(p.area / plan.area);
  if (Math.abs(k - 1) > 0.01) {
    const s = (v: number) => Math.round(v * k * 100) / 100;
    plan.items.forEach((room: PlanRoom) => {
      room.rects = room.rects.map((q) => ({ x: s(q.x), y: s(q.y), w: s(q.w), h: s(q.h) }));
    });
    plan.width = s(plan.width);
    plan.depth = s(plan.depth);
    plan.scaled = true;
    recount(plan);
  }
  return plan;
}
