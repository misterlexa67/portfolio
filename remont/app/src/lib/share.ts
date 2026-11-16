import { encodeShare, type Estimate } from '../api';
import { rub } from './format';

/** «Поделиться сметой»: Web Share API, иначе копируем ссылку. */
export async function shareEstimate(e: Estimate, toast: (t: string, tone?: 'info' | 'ok' | 'warn') => void) {
  const url = `${window.location.origin}${window.location.pathname}?${encodeShare(e)}#smeta`;
  const text = `Смета на ремонт: от ${rub(e.total)}, ${e.weeks.min}–${e.weeks.max} недель. Посмотрите расчёт и квартиру:`;
  try {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'Смета на ремонт — Метр', text, url });
      return;
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Ссылка на смету скопирована — откройте её где угодно', 'ok');
  } catch {
    window.prompt('Скопируйте ссылку на смету:', url);
  }
}
