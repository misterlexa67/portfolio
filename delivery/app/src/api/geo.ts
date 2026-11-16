// Стилизованная карта Нижнего Новгорода в координатах 1000×700.
// Волга течёт с запада на восток по северу карты, Ока подходит с юго-запада к Стрелке.
// Нагорная часть — восточнее Оки, Заречная — западнее. За Волгой — Бор (вне зон доставки).
import type { Point } from './types';

export const MAP_W = 1000;
export const MAP_H = 700;

export const VOLGA: Point[] = [
  { x: -20, y: 168 }, { x: 150, y: 180 }, { x: 300, y: 205 }, { x: 430, y: 238 },
  { x: 560, y: 232 }, { x: 700, y: 214 }, { x: 850, y: 196 }, { x: 1020, y: 178 },
];
export const VOLGA_WIDTH = 52;

export const OKA: Point[] = [
  { x: 230, y: 720 }, { x: 300, y: 650 }, { x: 380, y: 580 }, { x: 440, y: 500 },
  { x: 468, y: 420 }, { x: 470, y: 340 }, { x: 456, y: 262 }, { x: 452, y: 232 },
];
export const OKA_WIDTH = 34;

export interface Bridge { id: string; name: string; lower: Point; upper: Point }
export const BRIDGES: Bridge[] = [
  { id: 'kanavinsky', name: 'Канавинский мост', lower: { x: 432, y: 302 }, upper: { x: 492, y: 296 } },
  { id: 'metro', name: 'Метромост', lower: { x: 440, y: 408 }, upper: { x: 498, y: 412 } },
  { id: 'molitovsky', name: 'Молитовский мост', lower: { x: 366, y: 552 }, upper: { x: 426, y: 568 } },
];

export const LANDMARKS: { name: string; point: Point }[] = [
  { name: 'Кремль', point: { x: 560, y: 278 } },
  { name: 'Стрелка', point: { x: 432, y: 262 } },
];

const DISTRICTS: { name: string; point: Point; bank: Bank }[] = [
  { name: 'Нижегородский район', point: { x: 610, y: 320 }, bank: 'upper' },
  { name: 'Советский район', point: { x: 720, y: 480 }, bank: 'upper' },
  { name: 'Приокский район', point: { x: 760, y: 630 }, bank: 'upper' },
  { name: 'Канавинский район', point: { x: 380, y: 310 }, bank: 'lower' },
  { name: 'Московский район', point: { x: 240, y: 300 }, bank: 'lower' },
  { name: 'Сормовский район', point: { x: 110, y: 250 }, bank: 'lower' },
  { name: 'Ленинский район', point: { x: 340, y: 450 }, bank: 'lower' },
  { name: 'Автозаводский район', point: { x: 200, y: 590 }, bank: 'lower' },
];

/** Улицы для быстрого выбора адреса (без набора текста). */
export const STREETS: { street: string; point: Point }[] = [
  { street: 'Большая Покровская ул., 12', point: { x: 575, y: 320 } },
  { street: 'Рождественская ул., 24', point: { x: 520, y: 290 } },
  { street: 'ул. Минина, 10', point: { x: 640, y: 292 } },
  { street: 'Верхне-Волжская наб., 8', point: { x: 690, y: 262 } },
  { street: 'ул. Горького, 117', point: { x: 590, y: 380 } },
  { street: 'ул. Белинского, 61', point: { x: 650, y: 405 } },
  { street: 'ул. Ошарская, 14', point: { x: 610, y: 430 } },
  { street: 'ул. Ванеева, 110', point: { x: 760, y: 450 } },
  { street: 'ул. Родионова, 165', point: { x: 860, y: 310 } },
  { street: 'Казанское шоссе, 12', point: { x: 930, y: 360 } },
  { street: 'пр. Гагарина, 50', point: { x: 640, y: 560 } },
  { street: 'пр. Гагарина, 168', point: { x: 720, y: 660 } },
  { street: 'ул. Совнаркомовская, 5', point: { x: 400, y: 300 } },
  { street: 'Московское шоссе, 12', point: { x: 330, y: 290 } },
  { street: 'ул. Бурнаковская, 51', point: { x: 260, y: 270 } },
  { street: 'Сормовское шоссе, 15', point: { x: 170, y: 252 } },
  { street: 'пр. Ленина, 33', point: { x: 370, y: 460 } },
  { street: 'пр. Ленина, 100', point: { x: 250, y: 600 } },
  { street: 'ул. Июльских Дней, 19', point: { x: 120, y: 560 } },
  { street: 'Бор, ул. Ленина, 97', point: { x: 520, y: 110 } },
];

export type Bank = 'upper' | 'lower' | 'north';

function interpolateX(line: Point[], y: number): number | null {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    if (y >= lo && y <= hi && a.y !== b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return null;
}

function interpolateY(line: Point[], x: number): number {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    if (x >= a.x && x <= b.x) return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return line[line.length - 1].y;
}

export function bankOf(p: Point): Bank {
  if (p.y < interpolateY(VOLGA, p.x)) return 'north';
  const okaX = interpolateX(OKA, p.y);
  if (okaX === null) return p.x > 452 ? 'upper' : 'lower';
  return p.x > okaX ? 'upper' : 'lower';
}

export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(pts: Point[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
  return s;
}

/** Точка на ломаной по доле пути t ∈ [0..1]. */
export function pointAlong(pts: Point[], t: number): Point {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1 || t <= 0) return pts[0];
  if (t >= 1) return pts[pts.length - 1];
  const total = pathLength(pts);
  let target = total * t;
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (target <= seg) {
      const k = seg === 0 ? 0 : target / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

/** Маршрут курьера: если ресторан и адрес на разных берегах Оки — через ближайший мост. */
export function buildRoute(from: Point, to: Point): Point[] {
  const a = bankOf(from), b = bankOf(to);
  if (a === b || a === 'north' || b === 'north') return [from, to];
  let best: Point[] = [from, to];
  let bestLen = Infinity;
  for (const br of BRIDGES) {
    const start = a === 'upper' ? br.upper : br.lower;
    const end = a === 'upper' ? br.lower : br.upper;
    const r = [from, start, end, to];
    const len = pathLength(r);
    if (len < bestLen) { bestLen = len; best = r; }
  }
  return best;
}

/** 1 px карты ≈ 20 м. Курьер на самокате — ~22 км/ч по городу. */
export const PX_TO_KM = 0.02;
export const travelMinutes = (route: Point[]): number => Math.round((pathLength(route) * PX_TO_KM / 22) * 60);
export const routeKm = (route: Point[]): number => Math.round(pathLength(route) * PX_TO_KM * 10) / 10;

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function districtOf(p: Point): string {
  const bank = bankOf(p);
  if (bank === 'north') return 'Бор, за Волгой';
  let best = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) {
    if (d.bank !== bank) continue;
    const k = dist(d.point, p);
    if (k < bd) { bd = k; best = d; }
  }
  return best.name;
}

export const clampToMap = (p: Point): Point => ({
  x: Math.max(0, Math.min(MAP_W, Math.round(p.x))),
  y: Math.max(0, Math.min(MAP_H, Math.round(p.y))),
});
