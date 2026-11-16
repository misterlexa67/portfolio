import { ApiError } from './types';

export const phoneDigits = (s: string) => {
  let d = (s || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d;
};

export function normalizePhone(s: string): string {
  const d = phoneDigits(s);
  if (d.length !== 11 || d[0] !== '7' || d[1] === '0' || d[1] === '1' || d[1] === '2') {
    throw new ApiError('phone', 'Проверьте номер: нужно 10 цифр после +7', 'phone');
  }
  return `+7 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
}

export function normalizeName(s: string): string {
  const v = (s || '').trim().replace(/\s+/g, ' ');
  if (v.length < 2) throw new ApiError('name', 'Как к вам обращаться? Напишите имя', 'name');
  if (v.length > 60) throw new ApiError('name', 'Имя слишком длинное', 'name');
  return v;
}

export function requireConsent(c: boolean) {
  if (!c) throw new ApiError('consent', 'Отметьте согласие на обработку данных — без него не можем записать', 'consent');
}

/** Проверка полей формы для подсказок прямо под полем. Те же правила, что при отправке. */
export function checkFields(f: { name?: string; phone?: string; consent?: boolean }): Partial<Record<'name' | 'phone' | 'consent', string>> {
  const out: Partial<Record<'name' | 'phone' | 'consent', string>> = {};
  const run = (k: 'name' | 'phone' | 'consent', fn: () => void) => { try { fn(); } catch (e) { out[k] = (e as Error).message; } };
  if (f.name !== undefined) run('name', () => normalizeName(f.name!));
  if (f.phone !== undefined) run('phone', () => normalizePhone(f.phone!));
  if (f.consent !== undefined) run('consent', () => requireConsent(f.consent!));
  return out;
}
