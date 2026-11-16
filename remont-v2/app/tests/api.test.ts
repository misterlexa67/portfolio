import { describe, expect, it, beforeEach } from 'vitest';
import { api, decodeShare, encodeShare, ApiError, isHot } from '../src/api';
import type { CalcParams } from '../src/api';
import { computeEstimate } from '../src/api/pricing';
import { SEED_PRICES } from '../src/api/seed/catalog';
import { PLANS } from '../src/api/seed/plans';
import { resetAll } from '../src/api/store';

const P: CalcParams = { area: 54.5, house: 'brezhnevka', rooms: 2, bathrooms: 1, type: 'capital', level: 'standard', options: ['warmFloor'] };

beforeEach(() => resetAll());

describe('расчёт', () => {
  it('итог равен сумме строк, платежи сходятся до рубля', () => {
    const e = computeEstimate(P, SEED_PRICES);
    expect(e.total).toBe(e.lines.reduce((a, l) => a + l.amount, 0));
    expect(e.payments.reduce((a, p) => a + p.amount, 0)).toBe(e.total);
    expect(e.worksTotal + e.materialsTotal).toBe(e.total);
    expect(Math.abs(e.lines.reduce((a, l) => a + l.share, 0) - 1)).toBeLessThan(1e-9);
  });

  it('капитальный дороже косметического, премиум дороже эконома, старый фонд дороже новостройки', () => {
    const c = (p: Partial<CalcParams>) => computeEstimate({ ...P, ...p }, SEED_PRICES).total;
    expect(c({ type: 'capital' })).toBeGreaterThan(c({ type: 'cosmetic' }));
    expect(c({ level: 'premium' })).toBeGreaterThan(c({ level: 'economy' }));
    expect(c({ house: 'stalinka' })).toBeGreaterThan(c({ house: 'novostroyka' }));
    expect(c({ options: ['warmFloor', 'conditioner'] })).toBeGreaterThan(c({ options: ['warmFloor'] }));
  });

  it('реалистичный порядок цен для двушки', () => {
    const e = computeEstimate(P, SEED_PRICES);
    expect(e.total).toBeGreaterThan(1_000_000);
    expect(e.total).toBeLessThan(2_000_000);
    expect(e.weeks.min).toBeGreaterThanOrEqual(8);
  });

  it('площадь вне диапазона — человеческая ошибка в строгом режиме', async () => {
    await expect(api.estimates.calculate({ ...P, area: 5 }, { strict: true })).rejects.toMatchObject({ code: 'area_range' });
  });

  it('изменение цены в админке сразу меняет расчёт', async () => {
    const before = await api.estimates.calculate(P);
    const s = await api.estimates.getSettings();
    await api.estimates.saveSettings({ ...s, worksPerM2: { ...s.worksPerM2, capital: 14000 } });
    const after = await api.estimates.calculate(P);
    expect(after.total).toBeGreaterThan(before.total);
    expect(after.priceVersion).toBe(before.priceVersion + 1);
  });

  it('проценты платежей должны давать 100', async () => {
    const s = await api.estimates.getSettings();
    const bad = { ...s, payments: s.payments.map((p, i) => (i === 0 ? { ...p, percent: 50 } : p)) };
    await expect(api.estimates.saveSettings(bad)).rejects.toMatchObject({ code: 'payments_sum' });
  });
});

describe('планировки', () => {
  it('15 типовых планировок, площади реалистичны', () => {
    expect(PLANS).toHaveLength(15);
    for (const p of PLANS) {
      expect(p.area).toBeGreaterThan(25);
      expect(p.area).toBeLessThan(100);
      // комнаты внутри контура не выходят за него и не накладываются по площади
      const inside = p.items.filter((i) => i.kind !== 'balcony');
      expect(Math.abs(inside.reduce((a, i) => a + i.area, 0) - p.width * p.depth)).toBeLessThan(0.6);
    }
  });
  it('подгонка под площадь и 4 комнаты', () => {
    const plan = api.plans.forParams({ house: 'panel90', rooms: 4, bathrooms: 2, area: 90 });
    expect(Math.abs(plan.area - 90)).toBeLessThan(1);
    expect(plan.rooms).toBe(4);
    expect(plan.bathrooms).toBe(2);
  });
});

describe('слоты и бронь', () => {
  const req = async (key: string, phone = '+7 (900) 123-45-67') => {
    const near = await api.slots.nearest();
    return { date: near!.date, time: near!.time, name: 'Анна', phone, consent: true, idempotencyKey: key, params: P, source: 'calculator' as const };
  };

  it('двойная бронь невозможна: из двух одновременных заявок проходит одна', async () => {
    const r = await req('k1');
    const results = await Promise.allSettled([
      api.slots.book(r),
      api.slots.book({ ...r, idempotencyKey: 'k2', name: 'Борис' }),
    ]);
    const ok = results.filter((x) => x.status === 'fulfilled');
    const fail = results.filter((x) => x.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect((fail[0].reason as ApiError).code).toBe('slot_taken');
    expect((fail[0].reason as ApiError).extra?.nearest).toBeTruthy();
    const day = (await api.slots.getCalendar()).find((d) => d.date === r.date)!;
    expect(day.slots.find((s) => s.time === r.time)!.state).toBe('booked');
  });

  it('повтор с тем же ключом идемпотентности возвращает ту же бронь', async () => {
    const r = await req('same');
    const a = await api.slots.book(r);
    const b = await api.slots.book(r);
    expect(b.booking.id).toBe(a.booking.id);
    const all = await api.leads.list();
    expect(all.filter((l) => l.id === a.lead.id)).toHaveLength(1);
  });

  it('бронь создаёт горячую заявку со всеми параметрами', async () => {
    const r = await req('hot');
    const { lead } = await api.slots.book(r);
    expect(lead.status).toBe('measurement_booked');
    expect(lead.params?.area).toBe(54.5);
    expect(lead.estimate?.total).toBeGreaterThan(0);
    expect(isHot(lead)).toBe(true);
    const list = await api.leads.list();
    expect(isHot(list[0])).toBe(true);
  });

  it('ошибки ввода — понятные', async () => {
    const r = await req('bad');
    await expect(api.slots.book({ ...r, phone: '12345' })).rejects.toMatchObject({ code: 'phone' });
    await expect(api.slots.book({ ...r, consent: false })).rejects.toMatchObject({ code: 'consent' });
    await expect(api.slots.book({ ...r, name: ' ' })).rejects.toMatchObject({ code: 'name' });
  });

  it('закрытый владельцем слот недоступен', async () => {
    const near = await api.slots.nearest();
    await api.slots.setSlot(near!.date, near!.time, false);
    const r = await req('x');
    expect(r.date + r.time).not.toBe(near!.date + near!.time);
    await expect(api.slots.book({ ...r, date: near!.date, time: near!.time })).rejects.toMatchObject({ code: 'slot_closed' });
  });
});

describe('заявки', () => {
  it('смена статуса и заметки', async () => {
    const [first] = await api.leads.list();
    const l = await api.leads.updateStatus(first.id, 'contract');
    expect(l.status).toBe('contract');
    const n = await api.leads.addNote(first.id, 'Перезвонить вечером');
    expect(n.notes.at(-1)?.text).toBe('Перезвонить вечером');
  });
  it('CSV содержит заголовок и все заявки', async () => {
    const csv = await api.leads.exportCsv();
    const rows = csv.trim().split('\r\n');
    expect(rows[0]).toContain('Телефон');
    expect(rows.length).toBe((await api.leads.list()).length + 1);
  });
});

describe('ссылка «Поделиться»', () => {
  it('кодирует и восстанавливает расчёт один в один', () => {
    const e = computeEstimate({ ...P, options: ['demolition', 'warmFloor'], planId: 'brezhnevka-2' }, SEED_PRICES);
    const back = decodeShare('?' + encodeShare(e))!;
    expect(computeEstimate(back.params, SEED_PRICES).total).toBe(e.total);
    expect(back.total).toBe(e.total);
    expect(back.params.planId).toBe('brezhnevka-2');
  });
  it('мусор в ссылке не ломает сайт', () => {
    expect(decodeShare('?calc=1&a=abc')).toBeNull();
    expect(decodeShare('?foo=bar')).toBeNull();
  });
});

describe('v2: объёмы, слои, даты платежей', () => {
  it('позиции каждой строки сходятся с суммой строки до рубля, вклады слоёв — с итогом', () => {
    for (const type of ['cosmetic', 'capital', 'designer'] as const) {
      const e = computeEstimate({ ...P, type, options: ['demolition', 'electrics', 'warmFloor', 'conditioner', 'designProject'] }, SEED_PRICES);
      for (const l of e.lines) expect(l.items.reduce((a, x) => a + x.amount, 0)).toBe(l.amount);
      expect(Object.values(e.layerCosts).reduce((a, x) => a + (x ?? 0), 0)).toBe(e.total);
      expect(e.lines.every((l) => l.items.every((it) => it.qty > 0))).toBe(true);
    }
  });
  it('итог v2 совпадает с прежней формулой (ссылки v1 открываются с той же суммой)', () => {
    const e = computeEstimate(P, SEED_PRICES);
    expect(e.total).toBe(1499300);
  });
  it('даты платежей идут по порядку, у каждого есть «что готово»', () => {
    const e = computeEstimate(P, SEED_PRICES);
    const d = e.payments.map((p) => p.dayOffset);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(e.payments.every((p) => p.ready.length > 10)).toBe(true);
  });
  it('у каждой типовой планировки есть двери и входная дверь', () => {
    for (const p of PLANS) {
      const doors = api.plans.doors(p);
      expect(doors.length).toBeGreaterThan(1);
      expect(doors.some((d) => d.entrance)).toBe(true);
    }
  });
  it('площадь меняет пропорции квартиры', () => {
    const a = api.plans.forParams({ house: 'panel90', rooms: 2, bathrooms: 1, area: 45 });
    const b = api.plans.forParams({ house: 'panel90', rooms: 2, bathrooms: 1, area: 85 });
    expect(b.width / b.depth).toBeGreaterThan(a.width / a.depth * 1.1);
  });
});

describe('v2: перенос и отмена замера', () => {
  it('перенос занимает новый слот и освобождает старый, отмена освобождает слот', async () => {
    const cal = await api.slots.getCalendar();
    const free = cal.flatMap((d) => d.slots.filter((s) => s.state === 'available').map((s) => ({ date: d.date, time: s.time })));
    const { lead } = await api.slots.book({ ...free[0], name: 'Анна', phone: '+7 900 123-45-67', consent: true, idempotencyKey: 'mv' });
    await api.slots.reschedule(lead.id, free[1].date, free[1].time);
    let c = await api.slots.getCalendar();
    const st = (x: { date: string; time: string }) => c.find((d) => d.date === x.date)!.slots.find((s) => s.time === x.time)!.state;
    expect(st(free[0])).toBe('available');
    expect(st(free[1])).toBe('booked');
    await api.slots.clientCancel(lead.id);
    c = await api.slots.getCalendar();
    expect(st(free[1])).toBe('available');
    expect((await api.leads.get(lead.id)).status).toBe('lost');
  });
});
