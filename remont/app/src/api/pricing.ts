import { OPTIONS, OPTION_INCLUDES, STAGE_INCLUDES, STAGE_TITLES } from './seed/catalog';
import type {
  CalcParams, Estimate, EstimateLine, IsoLayers, OptionId, PriceSettings, StageId,
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
    rooms: Math.min(4, Math.max(1, Math.round(p.rooms || 1))),
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
    screed: deep || p.options.includes('demolition'),
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

export function computeEstimate(raw: CalcParams, s: PriceSettings, now = new Date()): Estimate {
  const p = normalizeParams(raw, s);
  const coef = s.houseCoef[p.house];
  const lvl = s.budget[p.level];
  const has = (id: OptionId) => p.options.includes(id);

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
  amounts.finishing += s.perRoom * p.rooms * lvl.works;

  // 4. Опции
  const extraIncludes: Partial<Record<StageId, string[]>> = {};
  for (const opt of OPTIONS) {
    if (!has(opt.id)) continue;
    const price = s.options[opt.id];
    let sum = opt.unit === 'perM2' ? price * p.area : opt.unit === 'perRoom' ? price * p.rooms : price;
    if (opt.id === 'demolition') sum *= coef; // в старом фонде демонтаж тяжелее
    amounts[opt.stage] += sum;
    (extraIncludes[opt.stage] ??= []).push(OPTION_INCLUDES[opt.id]);
  }
  if (has('demolition')) amounts.debris *= 1.6;

  // 5. Материалы — отдельной долей
  amounts.materials = (s.materialsPerM2[p.type] * p.area + bath.materials * p.bathrooms) * lvl.materials;

  // округление строк до 100 ₽, итог — сумма строк
  const order: StageId[] = ['design', 'rough', 'electrics', 'plumbing', 'finishing', 'materials', 'debris'];
  const rounded = order
    .map((id) => ({ id, amount: roundTo(amounts[id], 100) }))
    .filter((x) => x.amount > 0);
  const total = rounded.reduce((a, x) => a + x.amount, 0);

  const lines: EstimateLine[] = rounded.map(({ id, amount }) => ({
    id,
    title: STAGE_TITLES[id],
    amount,
    share: total ? amount / total : 0,
    includes: id === 'design'
      ? [OPTION_INCLUDES.designProject, 'Ведомость материалов с ценами', 'Согласование с вами до старта']
      : [...STAGE_INCLUDES[p.type][id as Exclude<StageId, 'design'>], ...(extraIncludes[id] ?? []).filter((t) => t !== OPTION_INCLUDES.designProject)],
    kind: id === 'materials' ? 'materials' : id === 'design' || id === 'debris' ? 'service' : 'works',
  }));

  const materialsTotal = lines.filter((l) => l.kind === 'materials').reduce((a, l) => a + l.amount, 0);

  // 6. Срок
  const w = s.weeks[p.type];
  let weeks = w.base + w.perM2 * p.area + Math.max(0, p.bathrooms - 1);
  for (const opt of OPTIONS) if (has(opt.id)) weeks += opt.weeks;
  if (p.level === 'premium') weeks += 1;
  const min = Math.max(2, Math.round(weeks));

  // 7. Платежи по этапам: последний платёж добирает остаток, чтобы сумма сошлась до рубля
  let acc = 0;
  const payments = s.payments.map((st, i) => {
    const amount = i === s.payments.length - 1 ? total - acc : roundTo((total * st.percent) / 100, 100);
    acc += amount;
    return { ...st, amount };
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
