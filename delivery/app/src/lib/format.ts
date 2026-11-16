// Только форматирование для отображения. Никаких расчётов денег.

const nf = new Intl.NumberFormat('ru-RU');

export const rub = (n: number): string => `${nf.format(n)} ₽`;
export const num = (n: number): string => nf.format(n);

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export const eta = (e: { min: number; max: number } | null): string => (e ? `${e.min}–${e.max} мин` : '—');

export const fee = (n: number | null): string => (n === null ? '—' : n === 0 ? 'Бесплатно' : rub(n));

export const rating = (r: number): string => (r > 0 ? r.toFixed(1).replace('.', ',') : 'Новый');

export const ratingCount = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} тыс.` : String(n));

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** Дата и время по Москве: «сегодня, 14:05», «вчера, 21:30», «12 ноября, 09:10». */
export function when(ms: number): string {
  const off = 3 * 3600000;
  const d = new Date(ms + off);
  const today = new Date(Date.now() + off);
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  const dayDiff = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86400000);
  if (dayDiff === 0) return `сегодня, ${hm}`;
  if (dayDiff === 1) return `вчера, ${hm}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hm}`;
}

export const hm = (ms: number): string => {
  const d = new Date(ms + 3 * 3600000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
