/* Публичная точка входа сервисного слоя. UI импортирует только отсюда. */
import { estimates } from './estimates';
import { leads } from './leads';
import { slots } from './slots';
import { auth, cabinet, demo, drafts, faq, projects, texts } from './content';
import { planFor, planDoors } from './geometry';
import { PLANS, HOUSE_TYPES } from './seed/plans';
import { BUDGET_LEVELS, DISTRICTS, HOUSE_ROOM_NOTES, OPTIONS, RENOVATION_TYPES, ROOM_TIPS, STAGE_TITLES } from './seed/catalog';
import { call } from './transport';

export const catalog = {
  houseTypes: HOUSE_TYPES,
  renovationTypes: RENOVATION_TYPES,
  budgetLevels: BUDGET_LEVELS,
  options: OPTIONS,
  districts: DISTRICTS,
  stageTitles: STAGE_TITLES,
};

export const plans = {
  /** Типовая планировка дома (для «Выберите ваш дом»). */
  typical(house: string, rooms: number) {
    return call(() => PLANS.find((p) => p.house === house && p.rooms === rooms) ?? PLANS[0], [120, 260]);
  },
  /** Синхронно: планировка под параметры расчёта — нужна для плавной сборки изометрии без задержек. */
  forParams: planFor,
  /** Двери с направлением открывания. */
  doors: planDoors,
  /** «Что обычно делают в этой комнате» в этом типе дома. */
  roomTip(house: string, kind: import('./types').RoomKind): string {
    const note = HOUSE_ROOM_NOTES[house as keyof typeof HOUSE_ROOM_NOTES]?.[kind];
    return note ? `${ROOM_TIPS[kind]} ${note}` : ROOM_TIPS[kind];
  },
};

export const api = { estimates, leads, slots, projects, faq, texts, cabinet, auth, drafts, demo, plans, catalog };

export { subscribe } from './store';
export type { Key as StoreKey } from './store';
export type { Door } from './geometry';
export { STATUS_LABELS, SOURCE_LABELS, isHot, describeParams } from './leads';
export { encodeShare, decodeShare } from './share';
export { cabinetSummary } from './content';
export { checkFields } from './validate';
export { TYPICAL_2ROOM } from './estimates';
export * from './types';
