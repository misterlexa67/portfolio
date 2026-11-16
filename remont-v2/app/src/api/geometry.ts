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
    // пропорции меняются заметно: в длину квартира растёт быстрее, чем в глубину (kx·ky = k²)
    const kx = Math.pow(k, 1.35);
    const ky = Math.pow(k, 0.65);
    const sx = (v: number) => Math.round(v * kx * 100) / 100;
    const sy = (v: number) => Math.round(v * ky * 100) / 100;
    plan.items.forEach((room: PlanRoom) => {
      room.rects = room.rects.map((q) => ({ x: sx(q.x), y: sy(q.y), w: sx(q.w), h: sy(q.h) }));
    });
    plan.width = sx(plan.width);
    plan.depth = sy(plan.depth);
    plan.scaled = true;
    recount(plan);
  }
  return plan;
}

/* ---------- двери ---------- */

export interface Door {
  /** отрезок проёма */
  x1: number; y1: number; x2: number; y2: number;
  o: 'h' | 'v';
  /** куда открывается полотно: +1 — в сторону роста координаты, −1 — обратно */
  swing: 1 | -1;
  entrance?: boolean;
}

const DOOR_W = 0.8;

/** Двери между комнатами: из прихожей в каждую комнату, между кухней и гостиной — проём; плюс входная.
    Те же правила, что у проёмов на изометрии. */
export function planDoors(plan: FloorPlan): Door[] {
  const rooms = plan.items.filter((r) => r.kind !== 'balcony');
  const rects = rooms.flatMap((room) => room.rects.map((q) => ({ room, q })));
  const E = 0.02;
  // все общие стены между разными комнатами: A слева/сверху, B справа/снизу
  interface Shared { a: PlanRoom; b: PlanRoom; o: 'h' | 'v'; at: number; lo: number; hi: number }
  const shared: Shared[] = [];
  for (const A of rects) for (const B of rects) {
    if (A.room === B.room) continue;
    if (Math.abs(A.q.y + A.q.h - B.q.y) < E) {
      const lo = Math.max(A.q.x, B.q.x); const hi = Math.min(A.q.x + A.q.w, B.q.x + B.q.w);
      if (hi - lo > 0.75) shared.push({ a: A.room, b: B.room, o: 'h', at: B.q.y, lo, hi });
    }
    if (Math.abs(A.q.x + A.q.w - B.q.x) < E) {
      const lo = Math.max(A.q.y, B.q.y); const hi = Math.min(A.q.y + A.q.h, B.q.y + B.q.h);
      if (hi - lo > 0.75) shared.push({ a: A.room, b: B.room, o: 'v', at: B.q.x, lo, hi });
    }
  }
  const doors: Door[] = [];
  const withDoor = new Set<string>();
  const seen = new Set<string>();
  const add = (sh: Shared, open: boolean, into: PlanRoom) => {
    const m = (sh.lo + sh.hi) / 2;
    const w = Math.min(DOOR_W, sh.hi - sh.lo - 0.1);
    // жилые комнаты — дверь внутрь; санузлы и кладовые — наружу, в коридор (как принято по нормам)
    const outward = ['bath', 'wc', 'storage'].includes(into.kind);
    const toB = into === sh.b ? !outward : outward;
    const swing = (open ? 1 : toB ? 1 : -1) as 1 | -1;
    doors.push(sh.o === 'h'
      ? { x1: m - w / 2, y1: sh.at, x2: m + w / 2, y2: sh.at, o: 'h', swing }
      : { x1: sh.at, y1: m - w / 2, x2: sh.at, y2: m + w / 2, o: 'v', swing });
    withDoor.add(sh.a.id); withDoor.add(sh.b.id);
    seen.add([sh.a.id, sh.b.id].sort().join('|'));
  };
  // 1. из прихожей в каждую соседнюю комнату; кухня–гостиная — широкий проём
  for (const sh of shared) {
    const pair = [sh.a.id, sh.b.id].sort().join('|');
    if (seen.has(pair)) continue;
    const kinds = [sh.a.kind, sh.b.kind];
    const hall = kinds.includes('hall');
    const open = kinds.every((k) => k === 'kitchen' || k === 'living');
    if (hall && sh.hi - sh.lo > 1.1) add(sh, false, sh.a.kind === 'hall' ? sh.b : sh.a);
    else if (open && sh.hi - sh.lo > 1.6) add(sh, true, sh.b);
  }
  // 2. комната без двери — дверь по самой длинной общей стене (лучше в прихожую, кухню или санузел)
  const pref: Record<string, number> = { hall: 0, kitchen: 1, living: 2, bath: 3, bedroom: 4, wc: 5, storage: 6 };
  for (const room of rooms) {
    if (withDoor.has(room.id) || room.kind === 'hall') continue;
    const cands = shared
      .filter((sh) => sh.a === room || sh.b === room)
      .sort((x, y) => {
        const ox = x.a === room ? x.b : x.a; const oy = y.a === room ? y.b : y.a;
        return (pref[ox.kind] ?? 9) - (pref[oy.kind] ?? 9) || (y.hi - y.lo) - (x.hi - x.lo);
      });
    if (cands[0]) add(cands[0], false, room);
  }
  // входная дверь — на наружной стене прихожей (низ или правый край)
  const hall = rooms.find((r) => r.kind === 'hall');
  if (hall) {
    const q = [...hall.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (Math.abs(q.y + q.h - plan.depth) < E && q.w > 1.2) {
      const m = q.x + Math.min(q.w - 0.7, 0.9);
      doors.push({ x1: m - 0.45, y1: plan.depth, x2: m + 0.45, y2: plan.depth, o: 'h', swing: -1, entrance: true });
    } else if (Math.abs(q.x + q.w - plan.width) < E && q.h > 1.2) {
      const m = q.y + q.h / 2;
      doors.push({ x1: plan.width, y1: m - 0.45, x2: plan.width, y2: m + 0.45, o: 'v', swing: -1, entrance: true });
    }
  }
  return doors;
}

