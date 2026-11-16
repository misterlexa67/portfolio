import type { BudgetLevel, FloorPlan, PlanRoom, Rect, RoomKind } from '../../api';
import { PALETTES, floorMaterial, type Palette } from './materials';

/* Изометрический движок: планировка → список граней с порядком отрисовки.
   Только геометрия и цвета, без React. Слои анимируются в компоненте. */

export type LayerKey =
  | 'base' | 'screed' | 'warmFloor' | 'electrics' | 'partitions' | 'walls' | 'floor' | 'light' | 'furniture' | 'conditioner';

export const LAYER_ORDER: LayerKey[] = ['base', 'screed', 'partitions', 'electrics', 'warmFloor', 'walls', 'floor', 'light', 'furniture', 'conditioner'];

export const K = 34;                 // пикселей на метр
const C = Math.cos(Math.PI / 6);
const S = 0.5;

export const pt = (x: number, y: number, z = 0): [number, number] => [(x - y) * C * K, (x + y) * S * K - z * K];
export const poly = (pts: [number, number, number][]) => pts.map(([x, y, z]) => pt(x, y, z).map((v) => v.toFixed(1)).join(',')).join(' ');

export interface Shape {
  kind: 'poly' | 'line' | 'ellipse';
  pts?: string;              // для poly / line(polyline)
  fill?: string;
  stroke?: string;
  sw?: number;
  dash?: string;
  op?: number;
  cx?: number; cy?: number; rx?: number; ry?: number;
}
export interface Item { key: string; layer: LayerKey; shapes: Shape[]; lift?: boolean }

export interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
export interface BoxItem { key: string; layer: LayerKey; box: Box; colors: [string, string, string]; extra?: Shape[]; line?: string; finish?: [string, string, string]; o?: 'h' | 'v'; cap?: boolean }

export interface Scene { flat: Item[]; back: Item[]; sorted: Item[]; top: Item[]; viewBox: string; width: number; height: number }

export interface SceneOpts { level: BudgetLevel; detail: 'low' | 'high'; backH?: number; innerH?: number; frontH?: number }

/* ---------- грани коробки ---------- */

function wallShapes(b: Box, [top, left, right]: [string, string, string], line: string, o: 'h' | 'v'): Shape[] {
  const { x0, y0, z0, x1, y1, z1 } = b;
  // без вертикальных швов между сегментами: грани без обводки + линии только по длинным рёбрам
  const faces: Shape[] = [
    { kind: 'poly', pts: poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), fill: left, stroke: left, sw: 0.5 },
    { kind: 'poly', pts: poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), fill: right, stroke: right, sw: 0.5 },
    { kind: 'poly', pts: poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), fill: top, stroke: top, sw: 0.5 },
  ];
  const edges: [number, number, number][][] = o === 'h'
    ? [[[x0, y0, z1], [x1, y0, z1]], [[x0, y1, z1], [x1, y1, z1]], [[x0, y1, z0], [x1, y1, z0]]]
    : [[[x0, y0, z1], [x0, y1, z1]], [[x1, y0, z1], [x1, y1, z1]], [[x1, y0, z0], [x1, y1, z0]]];
  return [...faces, ...edges.map((e) => ({ kind: 'line' as const, pts: poly(e), stroke: line, sw: 0.6 }))];
}

export function boxShapes(b: Box, [top, left, right]: [string, string, string], line: string): Shape[] {
  const { x0, y0, z0, x1, y1, z1 } = b;
  return [
    { kind: 'poly', pts: poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]), fill: left, stroke: line, sw: 0.6 },   // грань +y
    { kind: 'poly', pts: poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]), fill: right, stroke: line, sw: 0.6 },  // грань +x
    { kind: 'poly', pts: poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), fill: top, stroke: line, sw: 0.6 },    // верх
  ];
}

/* Топологическая сортировка: A раньше B, если A стоит «за» B по одной из осей. */
export function sortBoxes(items: BoxItem[]): BoxItem[] {
  const n = items.length;
  const eps = 0.001;
  const key = (b: Box) => b.x0 + b.x1 + b.y0 + b.y1 + (b.z0 + b.z1) * 0.01;
  const order = [...items].sort((a, b) => key(a.box) - key(b.box));
  const indeg = new Array(n).fill(0);
  const adj: number[][] = Array.from({ length: n }, () => []);
  const ov = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - eps && b0 < a1 - eps;
  for (let i = 0; i < n; i++) {
    const A = order[i].box;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const B = order[j].box;
      const behindX = A.x1 <= B.x0 + eps && !(B.y1 <= A.y0 + eps);
      const behindY = A.y1 <= B.y0 + eps && !(B.x1 <= A.x0 + eps);
      const below = A.z1 <= B.z0 + eps && ov(A.x0, A.x1, B.x0, B.x1) && ov(A.y0, A.y1, B.y0, B.y1);
      if (behindX || behindY || below) { adj[i].push(j); indeg[j]++; }
    }
  }
  const out: BoxItem[] = [];
  const done = new Array(n).fill(false);
  const ready = order.map((_, i) => i).filter((i) => indeg[i] === 0);
  while (out.length < n) {
    if (!ready.length) { // цикл — добавляем по ключу
      const k = order.findIndex((_, i) => !done[i]);
      ready.push(k);
    }
    ready.sort((a, b) => a - b);
    const i = ready.shift()!;
    if (done[i]) continue;
    done[i] = true;
    out.push(order[i]);
    for (const j of adj[i]) if (--indeg[j] === 0 && !done[j]) ready.push(j);
  }
  return out;
}

/* ---------- стены из прямоугольников комнат ---------- */

interface Seg { o: 'h' | 'v'; at: number; a: number; b: number; rooms: [PlanRoom, PlanRoom | null]; outer: 'back' | 'front' | null }

function subtract(intervals: [number, number][], cut: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of intervals) {
    if (cut[1] <= a || cut[0] >= b) { out.push([a, b]); continue; }
    if (cut[0] > a) out.push([a, cut[0]]);
    if (cut[1] < b) out.push([cut[1], b]);
  }
  return out.filter(([a, b]) => b - a > 0.05);
}

function walls(plan: FloorPlan): Seg[] {
  const rooms = plan.items.filter((r) => r.kind !== 'balcony');
  const rects = rooms.flatMap((room) => room.rects.map((q) => ({ room, q })));
  const segs: Seg[] = [];
  const E = 0.02;
  // каждая сторона каждого прямоугольника
  rects.forEach(({ room, q }, i) => {
    const edges: { o: 'h' | 'v'; at: number; a: number; b: number; side: 'min' | 'max' }[] = [
      { o: 'h', at: q.y, a: q.x, b: q.x + q.w, side: 'min' },
      { o: 'h', at: q.y + q.h, a: q.x, b: q.x + q.w, side: 'max' },
      { o: 'v', at: q.x, a: q.y, b: q.y + q.h, side: 'min' },
      { o: 'v', at: q.x + q.w, a: q.y, b: q.y + q.h, side: 'max' },
    ];
    for (const e of edges) {
      let free: [number, number][] = [[e.a, e.b]];
      rects.forEach(({ room: r2, q: q2 }, j) => {
        if (i === j) return;
        const at2 = e.o === 'h' ? (e.side === 'min' ? q2.y + q2.h : q2.y) : (e.side === 'min' ? q2.x + q2.w : q2.x);
        if (Math.abs(at2 - e.at) > E) return;
        const a2 = e.o === 'h' ? q2.x : q2.y;
        const b2 = e.o === 'h' ? q2.x + q2.w : q2.y + q2.h;
        const lo = Math.max(e.a, a2); const hi = Math.min(e.b, b2);
        if (hi - lo <= 0.05) return;
        free = subtract(free, [lo, hi]);
        // общая стена между разными комнатами — записываем один раз (i < j)
        if (r2 !== room && i < j) segs.push({ o: e.o, at: e.at, a: lo, b: hi, rooms: [room, r2], outer: null });
      });
      for (const [a, b] of free) {
        const back = (e.o === 'h' && Math.abs(e.at) < E) || (e.o === 'v' && Math.abs(e.at) < E);
        segs.push({ o: e.o, at: e.at, a, b, rooms: [room, null], outer: back ? 'back' : 'front' });
      }
    }
  });
  return segs;
}

const hasDoor = (s: Seg) => {
  if (s.outer || !s.rooms[1]) return false;
  const kinds = [s.rooms[0].kind, s.rooms[1].kind];
  const hall = kinds.includes('hall');
  const open: RoomKind[] = ['kitchen', 'living'];
  return (hall && s.b - s.a > 1.1) || (open.includes(kinds[0]) && open.includes(kinds[1]) && s.b - s.a > 1.6);
};

/* ---------- мебель ---------- */

function mainRect(room: PlanRoom): Rect {
  return [...room.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
}

function furniture(room: PlanRoom, pal: Palette, detail: SceneOpts['detail']): { boxes: BoxItem[]; flat: Shape[] } {
  const R = mainRect(room);
  const boxes: BoxItem[] = [];
  const flat: Shape[] = [];
  const id = room.id;
  const along = R.w >= R.h * 0.8 ? 'x' : 'y';      // вдоль какой стены ставим главный предмет
  const L = pal.line;
  const add = (k: string, b: Box, c: [string, string, string], layer: LayerKey = 'furniture') =>
    boxes.push({ key: `${id}-${k}`, layer, box: b, colors: c, line: L });
  const rug = (x0: number, y0: number, x1: number, y1: number) =>
    flat.push({ kind: 'poly', pts: poly([[x0, y0, 0.01], [x1, y0, 0.01], [x1, y1, 0.01], [x0, y1, 0.01]]), fill: pal.rug, stroke: L, sw: 0.4 });
  // местная система координат «вдоль/поперёк»
  const place = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number): Box =>
    along === 'x'
      ? { x0: R.x + u0, y0: R.y + v0, x1: R.x + u1, y1: R.y + v1, z0, z1 }
      : { x0: R.x + v0, y0: R.y + u0, x1: R.x + v1, y1: R.y + u1, z0, z1 };
  const span = along === 'x' ? R.w : R.h;
  const deep = along === 'x' ? R.h : R.w;
  const mid = span / 2;

  switch (room.kind) {
    case 'living': {
      const len = Math.min(2.3, span * 0.62);
      const u0 = mid - len / 2; const u1 = mid + len / 2;
      if (detail === 'high') {
        const f = place(u0 - 0.2, 1.25, u1 + 0.2, Math.min(deep - 0.6, 2.7), 0, 0);
        rug(f.x0, f.y0, f.x1, f.y1);
      }
      add('sofa', place(u0, 0.16, u1, 1.0, 0, 0.42), pal.fabric);
      add('sofa-back', place(u0, 0.16, u1, 0.38, 0.42, 0.82), pal.fabric);
      add('sofa-arm1', place(u0, 0.38, u0 + 0.2, 1.0, 0.42, 0.6), pal.fabric);
      add('sofa-arm2', place(u1 - 0.2, 0.38, u1, 1.0, 0.42, 0.6), pal.fabric);
      add('cushion', place(u0 + 0.35, 0.4, u0 + 0.8, 0.52, 0.42, 0.72), pal.accent);
      if (deep > 2.6) add('table', place(mid - 0.5, 1.5, mid + 0.5, 2.05, 0, 0.38), pal.wood);
      if (deep > 3.4) add('tv', place(mid - 0.9, deep - 0.5, mid + 0.9, deep - 0.12, 0, 0.48), pal.wood);
      if (detail === 'high' && span > 3.2) add('plant', place(u1 + 0.35, 0.25, u1 + 0.7, 0.6, 0, 0.9), pal.plant);
      break;
    }
    case 'bedroom': {
      const bw = Math.min(1.6, span - 0.9);
      const u0 = mid - bw / 2; const u1 = mid + bw / 2;
      add('bed', place(u0, 0.14, u1, Math.min(2.1, deep - 0.5), 0, 0.42), pal.linen);
      add('head', place(u0 - 0.06, 0.12, u1 + 0.06, 0.24, 0, 0.92), pal.wood);
      add('pillow1', place(u0 + 0.12, 0.3, mid - 0.06, 0.6, 0.42, 0.55), pal.pillow);
      add('pillow2', place(mid + 0.06, 0.3, u1 - 0.12, 0.6, 0.42, 0.55), pal.pillow);
      add('throw', place(u0, 1.4, u1, Math.min(1.9, deep - 0.7), 0.42, 0.45), pal.accent);
      if (u0 > 0.6) add('stand1', place(u0 - 0.5, 0.14, u0 - 0.08, 0.52, 0, 0.5), pal.wood);
      if (span - u1 > 0.6) add('stand2', place(u1 + 0.08, 0.14, u1 + 0.5, 0.52, 0, 0.5), pal.wood);
      if (detail === 'high' && deep > 3.2) add('wardrobe', place(0.12, deep - 0.62, Math.min(1.8, span - 0.2), deep - 0.1, 0, 1.05), pal.cabinet);
      break;
    }
    case 'kitchen': {
      const len = Math.min(span - 0.2, 3.2);
      add('counter', place(0.1, 0.1, len, 0.7, 0, 0.88), pal.cabinet);
      add('top', place(0.08, 0.08, len + 0.02, 0.72, 0.88, 0.93), pal.stoneTop);
      add('sinkbox', place(len * 0.55, 0.2, len * 0.55 + 0.5, 0.6, 0.93, 0.95), pal.metal);
      if (deep > 2.6) {
        const t0 = Math.max(1.4, deep * 0.5);
        add('table', place(mid - 0.6, t0, mid + 0.6, t0 + 0.8, 0.7, 0.76), pal.wood);
        add('leg', place(mid - 0.1, t0 + 0.3, mid + 0.1, t0 + 0.5, 0, 0.7), pal.wood);
        if (detail === 'high') {
          add('chair1', place(mid - 0.95, t0 + 0.2, mid - 0.6, t0 + 0.6, 0, 0.45), pal.fabric);
          add('chair2', place(mid + 0.6, t0 + 0.2, mid + 0.95, t0 + 0.6, 0, 0.45), pal.fabric);
        }
      }
      break;
    }
    case 'bath': {
      const tub = Math.min(1.7, span - 0.15);
      if (tub > 1.2 && deep > 1.2) {
        add('tub', place(0.08, 0.08, tub, 0.8, 0, 0.55), pal.ceramic);
        flat.push({ kind: 'poly', pts: (() => { const b = place(0.2, 0.2, tub - 0.12, 0.68, 0.55, 0.55); return poly([[b.x0, b.y0, 0.56], [b.x1, b.y0, 0.56], [b.x1, b.y1, 0.56], [b.x0, b.y1, 0.56]]); })(), fill: pal.water, stroke: L, sw: 0.3 });
      } else {
        add('shower', place(0.08, 0.08, Math.min(0.95, span - 0.1), Math.min(0.95, deep - 0.1), 0, 0.06), pal.ceramic);
      }
      if (deep > 1.4) add('sink', place(span - 0.62, deep - 0.5, span - 0.12, deep - 0.1, 0.55, 0.85), pal.ceramic);
      break;
    }
    case 'wc': {
      add('toilet', place(mid - 0.2, 0.1, mid + 0.2, 0.62, 0, 0.42), pal.ceramic);
      add('tank', place(mid - 0.22, 0.08, mid + 0.22, 0.22, 0.42, 0.75), pal.ceramic);
      break;
    }
    case 'hall': {
      if (span > 1.6 && deep > 1.1) add('console', place(0.15, 0.1, Math.min(1.4, span - 0.4), 0.45, 0, 0.75), pal.cabinet);
      if (detail === 'high' && span > 2.6 && deep > 1.2) add('bench', place(span - 1.2, 0.1, span - 0.2, 0.45, 0, 0.45), pal.wood);
      break;
    }
    case 'storage': {
      if (span > 0.9 && deep > 0.9) add('shelves', place(0.1, 0.1, Math.min(span - 0.1, 1.6), 0.45, 0, 0.95), pal.cabinet);
      break;
    }
    default: break;
  }
  return { boxes, flat };
}

/* ---------- сцена ---------- */

export function buildScene(plan: FloorPlan, opts: SceneOpts): Scene {
  const pal = PALETTES[opts.level];
  const backH = opts.backH ?? 1.9;
  const innerH = opts.innerH ?? 1.0;
  const frontH = opts.frontH ?? 0.42;
  const T = 0.1;
  const rooms = plan.items.filter((r) => r.kind !== 'balcony');
  const flat: Item[] = [];
  const back: Item[] = [];
  const top: Item[] = [];
  const boxes: BoxItem[] = [];
  const L = pal.line;
  const W = plan.width; const D = plan.depth;

  // основание: плита перекрытия с торцами
  flat.push({ key: 'slab-edge', layer: 'base', shapes: boxShapes({ x0: 0, y0: 0, z0: -0.22, x1: W, y1: D, z1: 0 }, [pal.slab, pal.slabL, pal.slabR], L) });

  rooms.forEach((room) => room.rects.forEach((q, ri) => {
    const quad = (z: number) => poly([[q.x, q.y, z], [q.x + q.w, q.y, z], [q.x + q.w, q.y + q.h, z], [q.x, q.y + q.h, z]]);
    const k = `${room.id}-${ri}`;
    flat.push({ key: `screed-${k}`, layer: 'screed', shapes: [{ kind: 'poly', pts: quad(0.005), fill: 'url(#iso-screed)', stroke: L, sw: 0.3 }] });
    if (room.kind === 'bath' || room.kind === 'kitchen' || room.kind === 'wc') {
      // змеевик тёплого пола
      const pts: [number, number, number][] = [];
      const step = 0.24; const inset = 0.25;
      const x0 = q.x + inset; const x1 = q.x + q.w - inset;
      let flip = false;
      for (let y = q.y + inset; y <= q.y + q.h - inset + 0.001; y += step) {
        pts.push(flip ? [x1, y, 0.01] : [x0, y, 0.01]);
        pts.push(flip ? [x0, y, 0.01] : [x1, y, 0.01]);
        flip = !flip;
      }
      if (pts.length > 2) flat.push({ key: `wf-${k}`, layer: 'warmFloor', shapes: [{ kind: 'line', pts: poly(pts), stroke: pal.heat, sw: 1.3 }], lift: false });
    }
    // кабель по периметру + коробки
    if (ri === 0) {
      const i = 0.18;
      const loop: [number, number, number][] = [[q.x + i, q.y + i, 0.01], [q.x + q.w - i, q.y + i, 0.01], [q.x + q.w - i, q.y + q.h - i, 0.01], [q.x + i, q.y + q.h - i, 0.01], [q.x + i, q.y + i, 0.01]];
      flat.push({ key: `el-${k}`, layer: 'electrics', shapes: [
        { kind: 'line', pts: poly(loop), stroke: pal.cable, sw: 1, dash: '4 3' },
        { kind: 'poly', pts: poly([[q.x + i - 0.08, q.y + i - 0.08, 0.012], [q.x + i + 0.08, q.y + i - 0.08, 0.012], [q.x + i + 0.08, q.y + i + 0.08, 0.012], [q.x + i - 0.08, q.y + i + 0.08, 0.012]]), fill: pal.cable },
      ] });
    }
    flat.push({ key: `floor-${k}`, layer: 'floor', lift: true, shapes: [{ kind: 'poly', pts: quad(0.02), fill: `url(#${floorMaterial(room.kind, opts.level)})`, stroke: L, sw: 0.35 }] });
  }));

  // свет: тёплые пятна на полу и подвесы
  rooms.forEach((room) => {
    if (!['living', 'bedroom', 'kitchen', 'hall'].includes(room.kind)) return;
    const R = mainRect(room);
    const cx = R.x + R.w / 2; const cy = R.y + R.h / 2;
    const r = Math.min(R.w, R.h) * (room.kind === 'hall' ? 0.35 : 0.42);
    const [sx, sy] = pt(cx, cy, 0.03);
    flat.push({ key: `glow-${room.id}`, layer: 'light', lift: true, shapes: [{ kind: 'ellipse', cx: sx, cy: sy, rx: 1.2247 * r * K, ry: 0.7071 * r * K, fill: 'url(#iso-glow)' }] });
    if (opts.detail === 'high' && room.kind !== 'hall') {
      const [ax, ay] = pt(cx, cy, 2.75);
      const [bx, by] = pt(cx, cy, 2.05);
      const lampW = (opts.level === 'premium' ? 0.34 : 0.24) * K;
      top.push({ key: `pend-${room.id}`, layer: 'light', shapes: [
        { kind: 'line', pts: `${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`, stroke: pal.lineDark, sw: 0.8 },
        { kind: 'poly', pts: `${(bx - lampW).toFixed(1)},${(by + 7).toFixed(1)} ${(bx + lampW).toFixed(1)},${(by + 7).toFixed(1)} ${(bx + lampW * 0.35).toFixed(1)},${by.toFixed(1)} ${(bx - lampW * 0.35).toFixed(1)},${by.toFixed(1)}`, fill: pal.lamp, stroke: L, sw: 0.5 },
        { kind: 'ellipse', cx: bx, cy: by + 8, rx: lampW * 0.9, ry: 2.2, fill: '#FFE7B8', op: 0.9 },
      ] });
    }
  });

  // стены
  const step = opts.detail === 'high' ? 0.7 : 1.1;
  walls(plan).forEach((s, si) => {
    const isBack = s.outer === 'back';
    const h = isBack ? backH : s.outer === 'front' ? frontH : innerH;
    let parts: [number, number][] = [[s.a, s.b]];
    if (hasDoor(s)) {
      const m = (s.a + s.b) / 2;
      parts = subtract(parts, [m - 0.42, m + 0.42]);
    }
    for (const [a, b] of parts) {
      const n = isBack ? 1 : Math.max(1, Math.ceil((b - a) / step));
      for (let p = 0; p < n; p++) {
        const u0 = a + ((b - a) * p) / n; const u1 = a + ((b - a) * (p + 1)) / n;
        const lo = isBack ? s.at - T : s.outer === 'front' ? s.at - T : s.at - T / 2;
        const hi = isBack ? s.at : s.outer === 'front' ? s.at : s.at + T / 2;
        const box: Box = s.o === 'h'
          ? { x0: u0, x1: u1, y0: isBack ? 0 : lo, y1: isBack ? T : hi, z0: 0, z1: h }
          : { y0: u0, y1: u1, x0: isBack ? 0 : lo, x1: isBack ? T : hi, z0: 0, z1: h };
        const key = `w${si}-${p}-${a.toFixed(2)}`;
        const item: BoxItem = { key, layer: 'partitions', box, colors: [pal.wallBareTop, pal.wallBareL, pal.wallBareR], line: L, finish: [pal.wallTop, pal.wallL, pal.wallR], o: s.o, cap: p === 0 || p === n - 1 };
        if (isBack) back.push(...wallItems(item, pal));
        else boxes.push(item);
      }
    }
  });

  // окна и розетки на задних стенах
  rooms.forEach((room) => {
    const R = mainRect(room);
    if (Math.abs(R.y) < 0.02 && ['living', 'bedroom', 'kitchen'].includes(room.kind)) {
      const ww = Math.min(1.5, R.w * 0.45);
      const x0 = R.x + R.w / 2 - ww / 2; const x1 = x0 + ww;
      const yy = T + 0.002;
      back.push({ key: `win-${room.id}`, layer: 'partitions', shapes: [
        { kind: 'poly', pts: poly([[x0, yy, 0.85], [x1, yy, 0.85], [x1, yy, Math.min(backH - 0.12, 1.85)], [x0, yy, Math.min(backH - 0.12, 1.85)]]), fill: pal.glass, stroke: pal.lineDark, sw: 0.9 },
        { kind: 'line', pts: poly([[(x0 + x1) / 2, yy, 0.85], [(x0 + x1) / 2, yy, Math.min(backH - 0.12, 1.85)]]), stroke: pal.lineDark, sw: 0.7 },
        { kind: 'poly', pts: poly([[x0 - 0.05, yy, 0.8], [x1 + 0.05, yy, 0.8], [x1 + 0.05, yy + 0.18, 0.8], [x0 - 0.05, yy + 0.18, 0.8]]), fill: pal.wallTop, stroke: L, sw: 0.5 },
      ] });
      back.push({ key: `sock-${room.id}`, layer: 'electrics', shapes: [0.25, 0.75].map((f) => {
        const sx = R.x + R.w * f;
        return { kind: 'poly' as const, pts: poly([[sx - 0.05, yy, 0.25], [sx + 0.05, yy, 0.25], [sx + 0.05, yy, 0.35], [sx - 0.05, yy, 0.35]]), fill: pal.cable };
      }) });
    }
  });

  // мебель
  const flatFurn: Item[] = [];
  rooms.forEach((room) => {
    const f = furniture(room, pal, opts.detail);
    boxes.push(...f.boxes);
    if (f.flat.length) flatFurn.push({ key: `rug-${room.id}`, layer: 'furniture', shapes: f.flat, lift: true });
  });

  // кондиционеры на задних стенах жилых комнат
  rooms.forEach((room) => {
    if (room.kind !== 'living' && room.kind !== 'bedroom') return;
    const R = mainRect(room);
    if (Math.abs(R.y) < 0.02) {
      const x0 = R.x + R.w * 0.62; const x1 = Math.min(R.x + R.w - 0.15, x0 + 0.85);
      back.push({ key: `ac-${room.id}`, layer: 'conditioner', shapes: boxShapes({ x0, x1, y0: T, y1: T + 0.22, z0: backH - 0.45, z1: backH - 0.17 }, ['#FFFFFF', '#F3F1EC', '#E2DED6'], L) });
    } else if (Math.abs(R.x) < 0.02) {
      const y0 = R.y + R.h * 0.3; const y1 = Math.min(R.y + R.h - 0.15, y0 + 0.85);
      back.push({ key: `ac-${room.id}`, layer: 'conditioner', shapes: boxShapes({ y0, y1, x0: T, x1: T + 0.22, z0: backH - 0.45, z1: backH - 0.17 }, ['#FFFFFF', '#F3F1EC', '#E2DED6'], L) });
    }
  });

  const sorted: Item[] = [];
  for (const b of sortBoxes(boxes)) {
    if (b.finish) sorted.push(...wallItems(b, pal));
    else sorted.push({ key: b.key, layer: b.layer, lift: b.layer === 'furniture', shapes: boxShapes(b.box, b.colors, b.line ?? L) });
  }

  // рамка сцены
  const corners = [pt(0, 0, backH + 0.9), pt(W, 0, backH), pt(0, D, backH), pt(W, D, -0.22), pt(0, D, -0.22), pt(W, 0, -0.22)];
  const xs = corners.map((c) => c[0]); const ys = corners.map((c) => c[1]);
  const pad = 14;
  const minX = Math.min(...xs) - pad; const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad; const maxY = Math.max(...ys) + pad;
  return {
    flat: [...flat, ...flatFurn], back, sorted, top,
    viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`,
    width: maxX - minX, height: maxY - minY,
  };
}

/** Стена = голая кладка (перегородки) + отделка поверх (слой «отделка стен»). */
function wallItems(b: BoxItem, pal: Palette): Item[] {
  const shapes = (c: [string, string, string]) => {
    const out = wallShapes(b.box, c, b.line ?? pal.line, b.o ?? 'h');
    // торцы стен у проёмов и концов — с линией
    if (b.cap) {
      const { x0, y0, z0, x1, y1, z1 } = b.box;
      out.push(b.o === 'v'
        ? { kind: 'line', pts: poly([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]), stroke: b.line ?? pal.line, sw: 0.6 }
        : { kind: 'line', pts: poly([[x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]), stroke: b.line ?? pal.line, sw: 0.6 });
    }
    return out;
  };
  const bare: Item = { key: `${b.key}-bare`, layer: 'partitions', shapes: shapes(b.colors) };
  if (!b.finish) return [bare];
  return [bare, { key: `${b.key}-fin`, layer: 'walls', shapes: shapes(b.finish) }];
}
