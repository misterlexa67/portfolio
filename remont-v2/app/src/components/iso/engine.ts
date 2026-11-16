import type { BudgetLevel, FloorPlan, PlanRoom, RenovationType } from '../../api';
import { furnish, mainRect, tierFor, type FurnBox } from './furniture';
import { planDoors } from '../../api/geometry';
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

export interface SceneOpts {
  level: BudgetLevel; detail: 'low' | 'high'; backH?: number; innerH?: number; frontH?: number;
  type?: RenovationType;
  /** размеры «рамки» в метрах: квартира меньше рамки выглядит меньше — площадь видна глазом */
  frame?: { w: number; d: number };
}

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
    flat.push({ key: `floor-${k}`, layer: 'floor', lift: true, shapes: [{ kind: 'poly', pts: quad(0.02), fill: opts.detail === 'low' ? FLOOR_SOLID[floorMaterial(room.kind, opts.level)] ?? '#CDA77A' : `url(#${floorMaterial(room.kind, opts.level)})`, stroke: L, sw: 0.35 }] });
  }));

  // свет: тёплые пятна на полу и подвесы
  rooms.forEach((room) => {
    if (!['living', 'bedroom', 'kitchen', 'hall', 'study', 'library', 'gym', 'cinema', 'wardrobe'].includes(room.kind)) return;
    const R = mainRect(room);
    const cx = R.x + R.w / 2; const cy = R.y + R.h / 2;
    const r = Math.min(R.w, R.h) * (room.kind === 'hall' ? 0.35 : 0.42);
    const [sx, sy] = pt(cx, cy, 0.03);
    flat.push({ key: `glow-${room.id}`, layer: 'light', lift: true, shapes: [{ kind: 'ellipse', cx: sx, cy: sy, rx: 1.2247 * r * K, ry: 0.7071 * r * K, fill: 'url(#iso-glow)' }] });
    if (opts.detail === 'high' && room.kind !== 'hall' && opts.type !== 'cosmetic') {
      // дизайнерский — группа подвесов; обычный — один
      const spots: [number, number][] = opts.type === 'designer' && Math.max(R.w, R.h) > 2.6 && (room.kind === 'living' || room.kind === 'kitchen')
        ? (R.w >= R.h ? [[cx - R.w * 0.18, cy], [cx + R.w * 0.18, cy]] : [[cx, cy - R.h * 0.18], [cx, cy + R.h * 0.18]])
        : [[cx, cy]];
      const lampW = (opts.level === 'premium' || opts.type === 'designer' ? 0.24 : 0.18) * K;
      top.push({ key: `pend-${room.id}-${spots.length}`, layer: 'light', shapes: spots.flatMap(([px, py]) => {
        const [ax, ay] = pt(px, py, 2.75);
        const [bx, by] = pt(px, py, opts.type === 'designer' ? 1.95 : 2.05);
        return [
          { kind: 'line' as const, pts: `${ax.toFixed(1)},${ay.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`, stroke: pal.lineDark, sw: 0.8 },
          { kind: 'poly' as const, pts: `${(bx - lampW).toFixed(1)},${(by + 7).toFixed(1)} ${(bx + lampW).toFixed(1)},${(by + 7).toFixed(1)} ${(bx + lampW * 0.35).toFixed(1)},${by.toFixed(1)} ${(bx - lampW * 0.35).toFixed(1)},${by.toFixed(1)}`, fill: pal.lamp, stroke: L, sw: 0.5 },
          { kind: 'ellipse' as const, cx: bx, cy: by + 8, rx: lampW * 0.9, ry: 2.2, fill: '#FFE7B8', op: 0.9 },
        ];
      }) });
    }
  });

  // стены
  const step = opts.detail === 'high' ? 0.7 : 1.1;
  const doors = planDoors(plan);
  walls(plan).forEach((s, si) => {
    const isBack = s.outer === 'back';
    const h = isBack ? backH : s.outer === 'front' ? frontH : innerH;
    let parts: [number, number][] = [[s.a, s.b]];
    // проёмы — там же, где двери на чертеже
    for (const d of doors) {
      if (d.o !== s.o) continue;
      const at = d.o === 'h' ? d.y1 : d.x1;
      const lo = d.o === 'h' ? d.x1 : d.y1; const hi = d.o === 'h' ? d.x2 : d.y2;
      if (Math.abs(at - s.at) < 0.03 && (lo + hi) / 2 > s.a && (lo + hi) / 2 < s.b) parts = subtract(parts, [lo, hi]);
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
        const accent = isBack && opts.type === 'designer' && (s.rooms[0].kind === 'living' || s.rooms[0].kind === 'bedroom');
        const finish: [string, string, string] = accent ? pal.accentWall : [pal.wallTop, pal.wallL, pal.wallR];
        const item: BoxItem = { key: `${key}${accent ? '-a' : ''}`, layer: 'partitions', box, colors: [pal.wallBareTop, pal.wallBareL, pal.wallBareR], line: L, finish, o: s.o, cap: p === 0 || p === n - 1 };
        if (isBack) back.push(...wallItems(item, pal, opts.detail));
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

  // мебель: вариант по площади, комнатам и типу ремонта
  const flatFurn: Item[] = [];
  const tier = tierFor(plan.area);
  const type = opts.type ?? 'capital';
  const idx: Record<string, number> = {};
  const marks: Record<string, FurnBox['mark']> = {};
  const hasWc = rooms.some((r) => r.kind === 'wc');
  rooms.forEach((room) => {
    const n = (idx[room.kind] = (idx[room.kind] ?? -1) + 1);
    const R = mainRect(room);
    const f = furnish(room, pal, {
      tier, type, detail: opts.detail,
      bedroomIndex: room.kind === 'bedroom' ? n : 0,
      bathIndex: room.kind === 'bath' ? n : 0,
      storageIndex: room.kind === 'storage' ? n : 0,
      kitchenLiving: room.kind === 'kitchen' && (/гостин/i.test(room.name) || tier >= 4),
      backH, wallT: T, hasWc, alt: (Math.floor(plan.area / 12) % 2) as 0 | 1,
      backY: Math.abs(R.y) < 0.02,
      backX: Math.abs(R.x) < 0.02,
    });
    f.boxes.forEach((fb) => { boxes.push({ key: fb.key, layer: 'furniture', box: fb.box, colors: fb.colors, line: L }); if (fb.mark) marks[fb.key] = fb.mark; });
    f.flats.forEach((fl) => flatFurn.push({
      key: fl.key, layer: 'furniture', lift: true,
      shapes: [{ kind: 'poly', pts: poly(fl.pts), fill: fl.kind === 'rug' ? pal.rug : fl.kind === 'mat' ? '#5C5851' : pal.water, stroke: L, sw: fl.kind === 'water' ? 0.3 : 0.4 }],
    }));
    // картины и зеркала на высоких стенах
    f.art.forEach((a) => {
      const yy = T + 0.004;
      const pts: [number, number, number][] = a.plane === 'y'
        ? [[a.u0, yy, a.z0], [a.u1, yy, a.z0], [a.u1, yy, a.z1], [a.u0, yy, a.z1]]
        : [[yy, a.u0, a.z0], [yy, a.u1, a.z0], [yy, a.u1, a.z1], [yy, a.u0, a.z1]];
      back.push({ key: a.key, layer: 'furniture', shapes: [{ kind: 'poly', pts: poly(pts), fill: a.fill, stroke: a.frame, sw: 1.6 }] });
    });
  });

  // кондиционеры на задних стенах жилых комнат
  rooms.forEach((room) => {
    if (!['living', 'bedroom', 'study', 'library', 'gym', 'cinema'].includes(room.kind)) return;
    const R = mainRect(room);
    if (Math.abs(R.y) < 0.02) {
      const x0 = R.x + R.w * 0.62; const x1 = Math.min(R.x + R.w - 0.15, x0 + 0.85);
      back.push({ key: `ac-${room.id}`, layer: 'conditioner', shapes: boxShapes({ x0, x1, y0: T, y1: T + 0.22, z0: backH - 0.45, z1: backH - 0.17 }, ['#FFFFFF', '#F3F1EC', '#E2DED6'], L) });
    } else if (Math.abs(R.x) < 0.02) {
      const y0 = R.y + R.h * 0.3; const y1 = Math.min(R.y + R.h - 0.15, y0 + 0.85);
      back.push({ key: `ac-${room.id}`, layer: 'conditioner', shapes: boxShapes({ y0, y1, x0: T, x1: T + 0.22, z0: backH - 0.45, z1: backH - 0.17 }, ['#FFFFFF', '#F3F1EC', '#E2DED6'], L) });
    } else {
      // комната без высокой стены — блок на верхней части перегородки
      const x0 = R.x + R.w * 0.55; const x1 = Math.min(R.x + R.w - 0.2, x0 + 0.8);
      boxes.push({ key: `ac-${room.id}`, layer: 'conditioner', box: { x0, x1, y0: R.y + T / 2, y1: R.y + T / 2 + 0.2, z0: innerH - 0.3, z1: innerH - 0.04 }, colors: ['#FFFFFF', '#F3F1EC', '#E2DED6'], line: L });
    }
  });

  const sorted: Item[] = [];
  for (const b of sortBoxes(boxes)) {
    if (b.finish) sorted.push(...wallItems(b, pal, opts.detail));
    else {
      const shapes = boxShapes(b.box, b.colors, b.line ?? L);
      const m = marks[b.key];
      const { x0, x1, y1, z0, z1 } = b.box;
      if (m === 'door' && x1 - x0 > 0.5) {
        // фасады шкафов: вертикальные швы
        const n = Math.max(1, Math.round((x1 - x0) / 0.5));
        for (let i = 1; i < n; i++) { const x = x0 + ((x1 - x0) * i) / n; shapes.push({ kind: 'line', pts: poly([[x, y1, z0 + 0.04], [x, y1, z1 - 0.04]]), stroke: L, sw: 0.5 }); }
      }
      if (m === 'books') {
        // полки и корешки книг на фасаде стеллажа
        const shelves = Math.max(2, Math.round((z1 - z0) / 0.36));
        const tones = ['#B9A58C', '#8C9A7A', '#AD4F2D', '#D9CDBB', '#5C5851'];
        for (let i = 1; i < shelves; i++) {
          const z = z0 + ((z1 - z0) * i) / shelves;
          shapes.push({ kind: 'line', pts: poly([[x0, y1, z], [x1, y1, z]]), stroke: L, sw: 0.5 });
          if (opts.detail === 'high') {
            const w = (x1 - x0);
            for (let k = 0; k < Math.min(4, Math.floor(w / 0.35)); k++) {
              const bx = x0 + 0.06 + k * (w / Math.min(4, Math.floor(w / 0.35))); const bw = Math.min(0.22, w * 0.18);
              shapes.push({ kind: 'poly', pts: poly([[bx, y1 + 0.001, z + 0.02], [bx + bw, y1 + 0.001, z + 0.02], [bx + bw, y1 + 0.001, z + 0.26], [bx, y1 + 0.001, z + 0.26]]), fill: tones[(i + k) % tones.length], op: 0.85 });
            }
          }
        }
      }
      if (m === 'round') {
        // люк стиральной машины
        const cxm = (x0 + x1) / 2; const czm = z0 + (z1 - z0) * 0.48; const r = Math.min(x1 - x0, z1 - z0) * 0.3;
        const ring: [number, number, number][] = Array.from({ length: 14 }, (_, i) => { const t = (i / 14) * Math.PI * 2; return [cxm + Math.cos(t) * r, y1 + 0.001, czm + Math.sin(t) * r]; });
        shapes.push({ kind: 'poly', pts: poly(ring), fill: '#D5DEDF', stroke: L, sw: 0.5 });
      }
      sorted.push({ key: b.key, layer: b.layer, lift: b.layer === 'furniture', shapes });
    }
  }

  // рамка сцены: по квартире или по «рамке» (тогда маленькая квартира видна маленькой)
  const box = (w: number, d: number) => {
    const c = [pt(0, 0, backH + 0.9), pt(w, 0, backH), pt(0, d, backH), pt(w, d, -0.22), pt(0, d, -0.22), pt(w, 0, -0.22)];
    const xs = c.map((q) => q[0]); const ys = c.map((q) => q[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  };
  const pad = 14;
  const own = box(W, D);
  let minX = own.minX - pad; let maxX = own.maxX + pad; let minY = own.minY - pad; let maxY = own.maxY + pad;
  if (opts.frame) {
    const fr = box(Math.max(W, opts.frame.w), Math.max(D, opts.frame.d));
    const fw = fr.maxX - fr.minX + pad * 2; const fh = fr.maxY - fr.minY + pad * 2;
    const cx = (own.minX + own.maxX) / 2; const cy = (own.minY + own.maxY) / 2;
    minX = cx - fw / 2; maxX = cx + fw / 2; minY = cy - fh / 2; maxY = cy + fh / 2;
  }
  return {
    flat: [...flat, ...flatFurn], back, sorted, top,
    viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`,
    width: maxX - minX, height: maxY - minY,
  };
}

/** Стена = голая кладка (перегородки) + отделка поверх (слой «отделка стен»). */
function wallItems(b: BoxItem, pal: Palette, detail: SceneOpts['detail'] = 'high'): Item[] {
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
  // на телефоне — одна стена вместо двух (кладка под отделкой всё равно не видна): вдвое меньше элементов
  if (detail === 'low' && b.finish) return [{ key: `${b.key}-fin`, layer: 'partitions', shapes: shapes(b.finish) }];
  const bare: Item = { key: `${b.key}-bare`, layer: 'partitions', shapes: shapes(b.colors) };
  if (!b.finish) return [bare];
  return [bare, { key: `${b.key}-fin`, layer: 'walls', shapes: shapes(b.finish) }];
}

/** Старые стены «до демонтажа»: штриховые перегородки, которые растворяются при включении демонтажа. */
export function buildGhosts(plan: FloorPlan): Item[] {
  const out: Item[] = [];
  const rooms = plan.items.filter((r) => r.kind !== 'balcony' && r.kind !== 'storage');
  rooms.forEach((room, i) => {
    const R = mainRect(room);
    if (R.w < 1.6 || R.h < 1.6) return;
    // старая перегородка поперёк комнаты и обрывки старого пола
    const horizontal = i % 2 === 0;
    const at = horizontal ? R.y + R.h * 0.45 : R.x + R.w * 0.42;
    const b: Box = horizontal
      ? { x0: R.x + 0.2, x1: R.x + R.w * 0.7, y0: at - 0.05, y1: at + 0.05, z0: 0, z1: 0.95 }
      : { y0: R.y + 0.2, y1: R.y + R.h * 0.7, x0: at - 0.05, x1: at + 0.05, z0: 0, z1: 0.95 };
    out.push({ key: `ghost-${room.id}`, layer: 'base', shapes: boxShapes(b, ['#E6D8CC', '#D8C3B2', '#C4AB98'], 'rgba(143,63,34,0.55)') });
    const t: Box = { x0: R.x + R.w * 0.15, x1: R.x + R.w * 0.55, y0: R.y + R.h * 0.55, y1: R.y + R.h * 0.85, z0: 0.02, z1: 0.06 };
    out.push({ key: `ghost-floor-${room.id}`, layer: 'base', shapes: boxShapes(t, ['#D9CBB8', '#C9B8A3', '#B8A690'], 'rgba(143,63,34,0.35)') });
  });
  return out;
}

/** Однотонные полы для телефона: узорные заливки дорого перерисовывать на 60 fps. */
const FLOOR_SOLID: Record<string, string> = {
  'iso-wood-economy': '#E3D2B4', 'iso-wood-standard': '#CBA477', 'iso-wood-premium': '#9C7149',
  'iso-tile-economy': '#E4E1DB', 'iso-tile-standard': '#D3CDC2', 'iso-tile-premium': '#E6E1DA',
};
