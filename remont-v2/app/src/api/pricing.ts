import { OPTIONS, OPTION_INCLUDES, PAYMENT_READY, STAGE_INCLUDES, STAGE_TITLES } from './seed/catalog';
import { HOUSE_TYPES } from './seed/plans';
import type {
  CalcParams, CostLayer, Estimate, EstimateItem, EstimateLine, IsoLayers, OptionId, PriceSettings, StageId,
} from './types';
import { ApiError } from './types';

/* ЕДИНСТВЕННОЕ место, где считаются деньги.
   Вызывается только сервисом estimates (и тестами). Компоненты сюда не ходят. */

const OPTION_IDS = OPTIONS.map((o) => o.id);
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function normalizeParams(p: CalcParams, s: PriceSettings, strict = false): CalcParams {
  const area = Number(p.area);
  if (!Number.isFinite(area) || area < s.minArea || area > s.maxArea) {
    if (strict) {
      throw new ApiError('area_range', `Площадь должна быть от ${s.minArea} до ${s.maxArea} м²`, 'area');
    }
  }
  const clamped = Math.min(s.maxArea, Math.max(s.minArea, Number.isFinite(area) ? area : 50));
  return {
    area: Math.round(clamped * 10) / 10,
    house: s.houseCoef[p.house] !== undefined ? p.house : 'panel90',
    rooms: Math.min(6, Math.max(1, Math.round(p.rooms || 1))),
    bathrooms: Math.min(3, Math.max(1, Math.round(p.bathrooms || 1))),
    type: s.worksPerM2[p.type] !== undefined ? p.type : 'capital',
    level: s.budget[p.level] ? p.level : 'standard',
    options: OPTION_IDS.filter((id) => p.options.includes(id)),
    planId: p.planId,
  };
}

export function layersFor(p: CalcParams): IsoLayers {
  const deep = p.type !== 'cosmetic';
  return {
    screed: deep,
    partitions: true,
    electrics: deep || p.options.includes('electrics'),
    warmFloor: p.options.includes('warmFloor'),
    walls: true,
    floor: true,
    light: true,
    furniture: true,
    conditioner: p.options.includes('conditioner'),
  };
}

/** Объёмы работ из площади, комнат и высоты потолка — для сметы «Штукатурка стен — 142 м²». */
export function volumesFor(p: CalcParams) {
  const ceiling = HOUSE_TYPES.find((h) => h.id === p.house)?.ceiling ?? 2.7;
  const bathFloor = 4 * p.bathrooms;
  const wallArea = Math.round(p.area * 2.55 * (ceiling / 2.7));
  const tileArea = Math.round(p.bathrooms * 18 + bathFloor + (p.type === 'cosmetic' ? 2 : 4));
  return {
    wallArea,
    floorArea: Math.round(p.area - bathFloor),
    tileArea,
    bathFloor,
    sockets: p.rooms * 7 + 9 + p.bathrooms * 3 + 4,
    lights: p.rooms * 2 + 4 + p.bathrooms,
    cable: Math.round(p.area * 3.4),
    doors: p.rooms + p.bathrooms + 1,
    partitions: Math.round(p.rooms * 2.2 * ceiling),
    plumbingPoints: p.bathrooms * 5 + 2,
    fixtures: p.bathrooms * 4 + 1,
    heated: Math.round(bathFloor + 5),
  };
}

type Draft = { id: string; title: string; qty: number; unit: string; layer: CostLayer } & ({ w: number } | { exact: number });

/** Делит сумму строки на позиции: точные (опции, двери) + остаток по весам. Сумма позиций = сумме строки. */
function split(total: number, drafts: Draft[]): EstimateItem[] {
  const exact = drafts.filter((d): d is Draft & { exact: number } => 'exact' in d);
  const weighted = drafts.filter((d): d is Draft & { w: number } => 'w' in d);
  const exactItems = exact.map((d) => ({ id: d.id, title: d.title, qty: d.qty, unit: d.unit, layer: d.layer, amount: roundTo(d.exact, 100) }));
  let rest = total - exactItems.reduce((a, x) => a + x.amount, 0);
  const wSum = weighted.reduce((a, d) => a + d.w, 0) || 1;
  const wItems = weighted.map((d) => ({ id: d.id, title: d.title, qty: d.qty, unit: d.unit, layer: d.layer, amount: roundTo((rest * d.w) / wSum, 100) }));
  const all = [...wItems, ...exactItems];
  const diff = total - all.reduce((a, x) => a + x.amount, 0);
  if (all.length) (wItems[0] ?? all[0]).amount += diff;
  rest = 0;
  return all.filter((x) => x.amount !== 0 || x.qty > 0);
}

export function computeEstimate(raw: CalcParams, s: PriceSettings, now = new Date()): Estimate {
  const p = normalizeParams(raw, s);
  const coef = s.houseCoef[p.house];
  const lvl = s.budget[p.level];
  const has = (id: OptionId) => p.options.includes(id);
  const v = volumesFor(p);
  const deep = p.type !== 'cosmetic';

  // 1. Работы: база × коэффициент дома × уровень, по долям этапов
  const baseWorks = s.worksPerM2[p.type] * p.area * coef * lvl.works;
  const shares = s.workShares[p.type];
  const amounts: Record<StageId, number> = {
    design: 0,
    rough: baseWorks * shares.rough,
    electrics: baseWorks * shares.electrics,
    plumbing: baseWorks * shares.plumbing,
    finishing: baseWorks * shares.finishing,
    materials: 0,
    debris: s.debrisPerM2 * p.area,
  };

  // 2. Санузлы — работы в сантехнику, материалы в материалы
  const bath = s.bathroom[p.type];
  amounts.plumbing += bath.works * p.bathrooms * coef * lvl.works;

  // 3. Двери и проёмы по числу комнат
  const doorsSum = s.perRoom * p.rooms * lvl.works;
  amounts.finishing += doorsSum;

  // 4. Опции
  const extraIncludes: Partial<Record<StageId, string[]>> = {};
  const optionSum: Partial<Record<OptionId, number>> = {};
  for (const opt of OPTIONS) {
    if (!has(opt.id)) continue;
    const price = s.options[opt.id];
    let sum = opt.unit === 'perM2' ? price * p.area : opt.unit === 'perRoom' ? price * p.rooms : price;
    if (opt.id === 'demolition') sum *= coef; // в старом фонде демонтаж тяжелее
    amounts[opt.stage] += sum;
    optionSum[opt.id] = sum;
    (extraIncludes[opt.stage] ??= []).push(OPTION_INCLUDES[opt.id]);
  }
  if (has('demolition')) amounts.debris *= 1.6;

  // 5. Материалы — отдельной долей
  amounts.materials = (s.materialsPerM2[p.type] * p.area + bath.materials * p.bathrooms) * lvl.materials;

  const order: StageId[] = ['design', 'rough', 'electrics', 'plumbing', 'finishing', 'materials', 'debris'];
  const rounded = order
    .map((id) => ({ id, amount: roundTo(amounts[id], 100) }))
    .filter((x) => x.amount > 0);
  const total = rounded.reduce((a, x) => a + x.amount, 0);

  // 6. Позиции с объёмами внутри каждой строки
  const opt = (id: OptionId, title: string, qty: number, unit: string, layer: CostLayer): Draft[] =>
    optionSum[id] ? [{ id, title, qty, unit, layer, exact: optionSum[id]! }] : [];
  const drafts: Record<StageId, Draft[]> = {
    design: opt('designProject', 'Дизайн-проект: планировка, визуализации, чертежи', p.area, 'м²', 'design'),
    rough: [
      ...(deep
        ? [
          { id: 'screed', title: 'Стяжка пола по маякам', qty: v.floorArea, unit: 'м²', layer: 'screed' as const, w: 3 },
          { id: 'plaster', title: 'Штукатурка стен по маякам', qty: v.wallArea, unit: 'м²', layer: 'partitions' as const, w: 4 },
          { id: 'partitions', title: 'Перегородки', qty: v.partitions, unit: 'м²', layer: 'partitions' as const, w: 2 },
          { id: 'waterproof', title: 'Гидроизоляция санузла', qty: Math.round(v.bathFloor * 1.5), unit: 'м²', layer: 'plumbing' as const, w: 0.7 },
        ]
        : [
          { id: 'protect', title: 'Защита окон, дверей и полов', qty: Math.round(p.area), unit: 'м²', layer: 'walls' as const, w: 1 },
          { id: 'putty', title: 'Шпаклёвка дефектов стен', qty: Math.round(v.wallArea * 0.3), unit: 'м²', layer: 'walls' as const, w: 2 },
          { id: 'primer', title: 'Грунтовка стен и потолков', qty: Math.round(v.wallArea + p.area), unit: 'м²', layer: 'walls' as const, w: 1 },
        ]),
      ...(p.type === 'designer' ? [{ id: 'boxes', title: 'Короба, ниши, теневые профили', qty: p.rooms * 3, unit: 'м.п.', layer: 'partitions' as const, w: 1.5 }] : []),
      ...opt('demolition', 'Демонтаж старой отделки и перегородок', Math.round(p.area), 'м²', 'demolition'),
    ],
    electrics: [
      { id: 'sockets', title: 'Розетки и выключатели', qty: v.sockets, unit: 'шт', layer: 'electrics', w: 3 },
      { id: 'cable', title: 'Кабель и штробление', qty: v.cable, unit: 'м', layer: 'electrics', w: 3 },
      { id: 'lights', title: 'Светильники и подключение', qty: v.lights, unit: 'шт', layer: 'light', w: 1.6 },
      { id: 'panel', title: 'Щит и автоматика', qty: 1, unit: 'шт', layer: 'electrics', w: 1 },
      ...opt('electrics', 'Полная замена проводки', Math.round(p.area), 'м²', 'electrics'),
      ...opt('warmFloor', 'Тёплый пол: санузел и кухня', v.heated, 'м²', 'warmFloor'),
      ...opt('conditioner', 'Трассы и монтаж кондиционеров', p.rooms, 'шт', 'conditioner'),
    ],
    plumbing: [
      { id: 'fixtures', title: 'Установка сантехприборов', qty: v.fixtures, unit: 'шт', layer: 'plumbing', w: 3 },
      { id: 'pipes', title: 'Разводка труб', qty: v.plumbingPoints, unit: 'точек', layer: 'plumbing', w: 3 },
      { id: 'bathroom', title: 'Санузел под ключ', qty: p.bathrooms, unit: 'шт', layer: 'plumbing', w: 2 },
    ],
    finishing: [
      { id: 'paint', title: deep ? 'Шпаклёвка и покраска стен' : 'Покраска или обои', qty: v.wallArea, unit: 'м²', layer: 'walls', w: 4 },
      { id: 'tile', title: 'Плитка в санузле и на кухне', qty: v.tileArea, unit: 'м²', layer: 'walls', w: deep ? 3 : 1.5 },
      { id: 'floor', title: deep ? 'Напольное покрытие' : 'Укладка ламината', qty: v.floorArea, unit: 'м²', layer: 'floor', w: 3 },
      { id: 'ceiling', title: 'Потолки', qty: Math.round(p.area), unit: 'м²', layer: 'walls', w: 2 },
      { id: 'doors', title: 'Двери, откосы, плинтусы', qty: v.doors, unit: 'шт', layer: 'partitions', exact: doorsSum },
    ],
    materials: [
      ...(deep ? [{ id: 'm-rough', title: 'Черновые смеси, ГКЛ, грунты', qty: Math.round(p.area * 28), unit: 'кг', layer: 'screed' as const, w: 22 }] : [{ id: 'm-rough', title: 'Шпаклёвка и грунт', qty: Math.round(p.area * 6), unit: 'кг', layer: 'walls' as const, w: 10 }]),
      { id: 'm-el', title: 'Кабель, автоматы, механизмы', qty: v.cable, unit: 'м', layer: 'electrics', w: deep ? 10 : 7 },
      { id: 'm-plumb', title: 'Сантехника и трубы', qty: v.fixtures, unit: 'шт', layer: 'plumbing', w: 20 },
      { id: 'm-walls', title: 'Плитка, краска или обои', qty: v.wallArea + v.tileArea, unit: 'м²', layer: 'walls', w: deep ? 22 : 30 },
      { id: 'm-floor', title: 'Напольное покрытие с запасом 7%', qty: Math.round(v.floorArea * 1.07), unit: 'м²', layer: 'floor', w: deep ? 20 : 25 },
      { id: 'm-light', title: 'Светильники', qty: v.lights, unit: 'шт', layer: 'light', w: 6 },
    ],
    debris: [{ id: 'debris', title: 'Вывоз строительного мусора', qty: Math.max(1, Math.round(p.area * 0.09 * (has('demolition') ? 2 : 1) * (deep ? 1 : 0.6))), unit: 'м³', layer: 'debris', w: 1 }],
  };

  const lines: EstimateLine[] = rounded.map(({ id, amount }) => ({
    id,
    title: STAGE_TITLES[id],
    amount,
    share: total ? amount / total : 0,
    includes: id === 'design'
      ? [OPTION_INCLUDES.designProject, 'Ведомость материалов с ценами', 'Согласование с вами до старта']
      : [...STAGE_INCLUDES[p.type][id as Exclude<StageId, 'design'>], ...(extraIncludes[id] ?? []).filter((t) => t !== OPTION_INCLUDES.designProject)],
    items: split(amount, drafts[id]),
    kind: id === 'materials' ? 'materials' : id === 'design' || id === 'debris' ? 'service' : 'works',
  }));

  const layerCosts: Partial<Record<CostLayer, number>> = {};
  lines.forEach((l) => l.items.forEach((it) => { layerCosts[it.layer] = (layerCosts[it.layer] ?? 0) + it.amount; }));

  const materialsTotal = lines.filter((l) => l.kind === 'materials').reduce((a, l) => a + l.amount, 0);

  // 7. Срок
  const w = s.weeks[p.type];
  let weeks = w.base + w.perM2 * p.area + Math.max(0, p.bathrooms - 1);
  for (const o of OPTIONS) if (has(o.id)) weeks += o.weeks;
  if (p.level === 'premium') weeks += 1;
  const min = Math.max(2, Math.round(weeks));

  // 8. Платежи по этапам + примерные даты: последний платёж добирает остаток до рубля
  const days = min * 7;
  const roughEnd = Math.round(days * (deep ? 0.5 : 0.3));
  const finishEnd = Math.round(days * 0.88);
  const offsets = [0, roughEnd, finishEnd, days + 2];
  let acc = 0;
  const payments = s.payments.map((st, i) => {
    const amount = i === s.payments.length - 1 ? total - acc : roundTo((total * st.percent) / 100, 100);
    acc += amount;
    const ready = PAYMENT_READY[Math.min(i, PAYMENT_READY.length - 1)];
    return { ...st, amount, dayOffset: offsets[Math.min(i, offsets.length - 1)], ready: deep || i !== 1 ? ready.text : ready.cosmetic ?? ready.text, layers: ready.layers };
  });

  return {
    params: p,
    priceVersion: s.version,
    createdAt: now.toISOString(),
    lines,
    worksTotal: total - materialsTotal,
    materialsTotal,
    total,
    perM2: roundTo(total / p.area, 10),
    weeks: { min, max: min + (p.type === 'cosmetic' ? 1 : 2) },
    payments,
    layers: layersFor(p),
    houseCoef: coef,
    layerCosts,
    volumes: { wallArea: v.wallArea, floorArea: v.floorArea, tileArea: v.tileArea, sockets: v.sockets, lights: v.lights, cable: v.cable, doors: v.doors },
  };
}

export function validatePrices(s: PriceSettings): void {
  const sum = s.payments.reduce((a, x) => a + Number(x.percent || 0), 0);
  if (Math.round(sum) !== 100) {
    throw new ApiError('payments_sum', `Сумма платежей должна быть 100%, сейчас ${sum}%`, 'payments');
  }
  const nums: number[] = [
    ...Object.values(s.worksPerM2), ...Object.values(s.materialsPerM2), ...Object.values(s.houseCoef),
    ...Object.values(s.options), s.perRoom, s.debrisPerM2,
  ];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new ApiError('validation', 'Цены и коэффициенты должны быть положительными числами');
  }
  if (s.minArea >= s.maxArea) throw new ApiError('validation', 'Минимальная площадь должна быть меньше максимальной');
}
