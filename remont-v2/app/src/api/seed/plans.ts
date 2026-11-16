import type { FloorPlan, HouseType, HouseTypeId, PlanRoom, Rect, RoomKind } from '../types';

/* Типовые планировки, «примерно». Размеры в метрах, комнаты — прямоугольники,
   складываются в контур квартиры без зазоров. Площади считаются из размеров. */

export const HOUSE_TYPES: HouseType[] = [
  { id: 'khrushchevka', name: 'Хрущёвка', years: '1958–1970', ceiling: 2.5,
    note: 'Тонкие перегородки, старая проводка, совмещённый санузел. Почти всегда нужен демонтаж до бетона.' },
  { id: 'brezhnevka', name: 'Брежневка', years: '1970–1985', ceiling: 2.6,
    note: 'Раздельный санузел, кухня побольше. Стяжка неровная, перепады пола до 4 см.' },
  { id: 'stalinka', name: 'Сталинка', years: '1935–1957', ceiling: 3.1,
    note: 'Высокие потолки, деревянные перекрытия, кривые стены. Больше всего черновых работ.' },
  { id: 'panel90', name: 'Панельная 90-х', years: '1986–2000', ceiling: 2.65,
    note: 'Кухня 9–10 м², лоджия. Ровные плиты, но изношенные коммуникации.' },
  { id: 'novostroyka', name: 'Новостройка', years: 'после 2010', ceiling: 2.75,
    note: 'Бетон или white box. Демонтажа почти нет, зато нужна стяжка и вся электрика с нуля.' },
];

const NAMES: Record<RoomKind, string> = {
  living: 'Гостиная', bedroom: 'Спальня', kitchen: 'Кухня', bath: 'Санузел', wc: 'Туалет',
  hall: 'Прихожая', storage: 'Кладовая', balcony: 'Балкон',
  study: 'Кабинет', wardrobe: 'Гардеробная', laundry: 'Постирочная', gym: 'Спортзона', cinema: 'Кинотеатр', library: 'Библиотека',
};

type RoomDef = [RoomKind, ...Rect[]] | [RoomKind, string, ...Rect[]];
const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

const round1 = (n: number) => Math.round(n * 10) / 10;
export const rectsArea = (rects: Rect[]) => round1(rects.reduce((s, q) => s + q.w * q.h, 0));

function build(house: HouseTypeId, rooms: number, defs: RoomDef[]): FloorPlan {
  const items: PlanRoom[] = defs.map((d, i) => {
    const kind = d[0];
    const named = typeof d[1] === 'string';
    const name = named ? (d[1] as string) : NAMES[kind];
    const rects = (named ? d.slice(2) : d.slice(1)) as Rect[];
    return { id: `${kind}-${i}`, kind, name, rects, area: rectsArea(rects) };
  });
  const inside = items.filter((i) => i.kind !== 'balcony');
  const all = inside.flatMap((i) => i.rects);
  const width = round1(Math.max(...all.map((q) => q.x + q.w)));
  const depth = round1(Math.max(...all.map((q) => q.y + q.h)));
  return {
    id: `${house}-${rooms}`, house, rooms,
    bathrooms: items.filter((i) => i.kind === 'bath').length,
    area: round1(inside.reduce((s, i) => s + i.area, 0)),
    width, depth, items,
  };
}

export const PLANS: FloorPlan[] = [
  /* Хрущёвка */
  build('khrushchevka', 1, [
    ['living', 'Комната', r(0, 0, 3.4, 5.2)],
    ['kitchen', r(3.4, 0, 2.4, 2.6)],
    ['hall', r(3.4, 2.6, 1.3, 2.6)],
    ['bath', 'Совмещённый санузел', r(4.7, 2.6, 1.1, 2.6)],
    ['balcony', r(0.4, -0.9, 2.6, 0.9)],
  ]),
  build('khrushchevka', 2, [
    ['living', 'Проходная гостиная', r(0, 0, 3.4, 5.4)],
    ['bedroom', r(3.4, 0, 2.8, 3.2)],
    ['hall', r(3.4, 3.2, 2.8, 2.2)],
    ['kitchen', r(6.2, 0, 2.2, 2.9)],
    ['bath', 'Совмещённый санузел', r(6.2, 2.9, 2.2, 1.5)],
    ['storage', r(6.2, 4.4, 2.2, 1.0)],
    ['balcony', r(0.4, -0.9, 2.6, 0.9)],
  ]),
  build('khrushchevka', 3, [
    ['living', 'Гостиная', r(0, 0, 3.6, 5.6)],
    ['bedroom', 'Спальня', r(3.6, 0, 3.0, 3.4)],
    ['bedroom', 'Детская', r(3.6, 3.4, 3.0, 2.2)],
    ['hall', 'Коридор', r(6.6, 0, 1.6, 5.6)],
    ['kitchen', r(8.2, 0, 2.2, 2.8)],
    ['bath', 'Совмещённый санузел', r(8.2, 2.8, 2.2, 1.4)],
    ['storage', r(8.2, 4.2, 2.2, 1.4)],
    ['balcony', r(0.4, -0.9, 2.8, 0.9)],
  ]),

  /* Брежневка */
  build('brezhnevka', 1, [
    ['living', 'Комната', r(0, 0, 3.6, 4.8)],
    ['kitchen', r(3.6, 0, 2.4, 3.4)],
    ['hall', r(3.6, 3.4, 2.4, 1.4), r(0, 4.8, 3.2, 1.4)],
    ['bath', 'Ванная', r(3.2, 4.8, 1.6, 1.4)],
    ['wc', r(4.8, 4.8, 1.2, 1.4)],
    ['balcony', r(0.3, -1.0, 3.0, 1.0)],
  ]),
  build('brezhnevka', 2, [
    ['living', r(0, 0, 4.0, 4.0)],
    ['bedroom', r(4.0, 0, 3.0, 4.0)],
    ['kitchen', r(7.0, 0, 2.4, 4.0)],
    ['hall', r(0, 4.0, 5.2, 1.8)],
    ['bath', 'Ванная', r(5.2, 4.0, 1.7, 1.8)],
    ['wc', r(6.9, 4.0, 1.1, 1.8)],
    ['storage', 'Гардеробная', r(8.0, 4.0, 1.4, 1.8)],
    ['balcony', r(0.4, -1.0, 3.2, 1.0)],
  ]),
  build('brezhnevka', 3, [
    ['living', r(0, 0, 3.8, 4.2)],
    ['bedroom', r(3.8, 0, 3.0, 4.2)],
    ['bedroom', 'Детская', r(6.8, 0, 2.6, 4.2)],
    ['kitchen', r(9.4, 0, 2.4, 4.2)],
    ['hall', r(0, 4.2, 6.4, 1.6)],
    ['bath', 'Ванная', r(6.4, 4.2, 1.8, 1.6)],
    ['wc', r(8.2, 4.2, 1.2, 1.6)],
    ['storage', 'Гардеробная', r(9.4, 4.2, 2.4, 1.6)],
    ['balcony', r(0.4, -1.0, 3.0, 1.0)],
  ]),

  /* Сталинка */
  build('stalinka', 1, [
    ['living', 'Комната', r(0, 0, 4.4, 5.0)],
    ['kitchen', r(4.4, 0, 2.6, 3.4)],
    ['bath', 'Совмещённый санузел', r(4.4, 3.4, 2.6, 1.6)],
    ['hall', 'Холл', r(0, 5.0, 7.0, 1.6)],
  ]),
  build('stalinka', 2, [
    ['living', r(0, 0, 4.6, 4.6)],
    ['bedroom', r(4.6, 0, 3.6, 4.6)],
    ['kitchen', r(8.2, 0, 2.8, 4.6)],
    ['hall', 'Холл', r(0, 4.6, 6.0, 2.0)],
    ['bath', 'Ванная', r(6.0, 4.6, 2.2, 2.0)],
    ['wc', r(8.2, 4.6, 1.2, 2.0)],
    ['storage', r(9.4, 4.6, 1.6, 2.0)],
    ['balcony', r(1.2, -0.9, 2.2, 0.9)],
  ]),
  build('stalinka', 3, [
    ['living', r(0, 0, 5.2, 5.0)],
    ['bedroom', r(5.2, 0, 3.8, 5.0)],
    ['bedroom', 'Кабинет', r(9.0, 0, 3.4, 5.0)],
    ['hall', 'Холл', r(0, 5.0, 4.6, 2.6)],
    ['bath', 'Ванная', r(4.6, 5.0, 2.2, 2.6)],
    ['wc', r(6.8, 5.0, 1.2, 2.6)],
    ['kitchen', r(8.0, 5.0, 4.4, 2.6)],
    ['balcony', r(1.4, -0.9, 2.4, 0.9)],
  ]),

  /* Панельная 90-х */
  build('panel90', 1, [
    ['living', 'Комната', r(0, 0, 3.6, 5.0)],
    ['kitchen', r(3.6, 0, 2.8, 3.4)],
    ['hall', r(3.6, 3.4, 1.4, 2.6), r(0, 5.0, 3.6, 1.0)],
    ['bath', 'Ванная', r(5.0, 3.4, 1.4, 1.6)],
    ['wc', r(5.0, 5.0, 1.4, 1.0)],
    ['balcony', 'Лоджия', r(0, -1.2, 3.6, 1.2)],
  ]),
  build('panel90', 2, [
    ['living', r(0, 0, 3.8, 4.4)],
    ['bedroom', r(3.8, 0, 2.8, 4.4)],
    ['kitchen', r(6.6, 0, 2.4, 4.4)],
    ['hall', r(0, 4.4, 5.4, 1.8)],
    ['bath', 'Ванная', r(5.4, 4.4, 2.0, 1.8)],
    ['wc', r(7.4, 4.4, 1.6, 1.8)],
    ['balcony', 'Лоджия', r(0, -1.2, 6.6, 1.2)],
  ]),
  build('panel90', 3, [
    ['living', r(0, 0, 4.0, 4.4)],
    ['bedroom', r(4.0, 0, 3.0, 4.4)],
    ['bedroom', 'Детская', r(7.0, 0, 2.6, 4.4)],
    ['kitchen', r(9.6, 0, 2.4, 4.4)],
    ['hall', r(0, 4.4, 6.8, 2.0)],
    ['bath', 'Ванная', r(6.8, 4.4, 2.0, 2.0)],
    ['wc', r(8.8, 4.4, 1.2, 2.0)],
    ['storage', r(10.0, 4.4, 2.0, 2.0)],
    ['balcony', 'Лоджия', r(0, -1.2, 7.0, 1.2)],
  ]),

  /* Новостройка */
  build('novostroyka', 1, [
    ['living', 'Комната', r(0, 0, 3.6, 4.4)],
    ['kitchen', 'Кухня-ниша', r(3.6, 0, 3.0, 4.4)],
    ['bath', r(0, 4.4, 2.0, 1.4)],
    ['hall', r(2.0, 4.4, 4.6, 1.4)],
    ['balcony', 'Лоджия', r(0, -1.1, 3.6, 1.1)],
  ]),
  build('novostroyka', 2, [
    ['kitchen', 'Кухня-гостиная', r(0, 0, 3.4, 4.2)],
    ['living', r(3.4, 0, 4.0, 4.2)],
    ['bedroom', r(7.4, 0, 3.2, 4.2)],
    ['hall', r(0, 4.2, 5.2, 1.8)],
    ['bath', 'Ванная', r(5.2, 4.2, 2.0, 1.8)],
    ['bath', 'Гостевой санузел', r(7.2, 4.2, 1.6, 1.8)],
    ['storage', 'Гардеробная', r(8.8, 4.2, 1.8, 1.8)],
    ['balcony', 'Лоджия', r(0, -1.1, 3.4, 1.1)],
  ]),
  build('novostroyka', 3, [
    ['kitchen', 'Кухня-гостиная', r(0, 0, 3.6, 4.4)],
    ['living', r(3.6, 0, 4.4, 4.4)],
    ['bedroom', r(8.0, 0, 3.4, 4.4)],
    ['bedroom', 'Детская', r(11.4, 0, 2.8, 4.4)],
    ['hall', r(0, 4.4, 6.6, 2.0)],
    ['bath', 'Ванная', r(6.6, 4.4, 2.2, 2.0)],
    ['bath', 'Гостевой санузел', r(8.8, 4.4, 1.6, 2.0)],
    ['storage', 'Гардеробная', r(10.4, 4.4, 3.8, 2.0)],
    ['balcony', 'Лоджия', r(0, -1.1, 3.6, 1.1)],
  ]),
];
