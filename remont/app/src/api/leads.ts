import { computeEstimate } from './pricing';
import { snapshot } from './estimates';
import { read, write } from './store';
import { call, uid } from './transport';
import { normalizeName, normalizePhone, requireConsent } from './validate';
import type { CalcOrigin, CalcParams, Lead, LeadStatus } from './types';
import { ApiError, LEAD_STATUSES } from './types';
import { BUDGET_LEVELS, OPTIONS, RENOVATION_TYPES } from './seed/catalog';
import { HOUSE_TYPES } from './seed/plans';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новая',
  contacted: 'Связались',
  measurement_booked: 'Замер назначен',
  estimate_sent: 'Смета отправлена',
  contract: 'Договор',
  in_progress: 'В работе',
  done: 'Сдан',
  lost: 'Отказ',
};

export const SOURCE_LABELS: Record<CalcOrigin, string> = {
  calculator: 'Калькулятор',
  house_picker: 'Выбор дома',
  map: 'Карта объектов',
  booking: 'Запись на замер',
  share: 'Ссылка на смету',
};

/** Горячая заявка: есть полный расчёт и назначенный замер. */
export const isHot = (l: Lead) => !!(l.estimate && l.params && l.slot) && l.status !== 'lost' && l.status !== 'done';

const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} ₽`;
const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
};

export function describeParams(p: CalcParams): string {
  const house = HOUSE_TYPES.find((h) => h.id === p.house)?.name ?? '';
  const type = RENOVATION_TYPES.find((t) => t.id === p.type)?.name ?? '';
  const level = BUDGET_LEVELS.find((l) => l.id === p.level)?.name ?? '';
  return `${house}, ${p.rooms}-комн., ${String(p.area).replace('.', ',')} м² · ${type} · ${level}`;
}

export const leads = {
  list(filter: { status?: LeadStatus | 'all' | 'hot' } = {}): Promise<Lead[]> {
    return call(() => {
      let all = [...read('leads')].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (filter.status === 'hot') all = all.filter(isHot);
      else if (filter.status && filter.status !== 'all') all = all.filter((l) => l.status === filter.status);
      // горячие — наверх
      return [...all.filter(isHot), ...all.filter((l) => !isHot(l))];
    });
  },

  get(id: string): Promise<Lead> {
    return call(() => {
      const l = read('leads').find((x) => x.id === id);
      if (!l) throw new ApiError('not_found', 'Заявка не найдена — возможно, её удалили');
      return l;
    });
  },

  /** Заявка из «Прислать смету в Telegram» (демо: ничего не отправляется). */
  createFromEstimate(req: { name: string; phone: string; consent: boolean; params: CalcParams; source: CalcOrigin }): Promise<Lead> {
    return call(() => {
      const name = normalizeName(req.name);
      const phone = normalizePhone(req.phone);
      requireConsent(req.consent);
      const meta = read('meta', true);
      const now = new Date().toISOString();
      const lead: Lead = {
        id: uid('ld'), number: meta.leadCounter + 1, createdAt: now, updatedAt: now,
        name, phone, source: req.source, channel: 'telegram', status: 'estimate_sent',
        params: req.params, estimate: snapshot(computeEstimate(req.params, read('settings', true))), notes: [],
      };
      write('leads', [lead, ...read('leads', true)]);
      write('meta', { ...meta, leadCounter: meta.leadCounter + 1 });
      return lead;
    }, [300, 550]);
  },

  updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    return call(() => {
      if (!LEAD_STATUSES.includes(status)) throw new ApiError('validation', 'Неизвестный статус');
      let out: Lead | undefined;
      write('leads', read('leads', true).map((l) => {
        if (l.id !== id) return l;
        out = { ...l, status, updatedAt: new Date().toISOString() };
        return out;
      }));
      if (!out) throw new ApiError('not_found', 'Заявка не найдена');
      return out;
    });
  },

  addNote(id: string, text: string): Promise<Lead> {
    return call(() => {
      const t = text.trim();
      if (!t) throw new ApiError('validation', 'Заметка пустая');
      let out: Lead | undefined;
      write('leads', read('leads', true).map((l) => {
        if (l.id !== id) return l;
        out = { ...l, notes: [...l.notes, { id: uid('n'), at: new Date().toISOString(), text: t.slice(0, 1000) }], updatedAt: new Date().toISOString() };
        return out;
      }));
      if (!out) throw new ApiError('not_found', 'Заявка не найдена');
      return out;
    });
  },

  /** Сводка для дашборда владельца. */
  stats(): Promise<{
    newToday: number; measurementsWeek: number; avgEstimate: number; hot: number; total: number;
    bySource: { source: CalcOrigin; label: string; count: number }[];
    upcoming: { date: string; time: string; leadId: string; name: string; hot: boolean }[];
  }> {
    return call(() => {
      const all = read('leads');
      const now = new Date();
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7);
      const toDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
      const bookings = read('bookings');
      const est = all.filter((l) => l.estimate).map((l) => l.estimate!.total);
      const order: CalcOrigin[] = ['calculator', 'house_picker', 'map', 'booking', 'share'];
      return {
        newToday: all.filter((l) => new Date(l.createdAt) >= today).length,
        measurementsWeek: bookings.filter((b) => { const d = toDate(b.date); return d >= monday && d < sunday; }).length,
        avgEstimate: est.length ? Math.round(est.reduce((a, b) => a + b, 0) / est.length / 1000) * 1000 : 0,
        hot: all.filter(isHot).length,
        total: all.length,
        bySource: order.map((source) => ({ source, label: SOURCE_LABELS[source], count: all.filter((l) => l.source === source).length })),
        upcoming: [...bookings]
          .filter((b) => toDate(b.date) >= today)
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
          .slice(0, 6)
          .map((b) => { const l = all.find((x) => x.id === b.leadId); return { date: b.date, time: b.time, leadId: b.leadId, name: l?.name ?? '—', hot: l ? isHot(l) : false }; }),
      };
    });
  },

  clearAll(): Promise<void> {
    return call(() => { write('leads', []); write('bookings', []); });
  },

  /** Превью уведомления владельцу в Telegram / MAX. Ничего не отправляется. */
  notificationText(l: Lead): string {
    const rows = [
      `Новая заявка №${l.number} · ${SOURCE_LABELS[l.source]}`,
      `${l.name}, ${l.phone}`,
    ];
    if (l.params) rows.push(describeParams(l.params));
    if (l.params?.options.length) rows.push(`Опции: ${l.params.options.map((o) => OPTIONS.find((x) => x.id === o)?.name).join(', ')}`);
    if (l.estimate) rows.push(`Смета: ${rub(l.estimate.total)} · ${l.estimate.weeks.min}–${l.estimate.weeks.max} нед.`);
    if (l.slot) rows.push(`Замер: ${fmtDate(l.slot.date)}, ${l.slot.time}`);
    if (isHot(l)) rows.push('Горячая: полный расчёт + замер');
    return rows.join('\n');
  },

  exportCsv(): Promise<string> {
    return call(() => {
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const head = ['№', 'Создана', 'Имя', 'Телефон', 'Статус', 'Источник', 'Горячая', 'Дом', 'Комнат', 'Санузлов', 'Площадь', 'Тип', 'Уровень', 'Опции', 'Смета, ₽', '₽/м²', 'Срок, нед', 'Замер', 'Заметки'];
      const rows = [...read('leads')].sort((a, b) => b.number - a.number).map((l) => [
        l.number, new Date(l.createdAt).toLocaleString('ru-RU'), l.name, l.phone, STATUS_LABELS[l.status], SOURCE_LABELS[l.source],
        isHot(l) ? 'да' : '',
        l.params ? HOUSE_TYPES.find((h) => h.id === l.params!.house)?.name : '', l.params?.rooms ?? '', l.params?.bathrooms ?? '',
        l.params?.area ?? '', l.params ? RENOVATION_TYPES.find((t) => t.id === l.params!.type)?.name : '',
        l.params ? BUDGET_LEVELS.find((b) => b.id === l.params!.level)?.name : '',
        l.params?.options.map((o) => OPTIONS.find((x) => x.id === o)?.name).join(', ') ?? '',
        l.estimate?.total ?? '', l.estimate?.perM2 ?? '', l.estimate ? `${l.estimate.weeks.min}–${l.estimate.weeks.max}` : '',
        l.slot ? `${l.slot.date} ${l.slot.time}` : '', l.notes.map((n) => n.text).join(' | '),
      ]);
      return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
    });
  },
};
