import type { PlanRoom, Rect, RenovationType } from '../../api';
import type { Palette } from './materials';

/* Мебель и техника под конкретную квартиру. Только для наглядности — в смету не входит.
   Вариант зависит от ступени площади (6 ступеней), комнаты и типа ремонта.
   Тип ремонта меняет стиль, а не количество. Всё детерминировано: те же параметры — та же расстановка.
   Ключ каждого предмета содержит вариант: при смене варианта старое уходит, новое появляется. */

export interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
export interface FurnBox { key: string; box: Box; colors: [string, string, string]; mark?: 'door' | 'round' | 'screen' | 'books' }
export interface FurnFlat { key: string; kind: 'rug' | 'water' | 'mat'; pts: [number, number, number][] }
/** Картина или зеркало на высокой задней стене. */
export interface WallArt { key: string; plane: 'x' | 'y'; u0: number; u1: number; z0: number; z1: number; fill: string; frame: string }

export type Tier = 1 | 2 | 3 | 4 | 5 | 6;
export interface FurnCtx {
  tier: Tier;
  type: RenovationType;
  detail: 'low' | 'high';
  bedroomIndex: number;
  bathIndex: number;
  storageIndex: number;
  kitchenLiving: boolean;
  backH: number;
  backY: boolean;                     // комната у задней стены y=0
  backX: boolean;                     // комната у задней стены x=0
  wallT: number;
  hasWc: boolean;
  /** вариант расстановки: меняется каждые ~12 м² площади, при тех же параметрах — тот же */
  alt: 0 | 1;
}

export const tierFor = (area: number): Tier => (area <= 35 ? 1 : area <= 55 ? 2 : area <= 80 ? 3 : area <= 120 ? 4 : area <= 180 ? 5 : 6);

export function mainRect(room: PlanRoom): Rect {
  return [...room.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
}

const DARK: [string, string, string] = ['#3A3733', '#2A2825', '#1F1D1B'];
const GLASS: [string, string, string] = ['#E8EEEC', '#DCE4E2', '#CED8D6'];

export function furnish(room: PlanRoom, pal: Palette, c: FurnCtx): { boxes: FurnBox[]; flats: FurnFlat[]; art: WallArt[] } {
  const R = mainRect(room);
  const boxes: FurnBox[] = [];
  const flats: FurnFlat[] = [];
  const art: WallArt[] = [];
  const v = `t${c.tier}${c.type[0]}${c.alt}`;
  const along = R.w >= R.h * 0.8 ? 'x' : 'y';
  const span = along === 'x' ? R.w : R.h;
  const deep = along === 'x' ? R.h : R.w;
  const A = span * deep;
  const mid = span / 2;
  const designer = c.type === 'designer';
  const cosmetic = c.type === 'cosmetic';
  const hi = c.detail === 'high';
  const fabric = designer ? pal.fabric : pal.fabric;
  const chairCol = designer ? pal.accent : cosmetic ? pal.wood : pal.fabric;

  // вариант 1 — зеркальная расстановка вдоль длинной стены
  const mu = (u0: number, u1: number): [number, number] => (c.alt ? [span - u1, span - u0] : [u0, u1]);
  const place = (a0: number, v0: number, a1: number, v1: number, z0: number, z1: number): Box => {
    const [u0, u1] = mu(a0, a1);
    return along === 'x'
      ? { x0: R.x + u0, y0: R.y + v0, x1: R.x + u1, y1: R.y + v1, z0, z1 }
      : { x0: R.x + v0, y0: R.y + u0, x1: R.x + v1, y1: R.y + u1, z0, z1 };
  };
  /** decor — мелочь, которую на телефоне не рисуем (60 fps на больших квартирах) */
  const add = (k: string, b: Box, col: [string, string, string], mark?: FurnBox['mark'], decor = false) => {
    if (decor && !hi) return;
    if (b.x1 - b.x0 < 0.05 || b.y1 - b.y0 < 0.05) return;
    if (b.x0 < R.x - 0.01 || b.y0 < R.y - 0.01 || b.x1 > R.x + R.w + 0.01 || b.y1 > R.y + R.h + 0.01) return; // не выходим за комнату
    boxes.push({ key: `${room.id}-${v}-${k}`, box: b, colors: col, mark });
  };
  const flat = (k: string, kind: FurnFlat['kind'], b: Box, z = 0.01) =>
    flats.push({ key: `${room.id}-${v}-${k}`, kind, pts: [[b.x0, b.y0, z], [b.x1, b.y0, z], [b.x1, b.y1, z], [b.x0, b.y1, z]] });
  // картина на высокой стене: по вдоль-координате u (если задняя стена комнаты — высокая)
  const wallArt = (k: string, a0: number, a1: number, z0: number, z1: number, mirror = false) => {
    if (!hi) return;
    const [u0, u1] = mu(a0, a1);
    const fill = mirror ? '#DCE4E2' : designer ? pal.accent[1] : cosmetic ? '#E9E3D9' : '#D9CDBB';
    const frame = designer ? '#2E2B27' : '#F8F4EE';
    if (along === 'x' && c.backY) art.push({ key: `${room.id}-${v}-${k}`, plane: 'y', u0: R.x + u0, u1: R.x + u1, z0, z1, fill, frame });
    else if (along === 'y' && c.backX) art.push({ key: `${room.id}-${v}-${k}`, plane: 'x', u0: R.y + u0, u1: R.y + u1, z0, z1, fill, frame });
  };
  const atBack = (along === 'x' && c.backY) || (along === 'y' && c.backX);
  const plant = (k: string, u: number, vv: number, h = 0.95) => {
    add(`${k}-pot`, place(u, vv, u + 0.32, vv + 0.32, 0, 0.3), cosmetic ? pal.ceramic : pal.cabinet, undefined, true);
    add(`${k}-leaf`, place(u - 0.06, vv - 0.06, u + 0.38, vv + 0.38, 0.3, h), pal.plant, undefined, true);
  };
  const floorLamp = (k: string, u: number, vv: number) => {
    add(`${k}-pole`, place(u + 0.1, vv + 0.1, u + 0.14, vv + 0.14, 0, 1.35), pal.metal, undefined, true);
    add(`${k}-shade`, place(u - 0.04, vv - 0.04, u + 0.28, vv + 0.28, 1.35, 1.6), designer ? ['#E6C79B', '#C9A26E', '#B08D57'] : ['#FFFFFF', '#F3EFE8', '#E2DDD4'], undefined, true);
  };
  const sofa = (k: string, u0: number, u1: number, d = 0.9, v0 = 0.16) => {
    add(k, place(u0, v0, u1, v0 + d, 0, 0.42), fabric);
    add(`${k}-back`, place(u0, v0, u1, v0 + 0.22, 0.42, 0.82), fabric);
    add(`${k}-arm1`, place(u0, v0 + 0.22, u0 + 0.2, v0 + d, 0.42, 0.6), fabric);
    add(`${k}-arm2`, place(u1 - 0.2, v0 + 0.22, u1, v0 + d, 0.42, 0.6), fabric);
    add(`${k}-cush`, place(u0 + 0.35, v0 + 0.24, u0 + 0.8, v0 + 0.36, 0.42, 0.72), pal.accent, undefined, true);
  };
  // кресло: в дизайнерском — низкое широкое «лаунж», в остальных — классическое
  const armchair = (k: string, u: number, vv: number) => {
    const h = designer ? 0.36 : 0.42;
    add(k, place(u, vv, u + 0.78, vv + 0.78, 0, h), designer ? pal.accent : fabric);
    add(`${k}-back`, place(u, vv, u + 0.78, vv + 0.2, h, designer ? 0.7 : 0.82), designer ? pal.accent : fabric);
  };
  const shelf = (k: string, u0: number, u1: number, vv: number, h: number) => add(k, place(u0, vv, u1, vv + 0.36, 0, h), pal.cabinet, 'books');
  const wardrobe = (k: string, u0: number, u1: number, back: boolean) => {
    const tall = designer && back && atBack ? c.backH - 0.05 : designer ? 1.35 : 1.1;
    add(k, back ? place(u0, 0.1, u1, 0.7, 0, tall) : place(u0, deep - 0.66, u1, deep - 0.08, 0, Math.min(tall, 1.35)), pal.cabinet, 'door');
  };
  const table = (k: string, cu: number, cv: number, seats: number) => {
    const tw = seats <= 2 ? 0.75 : seats <= 4 ? 1.2 : seats <= 6 ? 1.8 : 2.4;
    const td = seats <= 2 ? 0.75 : 0.9;
    add(k, place(cu - tw / 2, cv - td / 2, cu + tw / 2, cv + td / 2, 0.7, 0.76), pal.wood);
    add(`${k}-leg`, place(cu - 0.1, cv - 0.1, cu + 0.1, cv + 0.1, 0, 0.7), pal.wood);
    const per = Math.ceil(seats / 2);
    for (let i = 0; i < per; i++) {
      const u = cu - tw / 2 + (tw / per) * (i + 0.5) - 0.2;
      add(`${k}-c${i}a`, place(u, cv - td / 2 - 0.45, u + 0.4, cv - td / 2 - 0.05, 0, 0.45), chairCol);
      if (i < seats - per) add(`${k}-c${i}b`, place(u, cv + td / 2 + 0.05, u + 0.4, cv + td / 2 + 0.45, 0, 0.45), chairCol);
    }
  };

  switch (room.kind) {
    case 'living': {
      if (c.tier === 1) {
        const len = Math.min(2.0, span * 0.6); const u0 = mid - len / 2;
        sofa('sofabed', u0, u0 + len, 1.45);
        add('blanket', place(u0 + 0.25, 0.9, u0 + len - 0.25, 1.5, 0.42, 0.45), pal.accent);
        if (deep > 2.6) add('tv', place(mid - 0.6, deep - 0.42, mid + 0.6, deep - 0.12, 0, 0.45), pal.wood);
        if (span > 2.8) shelf('shelf', span - 0.9, span - 0.1, deep - 0.5, 1.2);
        plant('plant', 0.15, deep - 0.55);
        wallArt('art', mid - 0.5, mid + 0.5, 1.2, 1.65);
        break;
      }
      const len = Math.min(c.tier >= 5 ? 2.9 : c.tier >= 3 ? 2.6 : 2.3, span * 0.6); const u0 = mid - len / 2; const u1 = u0 + len;
      flat('rug', 'rug', place(u0 - 0.2, 1.15, u1 + 0.2, Math.min(deep - 0.75, 2.9), 0, 0));
      sofa('sofa', u0, u1);
      if (c.tier >= 4 || A > 24) add('sofa-l', place(u1 - 0.9, 1.06, u1, 1.95, 0, 0.42), fabric);
      if (deep > 2.6) add('table', place(mid - 0.55, 1.5, mid + 0.45, 2.05, 0, 0.38), pal.wood);
      if (deep > 3.1) {
        add('tv-unit', place(mid - 1.0, deep - 0.48, mid + 1.0, deep - 0.12, 0, 0.45), pal.wood, 'door');
        add('tv', place(mid - 0.65, deep - 0.3, mid + 0.65, deep - 0.25, 0.5, 1.2), DARK, 'screen');
      }
      if ((c.tier >= 5 || A > 26) && span > 3.6) { armchair('arm1', Math.max(0.12, u0 - 0.95), 1.2); if (span - u1 > 1) armchair('arm2', u1 + 0.15, 1.3); }
      add('side', place(u0 - 0.45, 0.2, u0 - 0.05, 0.6, 0, 0.5), pal.wood, undefined, true);
      floorLamp('lamp', u1 + 0.1, 0.2);
      if (span > 4.2) shelf('books', 0.12, Math.min(1.3, u0 - 0.5), deep - 0.5, designer && atBack ? 1.8 : 1.35);
      plant('plant', span - 0.55, deep - 0.6, 1.1);
      if (c.tier >= 6 && A > 26 && deep > 3.6) {
        // бар-зона
        add('bar', place(span - 1.9, deep * 0.45, span - 0.15, deep * 0.45 + 0.55, 0, 1.05), pal.cabinet, 'door');
        add('bar-top', place(span - 1.95, deep * 0.45 - 0.05, span - 0.1, deep * 0.45 + 0.6, 1.05, 1.1), pal.stoneTop);
        [0, 1, 2].forEach((i) => add(`stool${i}`, place(span - 1.75 + i * 0.55, deep * 0.45 + 0.7, span - 1.45 + i * 0.55, deep * 0.45 + 1.0, 0, 0.75), pal.wood));
      }
      wallArt('art', u0 + 0.3, u0 + Math.min(1.4, len - 0.3), 1.15, 1.7);
      break;
    }
    case 'bedroom': {
      const kids = /детск/i.test(room.name) || (c.bedroomIndex >= 1 && c.tier >= 3 && !/гостев/i.test(room.name));
      const guest = /гостев/i.test(room.name);
      if (kids) {
        flat('rug', 'rug', place(1.2, 1.0, Math.min(span - 0.3, 2.8), Math.min(deep - 0.3, 2.4), 0, 0));
        add('bed', place(0.12, 0.14, 1.05, Math.min(2.05, deep - 0.4), 0, 0.42), pal.linen);
        add('pillow', place(0.22, 0.24, 0.95, 0.5, 0.42, 0.54), pal.pillow, undefined, true);
        add('desk', place(span - 1.3, 0.1, span - 0.1, 0.7, 0.72, 0.77), pal.wood);
        add('desk-l1', place(span - 1.25, 0.15, span - 1.17, 0.65, 0, 0.72), pal.wood);
        add('desk-l2', place(span - 0.23, 0.15, span - 0.15, 0.65, 0, 0.72), pal.wood);
        add('chair', place(span - 0.9, 0.8, span - 0.5, 1.2, 0, 0.45), pal.accent);
        if (deep > 3) wardrobe('wardrobe', 1.4, Math.min(span - 0.15, 2.6), false);
        else shelf('shelf', 1.2, Math.min(span - 1.4, 2.2), 0.1, 1.0);
        add('toys', place(1.25, deep - 0.55, 1.75, deep - 0.15, 0, 0.4), pal.accent, undefined, true);
        wallArt('art', span - 1.2, span - 0.3, 1.1, 1.5);
        break;
      }
      const bw = Math.min(c.tier === 1 || guest ? 1.4 : c.tier >= 4 ? 1.8 : 1.6, span - 0.9);
      const u0 = mid - bw / 2; const u1 = mid + bw / 2; const bd = Math.min(2.1, deep - 0.5);
      flat('rug', 'rug', place(u0 - 0.35, 0.9, u1 + 0.35, Math.min(bd + 0.5, deep - 0.2), 0, 0));
      add('bed', place(u0, 0.14, u1, bd, 0, 0.42), pal.linen);
      add('head', place(u0 - 0.06, 0.12, u1 + 0.06, 0.24, 0, designer ? 1.15 : 0.92), designer ? pal.accent : pal.wood);
      add('pillow1', place(u0 + 0.12, 0.3, mid - 0.06, 0.6, 0.42, 0.55), pal.pillow, undefined, true);
      add('pillow2', place(mid + 0.06, 0.3, u1 - 0.12, 0.6, 0.42, 0.55), pal.pillow, undefined, true);
      add('throw', place(u0, 1.4, u1, Math.min(1.9, bd - 0.2), 0.42, 0.45), pal.accent);
      if (u0 > 0.6) { add('stand1', place(u0 - 0.5, 0.14, u0 - 0.08, 0.52, 0, 0.5), pal.wood); add('lamp1', place(u0 - 0.38, 0.24, u0 - 0.2, 0.42, 0.5, 0.75), ['#FFFFFF', '#F3EFE8', '#E2DDD4'], undefined, true); }
      if (span - u1 > 0.6) { add('stand2', place(u1 + 0.08, 0.14, u1 + 0.5, 0.52, 0, 0.5), pal.wood); add('lamp2', place(u1 + 0.2, 0.24, u1 + 0.38, 0.42, 0.5, 0.75), ['#FFFFFF', '#F3EFE8', '#E2DDD4'], undefined, true); }
      if (c.tier >= 2 && deep > 3.1) wardrobe('wardrobe', 0.12, c.tier >= 4 ? span - 0.12 : Math.min(1.8, span - 0.2), false);
      // ТВ напротив кровати в главной спальне больших квартир
      if (!guest && c.tier >= 3 && deep > 3.7) add('tv', place(mid - 0.55, deep - 0.72, mid + 0.55, deep - 0.68, 0.7, 1.35), DARK, 'screen');
      if (span > 3.6) add('dresser', place(span - 1.0, deep - (deep > 3.1 ? 1.4 : 0.55), span - 0.12, deep - (deep > 3.1 ? 0.9 : 0.1), 0, 0.8), pal.cabinet, 'door');
      if (A > 18 && span - u1 > 1.1) { armchair('chair', u1 + 0.25, Math.min(bd - 0.2, 1.6)); floorLamp('lamp', u1 + 1.05, Math.min(bd - 0.1, 1.5)); }
      if (designer && atBack && span - u1 > 0.9) wardrobe('builtin', u1 + 0.55, span - 0.1, true);
      plant('plant', 0.12, deep - 0.5);
      wallArt('art', u0 + 0.2, u1 - 0.2, 1.2, 1.65);
      break;
    }
    case 'kitchen': {
      const len = Math.min(span - 0.2, c.tier === 1 ? 2.0 : c.tier >= 4 ? 3.8 : 3.2);
      // холодильник в начале линии
      add('fridge', place(0.1, 0.1, 0.75, 0.75, 0, 1.95), designer ? pal.cabinet : cosmetic ? pal.ceramic : pal.metal, 'door');
      add('counter', place(0.8, 0.1, len, 0.7, 0, 0.88), pal.cabinet, 'door');
      add('top', place(0.78, 0.08, len + 0.02, 0.72, 0.88, 0.93), pal.stoneTop);
      const hob = 0.8 + (len - 0.8) * 0.18;
      add('hob', place(hob, 0.2, hob + 0.6, 0.6, 0.93, 0.94), DARK);
      add('oven', place(hob, 0.69, hob + 0.6, 0.72, 0.12, 0.72), DARK);
      if (atBack) add('hood', place(hob + 0.05, 0.12, hob + 0.55, 0.5, 1.55, 1.85), pal.metal);
      const sink = 0.8 + (len - 0.8) * 0.62;
      add('sinkbox', place(sink, 0.2, sink + 0.5, 0.6, 0.93, 0.95), pal.metal);
      if (c.tier >= 3) add('dishwasher', place(sink + 0.55, 0.69, sink + 1.1, 0.72, 0.08, 0.82), pal.metal);
      if (atBack) add('uppers', place(sink - 0.1, 0.1, len, 0.42, 1.4, designer ? c.backH - 0.05 : 1.9), pal.cabinet, 'door');
      // вторая сторона «Г» в больших кухнях
      if (c.tier >= 3 && deep > 3.4 && span > 2.6) add('counter2', place(len - 0.6, 0.72, len, Math.min(2.2, deep * 0.45), 0, 0.88), pal.cabinet, 'door');
      const seats = c.tier <= 1 ? 2 : c.tier <= 3 ? 4 : c.tier === 4 ? 6 : 8;
      const island = c.tier >= 4 && c.kitchenLiving && deep > 3.4;
      if (island) {
        const t0 = 1.35;
        add('island', place(mid - 0.95, t0, mid + 0.95, t0 + 0.9, 0, 0.9), pal.cabinet, 'door');
        add('island-top', place(mid - 1.0, t0 - 0.05, mid + 1.0, t0 + 0.95, 0.9, 0.95), pal.stoneTop);
        [-0.6, 0, 0.6].forEach((dx, i) => add(`stool${i}`, place(mid + dx - 0.18, t0 + 1.05, mid + dx + 0.18, t0 + 1.4, 0, 0.65), pal.wood));
        if (deep > 4.6) table('dining', mid, deep - 1.25, Math.min(seats, span > 4.4 ? 8 : 6));
      } else if (deep > 2.4) {
        table('dining', mid, Math.max(1.45, deep * 0.62), Math.min(seats, span > 3.6 ? seats : 4));
      }
      plant('plant', span - 0.5, deep - 0.5);
      break;
    }
    case 'bath': {
      const second = c.bathIndex >= 1;
      const tub = Math.min(1.7, span - 0.15);
      if (!second && tub > 1.2 && deep > 1.2) {
        add('tub', place(0.08, 0.08, tub, 0.8, 0, 0.55), pal.ceramic);
        const b = place(0.2, 0.2, tub - 0.12, 0.68, 0.56, 0.56);
        flats.push({ key: `${room.id}-${v}-water`, kind: 'water', pts: [[b.x0, b.y0, 0.56], [b.x1, b.y0, 0.56], [b.x1, b.y1, 0.56], [b.x0, b.y1, 0.56]] });
        if (c.tier >= 4 && span > tub + 1.0 && deep > 1.6) {
          add('shower', place(tub + 0.12, 0.08, Math.min(span - 0.1, tub + 1.05), 0.98, 0, 0.06), pal.ceramic);
          add('glass', place(tub + 0.09, 0.08, tub + 0.12, 0.98, 0.06, 1.9), GLASS, undefined, true);
        }
      } else {
        const s = Math.min(0.95, span - 0.1, deep - 0.1);
        add('shower', place(0.08, 0.08, s, s, 0, 0.06), pal.ceramic);
        add('glass', place(s - 0.03, 0.08, s, s, 0.06, 1.9), GLASS, undefined, true);
      }
      if (deep > 1.3) {
        add('vanity', place(span - 0.75, deep - 0.5, span - 0.1, deep - 0.08, 0, 0.55), pal.cabinet, 'door');
        add('sink', place(span - 0.7, deep - 0.48, span - 0.15, deep - 0.1, 0.55, 0.85), pal.ceramic);
      }
      if (!c.hasWc && span > 1.8 && deep > 1.6) {
        add('toilet', place(span - 0.55, 0.1, span - 0.15, 0.62, 0, 0.42), pal.ceramic);
        add('tank', place(span - 0.57, 0.08, span - 0.13, 0.22, 0.42, 0.75), pal.ceramic);
      }
      if (c.tier <= 2 && !second && deep > 1.3 && span > 1.5) add('washer', place(span - 0.7, 0.1, span - 0.1, 0.68, 0, 0.85), pal.ceramic, 'round');
      if (deep > 2) add('towel', place(0.08, deep - 0.5, 0.2, deep - 0.1, 0.6, 1.4), pal.metal, undefined, true);
      wallArt('mirror', span - 0.7, span - 0.15, 1.05, 1.6, true);
      break;
    }
    case 'wc': {
      add('toilet', place(mid - 0.2, 0.1, mid + 0.2, 0.62, 0, 0.42), pal.ceramic);
      add('tank', place(mid - 0.22, 0.08, mid + 0.22, 0.22, 0.42, 0.75), pal.ceramic);
      if (deep > 1.5) add('sink', place(mid - 0.22, deep - 0.38, mid + 0.22, deep - 0.08, 0.6, 0.82), pal.ceramic);
      break;
    }
    case 'hall': {
      if (c.tier >= 4 && span > 2.2 && deep > 1.2) wardrobe('wardrobe', 0.15, Math.min(span - 0.4, c.tier >= 6 ? 3.6 : 2.6), true);
      else if (span > 1.6 && deep > 1.1) add('console', place(0.15, 0.1, Math.min(1.4, span - 0.4), 0.45, 0, 0.75), pal.cabinet);
      if (span > 2.8 && deep > 1.2) add('bench', place(span - 1.2, deep - 0.45, span - 0.2, deep - 0.1, 0, 0.45), pal.wood);
      if (deep > 1.4) add('shoes', place(0.15, deep - 0.4, 0.95, deep - 0.08, 0, 0.5), pal.cabinet, 'door', true);
      if (A > 10 && deep > 2.6) { flat('rug', 'rug', place(mid - 0.8, deep * 0.35, mid + 0.8, deep * 0.35 + 1.2, 0, 0)); add('pouf', place(mid - 0.3, deep * 0.35 + 0.3, mid + 0.3, deep * 0.35 + 0.9, 0, 0.42), designer ? pal.accent : pal.fabric); }
      plant('plant', span - 0.5, 0.15);
      wallArt('mirror', span - 1.0, span - 0.4, 0.6, 1.75, true);
      break;
    }
    case 'storage': {
      if (span < 0.9 || deep < 0.9) break;
      add('rack1', place(0.1, 0.1, span - 0.1, 0.5, 0, 1.25), pal.cabinet, 'books');
      if (deep > 1.6) add('rack2', place(0.1, 0.55, 0.5, deep - 0.1, 0, 1.25), pal.cabinet, 'books');
      break;
    }
    case 'wardrobe': {
      add('rack1', place(0.1, 0.1, span - 0.1, 0.6, 0, designer && atBack ? c.backH - 0.05 : 1.35), pal.cabinet, 'door');
      if (deep > 1.6) add('rack2', place(0.1, 0.65, 0.65, deep - 0.1, 0, 1.35), pal.cabinet, 'door');
      if (deep > 2.0 && span > 2.0) add('rack3', place(span - 0.6, 0.65, span - 0.1, deep - 0.1, 0, 1.35), pal.cabinet, 'door');
      if (span > 2.2 && deep > 2.2) add('ottoman', place(mid - 0.35, deep / 2 - 0.3, mid + 0.35, deep / 2 + 0.3, 0, 0.42), pal.accent);
      wallArt('mirror', mid - 0.3, mid + 0.3, 0.3, 1.75, true);
      break;
    }
    case 'laundry': {
      add('washer', place(0.1, 0.1, 0.7, 0.68, 0, 0.85), pal.ceramic, 'round');
      if (span > 1.6) add('dryer', place(0.75, 0.1, 1.35, 0.68, 0, 0.85), pal.ceramic, 'round');
      else add('dryer', place(0.1, 0.1, 0.7, 0.68, 0.85, 1.7), pal.ceramic, 'round');
      if (span > 2.1) {
        add('sinkunit', place(1.45, 0.1, Math.min(span - 0.1, 2.3), 0.62, 0, 0.88), pal.cabinet, 'door');
        add('lsink', place(1.55, 0.18, Math.min(span - 0.2, 2.1), 0.55, 0.88, 0.92), pal.ceramic);
      }
      if (deep > 1.5) add('rack', place(span - 0.5, deep - 0.6, span - 0.1, deep - 0.1, 0, 1.4), pal.metal);
      add('basket', place(0.15, deep - 0.5, 0.55, deep - 0.1, 0, 0.5), pal.wood, undefined, true);
      break;
    }
    case 'study': {
      flat('rug', 'rug', place(0.6, 0.9, Math.min(span - 0.3, 2.8), Math.min(deep - 0.3, 2.6), 0, 0));
      add('desk', place(0.15, 0.1, Math.min(1.7, span - 0.6), 0.8, 0.72, 0.77), pal.wood);
      add('desk-l1', place(0.2, 0.15, 0.28, 0.75, 0, 0.72), pal.wood);
      add('desk-l2', place(Math.min(1.62, span - 0.68), 0.15, Math.min(1.7, span - 0.6), 0.75, 0, 0.72), pal.wood);
      add('monitor', place(0.7, 0.18, 1.2, 0.24, 0.77, 1.12), DARK, 'screen');
      add('chair', place(0.75, 0.9, 1.2, 1.35, 0, 0.5), designer ? pal.accent : pal.fabric);
      shelf('books', span - 0.42 > 1.9 ? 1.9 : span - 0.5, span - 0.08, 0.1, designer && atBack ? c.backH - 0.05 : 1.6);
      if (deep > 2.8) armchair('arm', span - 1.0, deep - 1.0);
      floorLamp('lamp', span - 1.3, deep - 0.5);
      plant('plant', 0.15, deep - 0.5);
      wallArt('art', 0.3, 1.3, 1.15, 1.6);
      break;
    }
    case 'library': {
      flat('rug', 'rug', place(0.8, 0.8, span - 0.6, deep - 0.5, 0, 0));
      shelf('books1', 0.1, span - 0.1, 0.06, designer && atBack ? c.backH - 0.05 : 1.75);
      if (deep > 2.2) add('books2', place(0.06, 0.5, 0.42, deep - 0.15, 0, 1.6), pal.cabinet, 'books');
      armchair('arm1', mid - 1.0, deep - 1.3);
      armchair('arm2', mid + 0.25, deep - 1.3);
      add('side', place(mid - 0.18, deep - 1.1, mid + 0.18, deep - 0.75, 0, 0.5), pal.wood);
      floorLamp('lamp', mid + 1.15, deep - 1.25);
      plant('plant', span - 0.5, deep - 0.5);
      break;
    }
    case 'gym': {
      flat('mat', 'mat', place(0.3, 1.1, Math.min(span - 0.3, 2.6), Math.min(deep - 0.3, 2.6), 0, 0));
      // беговая дорожка
      add('tread', place(0.15, 0.15, 0.85, 1.95, 0, 0.18), DARK);
      add('tread-post', place(0.18, 0.15, 0.82, 0.3, 0.18, 1.2), pal.metal);
      add('tread-top', place(0.15, 0.12, 0.85, 0.42, 1.2, 1.28), DARK);
      add('bench', place(span - 1.6, 1.2, span - 0.4, 1.55, 0, 0.45), pal.fabric);
      add('rack', place(span - 1.4, 0.1, span - 0.2, 0.45, 0, 0.75), pal.metal);
      add('db1', place(span - 1.3, 0.18, span - 1.0, 0.36, 0.75, 0.86), DARK);
      add('db2', place(span - 0.8, 0.18, span - 0.5, 0.36, 0.75, 0.86), DARK);
      add('ball', place(1.2, deep - 0.75, 1.75, deep - 0.2, 0, 0.55), pal.accent, undefined, true);
      wallArt('mirror', 1.1, Math.min(span - 1.6, 2.6), 0.3, 1.75, true);
      break;
    }
    case 'cinema': {
      flat('rug', 'rug', place(0.5, 1.0, span - 0.5, deep - 0.4, 0, 0));
      // экран на дальней стене, диваны в два ряда
      add('screen-unit', place(mid - 1.2, 0.1, mid + 1.2, 0.5, 0, 0.45), DARK, 'door');
      add('screen', place(mid - 1.1, 0.12, mid + 1.1, 0.18, 0.55, 1.75), DARK, 'screen');
      const len = Math.min(2.8, span - 0.8);
      sofa('row1', mid - len / 2, mid + len / 2, 0.95, Math.min(deep - 2.3, 2.0));
      if (deep > 4.2) sofa('row2', mid - len / 2, mid + len / 2, 0.95, deep - 1.15);
      add('side1', place(mid - len / 2 - 0.45, Math.min(deep - 2.2, 2.1), mid - len / 2 - 0.05, Math.min(deep - 1.8, 2.5), 0, 0.5), pal.wood, undefined, true);
      add('side2', place(mid + len / 2 + 0.05, Math.min(deep - 2.2, 2.1), mid + len / 2 + 0.45, Math.min(deep - 1.8, 2.5), 0, 0.5), pal.wood, undefined, true);
      break;
    }
    default: break;
  }
  return { boxes, flats, art };
}
