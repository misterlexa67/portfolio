import { read, resetAll, write } from './store';
import { call, uid } from './transport';
import type { CabinetClient, CalcOrigin, CalcParams, FaqItem, Project, SiteTexts } from './types';
import { ApiError } from './types';

/* Объекты на карте, FAQ и гарантии, тексты сайта, кабинет клиента, сессии и черновик расчёта. */

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;
const reindex = <T extends { order: number }>(list: T[]) => list.map((x, i) => ({ ...x, order: i }));

function move<T extends { id: string; order: number }>(list: T[], id: string, dir: -1 | 1): T[] {
  const sorted = [...list].sort(byOrder);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return reindex(sorted);
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  return reindex(sorted);
}

export const projects = {
  list(opts: { all?: boolean } = {}): Promise<Project[]> {
    return call(() => read('projects').filter((p) => opts.all || p.enabled).sort(byOrder));
  },
  save(p: Project): Promise<Project> {
    return call(() => {
      if (!p.title.trim()) throw new ApiError('validation', 'Назовите объект', 'title');
      if (!(p.area >= 10 && p.area <= 400)) throw new ApiError('area_range', 'Площадь объекта — от 10 до 400 м²', 'area');
      if (!(p.price > 0)) throw new ApiError('validation', 'Укажите стоимость', 'price');
      const list = read('projects', true);
      const exists = list.some((x) => x.id === p.id);
      const item = exists ? p : { ...p, id: uid('pr'), order: list.length };
      write('projects', exists ? list.map((x) => (x.id === p.id ? item : x)) : [...list, item]);
      return item;
    });
  },
  remove(id: string): Promise<void> {
    return call(() => write('projects', reindex(read('projects', true).filter((x) => x.id !== id).sort(byOrder))));
  },
  move(id: string, dir: -1 | 1): Promise<void> {
    return call(() => write('projects', move(read('projects', true), id, dir)), [60, 120]);
  },
};

export const faq = {
  list(group: FaqItem['group'], opts: { all?: boolean } = {}): Promise<FaqItem[]> {
    return call(() => read('faq').filter((f) => f.group === group && (opts.all || f.enabled)).sort(byOrder));
  },
  save(item: FaqItem): Promise<FaqItem> {
    return call(() => {
      if (!item.q.trim() || !item.a.trim()) throw new ApiError('validation', 'Заполните вопрос и ответ');
      const list = read('faq', true);
      const exists = list.some((x) => x.id === item.id);
      const next = exists ? item : { ...item, id: uid('faq'), order: list.filter((x) => x.group === item.group).length };
      write('faq', exists ? list.map((x) => (x.id === item.id ? next : x)) : [...list, next]);
      return next;
    });
  },
  remove(id: string): Promise<void> {
    return call(() => write('faq', read('faq', true).filter((x) => x.id !== id)));
  },
  move(id: string, dir: -1 | 1): Promise<void> {
    return call(() => {
      const all = read('faq', true);
      const group = all.find((x) => x.id === id)?.group;
      const inGroup = move(all.filter((x) => x.group === group), id, dir);
      write('faq', [...all.filter((x) => x.group !== group), ...inGroup]);
    }, [60, 120]);
  },
};

export const texts = {
  get(): Promise<SiteTexts> { return call(() => read('texts'), [60, 140]); },
  save(t: SiteTexts): Promise<SiteTexts> {
    return call(() => {
      if (!t.heroTitle.trim()) throw new ApiError('validation', 'Заголовок не может быть пустым', 'heroTitle');
      write('texts', t);
      return t;
    });
  },
};

/** Сводка по ремонту клиента: общий прогресс, текущий этап, оплачено. */
export function cabinetSummary(c: CabinetClient) {
  const progress = Math.round(c.stages.reduce((a, s) => a + (s.status === 'done' ? 100 : s.progress), 0) / Math.max(1, c.stages.length));
  const current = c.stages.find((s) => s.status === 'current') ?? c.stages.find((s) => s.status === 'next') ?? c.stages[c.stages.length - 1];
  const paid = c.payments.filter((p) => p.paid).reduce((a, p) => a + p.amount, 0);
  const next = c.payments.find((p) => !p.paid);
  return { progress, current, paid, left: c.contractTotal - paid, next };
}

export const cabinet = {
  get(): Promise<CabinetClient> { return call(() => read('cabinet')); },
  save(c: CabinetClient): Promise<CabinetClient> {
    return call(() => {
      const stages = c.stages.map((s) => ({ ...s, progress: Math.min(100, Math.max(0, Math.round(s.progress))) }));
      const next = { ...c, stages };
      write('cabinet', next);
      return next;
    });
  },
  addUpdate(text: string, author: string): Promise<CabinetClient> {
    return call(() => {
      if (!text.trim()) throw new ApiError('validation', 'Сообщение пустое');
      const c = read('cabinet', true);
      const next = { ...c, updates: [...c.updates, { id: uid('up'), at: new Date().toISOString(), author: author.trim() || 'Прораб', text: text.trim() }] };
      write('cabinet', next);
      return next;
    });
  },
};

export const auth = {
  /** Демо-авторизация: PIN 0000. Настоящей защиты нет — это помечено в интерфейсе. */
  adminLogin(pin: string): Promise<void> {
    return call(() => {
      if (pin !== '0000') throw new ApiError('pin', 'Неверный PIN');
      write('session', { ...read('session'), admin: true });
    }, [300, 500]);
  },
  clientLogin(): Promise<void> {
    return call(() => write('session', { ...read('session'), client: true }), [300, 500]);
  },
  logout(who: 'admin' | 'client'): Promise<void> {
    return call(() => write('session', { ...read('session'), [who]: false }), [60, 120]);
  },
  session(): { admin: boolean; client: boolean } { return read('session'); },
};

export const drafts = {
  save(params: CalcParams, origin: CalcOrigin): void {
    write('draft', { params, origin, savedAt: new Date().toISOString() });
  },
  get() { return read('draft'); },
  clear() { write('draft', null); },
};

export const demo = {
  reset(): Promise<void> { return call(() => resetAll(), [300, 500]); },
};
