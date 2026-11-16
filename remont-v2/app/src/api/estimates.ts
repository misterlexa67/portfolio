import { computeEstimate, normalizeParams, validatePrices } from './pricing';
import { read, write } from './store';
import { call } from './transport';
import type { BudgetLevel, CalcParams, Estimate, EstimateSnapshot, PriceSettings } from './types';
import { BUDGET_LEVELS, RENOVATION_TYPES } from './seed/catalog';
import { HOUSE_TYPES, PLANS } from './seed/plans';

/* Сервис расчётов. Калькулятор, три бюджета, смета, PDF и превью в админке — всё через него. */

export const TYPICAL_2ROOM: CalcParams = {
  area: 54.5, house: 'brezhnevka', rooms: 2, bathrooms: 1, type: 'capital', level: 'standard',
  options: ['demolition', 'electrics'], planId: 'brezhnevka-2',
};

export const snapshot = (e: Estimate): EstimateSnapshot => ({
  total: e.total, perM2: e.perM2, weeks: e.weeks, worksTotal: e.worksTotal, materialsTotal: e.materialsTotal,
  priceVersion: e.priceVersion, lines: e.lines.map((l) => ({ id: l.id, title: l.title, amount: l.amount })),
});

const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} ₽`;

export const estimates = {
  calculate(params: CalcParams, opts: { settings?: PriceSettings; strict?: boolean } = {}): Promise<Estimate> {
    return call(() => {
      const s = opts.settings ?? read('settings');
      if (opts.strict) normalizeParams(params, s, true);
      return computeEstimate(params, s);
    }, [60, 140]);
  },

  compareBudgets(params: CalcParams): Promise<Record<BudgetLevel, Estimate>> {
    return call(() => {
      const s = read('settings');
      const out = {} as Record<BudgetLevel, Estimate>;
      for (const l of BUDGET_LEVELS) out[l.id] = computeEstimate({ ...params, level: l.id }, s);
      return out;
    }, [80, 160]);
  },

  /** Типовая двушка: «было / стало» при редактировании цен в админке. */
  typicalBeforeAfter(draft: PriceSettings): Promise<{ before: Estimate; after: Estimate }> {
    return call(() => ({
      before: computeEstimate(TYPICAL_2ROOM, read('settings')),
      after: computeEstimate(TYPICAL_2ROOM, draft),
    }), [40, 90]);
  },

  /** «от … ₽/м²» для первого экрана. Под ключ — минимум среди типовых квартир при косметическом ремонте
      уровня «Эконом» без опций; возвращаем и параметры, чтобы калькулятор показал то же число. */
  priceFrom(): Promise<{ worksPerM2: number; turnkeyPerM2: number; turnkeyParams: CalcParams }> {
    return call(() => {
      const s = read('settings');
      let best: { perM2: number; params: CalcParams } | null = null;
      for (const p of PLANS) {
        const params: CalcParams = { area: p.area, house: p.house, rooms: p.rooms, bathrooms: p.bathrooms, type: 'cosmetic', level: 'economy', options: [], planId: p.id };
        const e = computeEstimate(params, s);
        if (!best || e.perM2 < best.perM2) best = { perM2: e.perM2, params };
      }
      return {
        worksPerM2: Math.round(s.worksPerM2.cosmetic * s.budget.economy.works / 100) * 100,
        turnkeyPerM2: best!.perM2,
        turnkeyParams: best!.params,
      };
    }, [60, 120]);
  },

  getSettings(): Promise<PriceSettings> {
    return call(() => read('settings'), [80, 160]);
  },

  saveSettings(next: PriceSettings): Promise<PriceSettings> {
    return call(() => {
      validatePrices(next);
      const cur = read('settings', true);
      const saved: PriceSettings = { ...next, version: cur.version + 1, updatedAt: new Date().toISOString() };
      write('settings', saved);
      return saved;
    }, [200, 400]);
  },

  /** Текст, который пришёл бы клиенту в Telegram. Ничего не отправляется. */
  telegramMessage(e: Estimate): string {
    const house = HOUSE_TYPES.find((h) => h.id === e.params.house)?.name ?? '';
    const type = RENOVATION_TYPES.find((t) => t.id === e.params.type)?.name ?? '';
    const level = BUDGET_LEVELS.find((l) => l.id === e.params.level)?.name ?? '';
    const lines = e.lines.map((l) => `• ${l.title} — ${rub(l.amount)}`).join('\n');
    const pays = e.payments.map((p) => `${p.percent}% ${p.after} — ${rub(p.amount)}`).join('\n');
    return [
      'Метр · смета на ремонт',
      `${house}, ${e.params.rooms}-комн., ${String(e.params.area).replace('.', ',')} м²`,
      `${type} ремонт, уровень «${level}»`,
      '',
      lines,
      '',
      `Итого: от ${rub(e.total)} (${rub(e.perM2)}/м²)`,
      `Срок: ${e.weeks.min}–${e.weeks.max} недель`,
      '',
      'Оплата по этапам:',
      pays,
      '',
      'Смета фиксируется в договоре. Цена не изменится.',
    ].join('\n');
  },
};
