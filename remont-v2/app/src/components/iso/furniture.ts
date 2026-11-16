import type { PlanRoom, Rect, RenovationType } from '../../api';
import type { Palette } from './materials';

/* Мебель и техника под конкретную квартиру. Только для наглядности — в смету не входит.
   Вариант зависит от площади (4 ступени), числа комнат и типа ремонта.
   Ключ каждого предмета содержит вариант: при смене варианта старое исчезает, новое появляется. */

export interface Box { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
export interface FurnBox { key: string; box: Box; colors: [string, string, string]; mark?: 'door' | 'round' | 'screen' }
export interface FurnFlat { kind: 'rug' | 'water'; pts: [number, number, number][] }

export interface FurnCtx {
  tier: 1 | 2 | 3 | 4;                // ≤35, 35–55, 55–80, >80 м²
  type: RenovationType;
  detail: 'low' | 'high';
  bedroomIndex: number;               // 0 — главная спальня, дальше — детская/кабинет
  bathIndex: number;                  // 0 — основной санузел
  storageIndex: number;
  kitchenLiving: boolean;             // кухня-гостиная (новостройки, большие квартиры)
  backH: number;
  touchesBack: boolean;               // комната у высокой задней стены
}

export const tierFor = (area: number): FurnCtx['tier'] => (area <= 35 ? 1 : area <= 55 ? 2 : area <= 80 ? 3 : 4);

export function mainRect(room: PlanRoom): Rect {
  return [...room.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
}

export function furnish(room: PlanRoom, pal: Palette, c: FurnCtx): { boxes: FurnBox[]; flats: FurnFlat[] } {
  const R = mainRect(room);
  const boxes: FurnBox[] = [];
  const flats: FurnFlat[] = [];
  const v = `t${c.tier}${c.type[0]}`;
  const along = R.w >= R.h * 0.8 ? 'x' : 'y';
  const span = along === 'x' ? R.w : R.h;
  const deep = along === 'x' ? R.h : R.w;
  const mid = span / 2;
  const simple = c.type === 'cosmetic';
  const designer = c.type === 'designer';
  const hi = c.detail === 'high';
  const place = (u0: number, v0: number, u1: number, v1: number, z0: number, z1: number): Box =>
    along === 'x'
      ? { x0: R.x + u0, y0: R.y + v0, x1: R.x + u1, y1: R.y + v1, z0, z1 }
      : { x0: R.x + v0, y0: R.y + u0, x1: R.x + v1, y1: R.y + u1, z0, z1 };
  const add = (k: string, b: Box, col: [string, string, string], mark?: FurnBox['mark']) => {
    if (b.x1 - b.x0 < 0.05 || b.y1 - b.y0 < 0.05) return;
    boxes.push({ key: `${room.id}-${v}-${k}`, box: b, colors: col, mark });
  };
  const rug = (b: Box) => flats.push({ kind: 'rug', pts: [[b.x0, b.y0, 0.01], [b.x1, b.y0, 0.01], [b.x1, b.y1, 0.01], [b.x0, b.y1, 0.01]] });
  // встроенный шкаф: в дизайнерском — до потолка у высокой стены
  const wardrobe = (k: string, u0: number, u1: number, atBack: boolean) => {
    const tall = designer && atBack && c.touchesBack ? c.backH - 0.05 : designer ? 1.35 : 1.05;
    add(k, atBack ? place(u0, 0.1, u1, 0.7, 0, tall) : place(u0, deep - 0.66, u1, deep - 0.08, 0, Math.min(tall, 1.35)), pal.cabinet, 'door');
  };
  const sofa = (k: string, u0: number, u1: number, d = 0.9) => {
    add(`${k}`, place(u0, 0.16, u1, 0.16 + d, 0, 0.42), pal.fabric);
    add(`${k}-back`, place(u0, 0.16, u1, 0.38, 0.42, 0.82), pal.fabric);
    add(`${k}-arm1`, place(u0, 0.38, u0 + 0.2, 0.16 + d, 0.42, 0.6), pal.fabric);
    add(`${k}-arm2`, place(u1 - 0.2, 0.38, u1, 0.16 + d, 0.42, 0.6), pal.fabric);
  };
  const chairs = (k: string, cx: number, cv: number, n: number, tw: number, td: number) => {
    const pos: [number, number][] = n <= 2
      ? [[cx - tw / 2 - 0.42, cv], [cx + tw / 2 + 0.02, cv]]
      : [[cx - tw / 4 - 0.2, cv - td / 2 - 0.42], [cx + tw / 4 - 0.2, cv - td / 2 - 0.42], [cx - tw / 4 - 0.2, cv + td / 2 + 0.02], [cx + tw / 4 - 0.2, cv + td / 2 + 0.02]];
    pos.slice(0, n).forEach(([u, vv], i) => add(`${k}${i}`, place(u, vv - (n <= 2 ? 0.2 : 0), u + 0.4, vv + (n <= 2 ? 0.2 : 0.4), 0, 0.45), pal.fabric));
  };

  switch (room.kind) {
    case 'living': {
      if (c.tier === 1) {
        // диван-кровать: разложенный, с подушками
        const len = Math.min(2.0, span * 0.6); const u0 = mid - len / 2;
        sofa('sofabed', u0, u0 + len, 1.45);
        add('pillow', place(u0 + 0.3, 0.42, u0 + 0.9, 0.7, 0.42, 0.54), pal.pillow);
        add('blanket', place(u0 + 0.25, 0.9, u0 + len - 0.25, 1.5, 0.42, 0.45), pal.accent);
        if (deep > 2.8) add('tv', place(mid - 0.6, deep - 0.42, mid + 0.6, deep - 0.12, 0, 0.45), pal.wood);
      } else {
        const len = Math.min(c.tier >= 3 ? 2.6 : 2.3, span * 0.62); const u0 = mid - len / 2; const u1 = u0 + len;
        if (hi && !simple) rug(place(u0 - 0.2, 1.25, u1 + 0.2, Math.min(deep - 0.7, 2.8), 0, 0));
        sofa('sofa', u0, u1);
        if (c.tier >= 4) add('sofa-l', place(u1 - 0.9, 1.0, u1, 1.9, 0, 0.42), pal.fabric);
        add('cushion', place(u0 + 0.35, 0.4, u0 + 0.8, 0.52, 0.42, 0.72), pal.accent);
        if (deep > 2.6) add('table', place(mid - 0.5, 1.5, mid + 0.5, 2.05, 0, 0.38), pal.wood);
        // ТВ-зона: тумба и экран напротив дивана
        if (deep > 3.2) {
          add('tv-unit', place(mid - 0.95, deep - 0.48, mid + 0.95, deep - 0.12, 0, 0.45), pal.wood);
          add('tv', place(mid - 0.6, deep - 0.3, mid + 0.6, deep - 0.25, 0.5, 1.15), ['#2A2825', '#23211E', '#1A1917'], 'screen');
        }
        if (c.tier >= 3 && !simple && span > 3.4) add('armchair', place(u1 + 0.25, 0.9, u1 + 0.95, 1.6, 0, 0.42), pal.accent);
        if (hi && !simple && span > 3.2) add('plant', place(u0 - 0.6, 0.25, u0 - 0.25, 0.6, 0, 0.9), pal.plant);
      }
      break;
    }
    case 'bedroom': {
      const kids = c.bedroomIndex >= 1 && c.tier >= 3;
      if (kids) {
        // детская или кабинет: односпальная кровать и рабочий стол
        add('bed', place(0.12, 0.14, 1.05, Math.min(2.05, deep - 0.4), 0, 0.42), pal.linen);
        add('pillow', place(0.22, 0.24, 0.95, 0.5, 0.42, 0.54), pal.pillow);
        add('desk', place(span - 1.3, 0.1, span - 0.1, 0.7, 0.72, 0.77), pal.wood);
        add('desk-leg', place(span - 1.25, 0.15, span - 1.17, 0.65, 0, 0.72), pal.wood);
        add('desk-leg2', place(span - 0.23, 0.15, span - 0.15, 0.65, 0, 0.72), pal.wood);
        add('chair', place(span - 0.9, 0.8, span - 0.5, 1.2, 0, 0.45), pal.accent);
        if (deep > 3) wardrobe('wardrobe', 1.4, Math.min(span - 0.15, 2.6), false);
      } else {
        const bw = Math.min(c.tier === 1 ? 1.4 : 1.6, span - 0.9);
        const u0 = mid - bw / 2; const u1 = mid + bw / 2;
        add('bed', place(u0, 0.14, u1, Math.min(2.1, deep - 0.5), 0, 0.42), pal.linen);
        add('head', place(u0 - 0.06, 0.12, u1 + 0.06, 0.24, 0, designer ? 1.15 : 0.92), pal.wood);
        add('pillow1', place(u0 + 0.12, 0.3, mid - 0.06, 0.6, 0.42, 0.55), pal.pillow);
        add('pillow2', place(mid + 0.06, 0.3, u1 - 0.12, 0.6, 0.42, 0.55), pal.pillow);
        if (!simple) add('throw', place(u0, 1.4, u1, Math.min(1.9, deep - 0.7), 0.42, 0.45), pal.accent);
        if (u0 > 0.6) add('stand1', place(u0 - 0.5, 0.14, u0 - 0.08, 0.52, 0, 0.5), pal.wood);
        if (span - u1 > 0.6 && !simple) add('stand2', place(u1 + 0.08, 0.14, u1 + 0.5, 0.52, 0, 0.5), pal.wood);
        // шкаф: с 2-комнатных; в больших квартирах — во всю стену
        if (c.tier >= 2 && deep > 3.1) wardrobe('wardrobe', 0.12, c.tier >= 4 ? span - 0.12 : Math.min(1.8, span - 0.2), false);
        if (designer && c.touchesBack && span - u1 > 0.9) wardrobe('builtin', u1 + 0.55, span - 0.1, true);
      }
      break;
    }
    case 'kitchen': {
      if (c.tier === 1) {
        // компактная кухня-линия и стол на двоих
        const len = Math.min(span - 0.2, 2.0);
        add('counter', place(0.1, 0.1, len, 0.65, 0, 0.88), pal.cabinet, 'door');
        add('top', place(0.08, 0.08, len + 0.02, 0.67, 0.88, 0.92), pal.stoneTop);
        add('hob', place(len * 0.2, 0.18, len * 0.2 + 0.5, 0.58, 0.92, 0.93), ['#2A2825', '#23211E', '#1A1917']);
        add('sinkbox', place(len * 0.62, 0.2, len * 0.62 + 0.45, 0.55, 0.92, 0.94), pal.metal);
        if (deep > 2.2) {
          const t0 = Math.max(1.2, deep * 0.55);
          add('table', place(mid - 0.35, t0, mid + 0.35, t0 + 0.7, 0.7, 0.75), pal.wood);
          add('leg', place(mid - 0.06, t0 + 0.29, mid + 0.06, t0 + 0.41, 0, 0.7), pal.wood);
          if (hi) chairs('chair', mid, t0 + 0.35, 2, 0.7, 0.7);
        }
      } else {
        const len = Math.min(span - 0.2, c.tier >= 4 ? 3.8 : 3.2);
        add('counter', place(0.1, 0.1, len, 0.7, 0, 0.88), pal.cabinet, 'door');
        add('top', place(0.08, 0.08, len + 0.02, 0.72, 0.88, 0.93), pal.stoneTop);
        add('hob', place(len * 0.18, 0.2, len * 0.18 + 0.6, 0.6, 0.93, 0.94), ['#2A2825', '#23211E', '#1A1917']);
        add('sinkbox', place(len * 0.58, 0.2, len * 0.58 + 0.5, 0.6, 0.93, 0.95), pal.metal);
        if (c.tier >= 3) add('dishwasher', place(len * 0.58 + 0.55, 0.69, len * 0.58 + 1.1, 0.72, 0.08, 0.82), pal.metal);
        if (designer && c.touchesBack) add('uppers', place(0.1, 0.1, len * 0.5, 0.45, 1.35, c.backH - 0.05), pal.cabinet, 'door');
        if (c.tier >= 4 && c.kitchenLiving && deep > 3.2) {
          // остров и барные стулья
          const t0 = Math.max(1.5, deep * 0.42);
          add('island', place(mid - 0.95, t0, mid + 0.95, t0 + 0.9, 0, 0.9), pal.cabinet, 'door');
          add('island-top', place(mid - 1.0, t0 - 0.05, mid + 1.0, t0 + 0.95, 0.9, 0.95), pal.stoneTop);
          if (hi) [-0.6, 0, 0.6].forEach((dx, i) => add(`stool${i}`, place(mid + dx - 0.18, t0 + 1.05, mid + dx + 0.18, t0 + 1.4, 0, 0.65), pal.wood));
        } else if (deep > 2.6) {
          const t0 = Math.max(1.4, deep * 0.5);
          add('table', place(mid - 0.6, t0, mid + 0.6, t0 + 0.8, 0.7, 0.76), pal.wood);
          add('leg', place(mid - 0.1, t0 + 0.3, mid + 0.1, t0 + 0.5, 0, 0.7), pal.wood);
          if (hi && !simple) chairs('chair', mid, t0 + 0.4, 4, 1.2, 0.8);
          else if (hi) chairs('chair', mid, t0 + 0.4, 2, 1.2, 0.8);
        }
      }
      break;
    }
    case 'bath': {
      const second = c.bathIndex >= 1;
      const tub = Math.min(1.7, span - 0.15);
      const bigBath = c.tier >= 4 && span > 2.3 && deep > 1.6 && !second;
      if (!second && tub > 1.2 && deep > 1.2) {
        add('tub', place(0.08, 0.08, tub, 0.8, 0, 0.55), pal.ceramic);
        const b = place(0.2, 0.2, tub - 0.12, 0.68, 0.56, 0.56);
        flats.push({ kind: 'water', pts: [[b.x0, b.y0, 0.56], [b.x1, b.y0, 0.56], [b.x1, b.y1, 0.56], [b.x0, b.y1, 0.56]] });
      } else {
        // душевая
        const s = Math.min(0.95, span - 0.1, deep - 0.1);
        add('shower', place(0.08, 0.08, s, s, 0, 0.06), pal.ceramic);
        if (hi) add('glass', place(s - 0.03, 0.08, s, s, 0.06, 1.9), ['#E8EEEC', '#DCE4E2', '#CED8D6']);
      }
      if (bigBath) {
        add('shower', place(tub + 0.15, 0.08, Math.min(span - 0.1, tub + 1.05), 0.98, 0, 0.06), pal.ceramic);
        if (hi) add('glass', place(tub + 0.12, 0.08, tub + 0.15, 0.98, 0.06, 1.9), ['#E8EEEC', '#DCE4E2', '#CED8D6']);
      }
      if (deep > 1.4) add('sink', place(span - 0.62, deep - 0.5, span - 0.12, deep - 0.1, 0.55, 0.85), pal.ceramic);
      // стиральная машина в санузле — в маленьких квартирах (в больших есть постирочная)
      if (c.tier <= 2 && !second && deep > 1.3 && span > 1.5) add('washer', place(span - 0.7, 0.1, span - 0.1, 0.68, 0, 0.85), pal.ceramic, 'round');
      break;
    }
    case 'wc': {
      add('toilet', place(mid - 0.2, 0.1, mid + 0.2, 0.62, 0, 0.42), pal.ceramic);
      add('tank', place(mid - 0.22, 0.08, mid + 0.22, 0.22, 0.42, 0.75), pal.ceramic);
      break;
    }
    case 'hall': {
      if (c.tier >= 4 && span > 2.2 && deep > 1.2) wardrobe('hall-wardrobe', 0.15, Math.min(span - 0.4, 2.6), true);
      else if (span > 1.6 && deep > 1.1) add('console', place(0.15, 0.1, Math.min(1.4, span - 0.4), 0.45, 0, 0.75), pal.cabinet);
      if (hi && !simple && span > 2.8 && deep > 1.2) add('bench', place(span - 1.2, deep - 0.45, span - 0.2, deep - 0.1, 0, 0.45), pal.wood);
      break;
    }
    case 'storage': {
      if (span < 0.9 || deep < 0.9) break;
      if (c.tier >= 4 && c.storageIndex === 0) {
        // отдельная постирочная: стиральная и сушильная машины в колонну
        add('washer', place(0.1, 0.1, 0.7, 0.68, 0, 0.85), pal.ceramic, 'round');
        add('dryer', place(0.1, 0.1, 0.7, 0.68, 0.85, 1.7), pal.ceramic, 'round');
        if (span > 1.6) add('laundry-shelf', place(0.8, 0.1, Math.min(span - 0.1, 1.7), 0.45, 0, 0.95), pal.cabinet);
      } else if (c.tier >= 3) {
        // гардеробная: системы хранения по двум стенам
        add('rack1', place(0.1, 0.1, span - 0.1, 0.5, 0, 1.25), pal.cabinet, 'door');
        if (deep > 1.6) add('rack2', place(0.1, 0.5, 0.5, deep - 0.1, 0, 1.25), pal.cabinet, 'door');
      } else {
        add('shelves', place(0.1, 0.1, Math.min(span - 0.1, 1.6), 0.45, 0, 0.95), pal.cabinet);
      }
      break;
    }
    default: break;
  }
  return { boxes, flats };
}
