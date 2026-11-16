import { OPTIONS } from './seed/catalog';
import { HOUSE_TYPES } from './seed/plans';
import type { BudgetLevel, CalcParams, Estimate, OptionId, RenovationType } from './types';

/* Формат ссылки «Поделиться сметой». Ссылка хранит параметры расчёта,
   а также версию цен и итог — если цены с тех пор поменялись, честно покажем это. */

const TYPES: RenovationType[] = ['cosmetic', 'capital', 'designer'];
const LEVELS: BudgetLevel[] = ['economy', 'standard', 'premium'];
const OPT_CODES: Record<OptionId, string> = { demolition: 'd', electrics: 'e', warmFloor: 'w', conditioner: 'c', designProject: 'p' };

export interface SharedCalc { params: CalcParams; priceVersion?: number; total?: number }

export function encodeShare(e: Estimate): string {
  const p = e.params;
  const q = new URLSearchParams({
    calc: '1',
    a: String(p.area),
    h: p.house,
    r: String(p.rooms),
    b: String(p.bathrooms),
    t: p.type,
    l: p.level,
    o: p.options.map((o) => OPT_CODES[o]).join(''),
    v: String(e.priceVersion),
    s: String(e.total),
  });
  if (p.planId) q.set('pl', p.planId);
  return q.toString();
}

export function decodeShare(search: string): SharedCalc | null {
  const q = new URLSearchParams(search);
  if (q.get('calc') !== '1') return null;
  const area = Number(q.get('a'));
  const house = HOUSE_TYPES.find((h) => h.id === q.get('h'))?.id;
  const type = TYPES.find((t) => t === q.get('t'));
  const level = LEVELS.find((l) => l === q.get('l')) ?? 'standard';
  if (!Number.isFinite(area) || !house || !type) return null;
  const codes = q.get('o') ?? '';
  const options = OPTIONS.map((o) => o.id).filter((id) => codes.includes(OPT_CODES[id]));
  const planId = q.get('pl') ?? undefined;
  return {
    params: {
      area, house, type, level, options,
      rooms: Number(q.get('r')) || 1,
      bathrooms: Number(q.get('b')) || 1,
      planId: planId && /^[a-z0-9]+-\d$/.test(planId) ? planId : undefined,
    },
    priceVersion: Number(q.get('v')) || undefined,
    total: Number(q.get('s')) || undefined,
  };
}
