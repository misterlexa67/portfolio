// Время ресторана — московское (Нижний Новгород, UTC+3), независимо от часового пояса устройства.
import type { OpenHours } from './types';

let nowOverride: number | null = null;
/** Для тестов: зафиксировать «текущее» время. */
export function setNow(ms: number | null): void { nowOverride = ms; }
export const now = (): number => nowOverride ?? Date.now();

const MSK_OFFSET_MIN = 180;

/** Минуты с начала суток по Москве. */
export function mskMinutes(ms: number = now()): number {
  const d = new Date(ms + MSK_OFFSET_MIN * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Полночь по Москве для момента ms (в UTC-миллисекундах). */
export function mskDayStart(ms: number = now()): number {
  const off = MSK_OFFSET_MIN * 60000;
  return Math.floor((ms + off) / 86400000) * 86400000 - off;
}

export function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function fmtHM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Открыт ли ресторан в момент ms (поддерживает работу после полуночи). */
export function isOpenAt(hours: OpenHours, ms: number = now()): boolean {
  const o = parseHM(hours.open);
  const c = parseHM(hours.close);
  const t = mskMinutes(ms);
  if (o === c) return true;            // круглосуточно
  if (c > o) return t >= o && t < c;
  return t >= o || t < c;              // ночной режим
}

export function opensAtLabel(hours: OpenHours, ms: number = now()): string | null {
  return isOpenAt(hours, ms) ? null : hours.open;
}

/** Метка ms в формате «HH:MM» по Москве. */
export function mskLabel(ms: number): string { return fmtHM(mskMinutes(ms)); }

/**
 * Слоты «ко времени»: каждые 30 минут на ближайшие 12 часов,
 * только в часы работы ресторана и не раньше, чем через время доставки.
 */
export function buildSlots(hours: OpenHours, leadMinutes: number, from: number = now()): number[] {
  const step = 30 * 60000;
  const earliest = from + Math.max(leadMinutes, 30) * 60000;
  const first = Math.ceil(earliest / step) * step;
  const out: number[] = [];
  for (let t = first; t < from + 12 * 3600000 && out.length < 12; t += step) {
    // заказ должен успеть приготовиться в часы работы
    if (isOpenAt(hours, t - leadMinutes * 60000) || isOpenAt(hours, t - 60000)) out.push(t);
  }
  return out;
}
