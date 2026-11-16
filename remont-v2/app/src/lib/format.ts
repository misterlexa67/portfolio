/* Форматирование для экрана. Деньги здесь не считаются — только показываются. */

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export const num = (n: number) => nf.format(Math.round(n)).replace(/ /g, ' ');
export const rub = (n: number) => `${num(n)} ₽`;
export const area = (n: number) => `${nf1.format(n)} м²`;
export const short = (n: number) => {
  if (n >= 1_000_000) return `${nf1.format(Math.round(n / 100_000) / 10)} млн ₽`;
  if (n >= 1000) return `${nf.format(Math.round(n / 1000))} тыс. ₽`;
  return rub(n);
};

export const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};
export const weeks = (min: number, max?: number) =>
  max && max !== min ? `${min}–${max} ${plural(max, 'неделя', 'недели', 'недель')}` : `${min} ${plural(min, 'неделя', 'недели', 'недель')}`;

export const parseDate = (d: string) => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day); };
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayWord(date: string): string {
  const d = parseDate(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
}
export const dateLong = (date: string) => parseDate(date).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
export const dateShort = (date: string) => parseDate(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
export const weekdayShort = (date: string) => parseDate(date).toLocaleDateString('ru-RU', { weekday: 'short' });
export const dateTime = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
export const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
  const d = Math.round(h / 24);
  return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
};

/** Маска телефона: +7 (900) 123-45-67 */
export function maskPhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  const p = d.slice(1);
  let out = '+7';
  if (p.length) out += ` (${p.slice(0, 3)}`;
  if (p.length >= 3) out += ')';
  if (p.length > 3) out += ` ${p.slice(3, 6)}`;
  if (p.length > 6) out += `-${p.slice(6, 8)}`;
  if (p.length > 8) out += `-${p.slice(8, 10)}`;
  return out;
}
export const phoneComplete = (s: string) => s.replace(/\D/g, '').length === 11;
export const telHref = (s: string) => `tel:+${s.replace(/\D/g, '').replace(/^8/, '7')}`;
