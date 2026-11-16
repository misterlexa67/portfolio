import { computeEstimate } from './pricing';
import { snapshot } from './estimates';
import { addDays, isoDate } from './seed/content';
import { read, write } from './store';
import { call, exclusive, uid } from './transport';
import { normalizeName, normalizePhone, requireConsent } from './validate';
import type {
  Booking, BookingConfirmation, BookingRequest, DaySlots, Lead, ScheduleSettings, SlotException, SlotState,
} from './types';
import { ApiError } from './types';

/* Слоты замера. По умолчанию открыты по рабочим часам; владелец закрывает исключения.
   Бронь атомарна: перечитываем хранилище мимо кэша, проверяем и пишем в одной синхронной секции,
   плюс ключ идемпотентности — повторное нажатие не создаёт вторую бронь. */

const parseDate = (date: string, time = '00:00') => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

export function dayInfo(
  date: string, schedule: ScheduleSettings, exceptions: SlotException[], bookings: Booking[], now: Date,
): DaySlots {
  const wd = parseDate(date).getDay();
  const dayEx = exceptions.find((e) => e.date === date && !e.time);
  const workday = dayEx ? dayEx.kind === 'open' : schedule.workDays.includes(wd);
  const earliest = now.getTime() + schedule.minLeadHours * 3600_000;
  const slots = schedule.times.map((time) => {
    const booked = bookings.find((b) => b.date === date && b.time === time);
    if (booked) return { time, state: 'booked' as SlotState, leadId: booked.leadId };
    const slotEx = exceptions.find((e) => e.date === date && e.time === time);
    let state: SlotState = workday ? 'available' : 'closed';
    if (slotEx) state = slotEx.kind === 'open' ? 'available' : 'closed';
    if (parseDate(date, time).getTime() < earliest) state = 'closed';
    return { time, state };
  });
  return { date, workday, slots };
}

function calendar(from: Date, days: number, fresh = false): DaySlots[] {
  const schedule = read('schedule', fresh);
  const exceptions = read('exceptions', fresh);
  const bookings = read('bookings', fresh);
  const now = new Date();
  return Array.from({ length: days }, (_, i) => dayInfo(isoDate(addDays(from, i)), schedule, exceptions, bookings, now));
}

function nearestFrom(days: DaySlots[]): { date: string; time: string } | null {
  for (const d of days) {
    const s = d.slots.find((x) => x.state === 'available');
    if (s) return { date: d.date, time: s.time };
  }
  return null;
}

export const slots = {
  getCalendar(days?: number): Promise<DaySlots[]> {
    return call(() => calendar(new Date(), days ?? read('schedule').horizonDays));
  },

  nearest(): Promise<{ date: string; time: string } | null> {
    return call(() => nearestFrom(calendar(new Date(), read('schedule').horizonDays)), [80, 160]);
  },

  /** validate → re-check → atomic book → lead → confirmation */
  book(req: BookingRequest): Promise<BookingConfirmation> {
    return call(() => exclusive(() => {
      // 1. проверка ввода
      const name = normalizeName(req.name);
      const phone = normalizePhone(req.phone);
      requireConsent(req.consent);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date) || !/^\d{2}:\d{2}$/.test(req.time)) {
        throw new ApiError('validation', 'Выберите день и время замера');
      }

      // 2. идемпотентность: тот же ключ — та же бронь
      const bookings = read('bookings', true);
      const leads = read('leads', true);
      const same = bookings.find((b) => b.idempotencyKey === req.idempotencyKey);
      if (same) {
        const lead = leads.find((l) => l.id === same.leadId);
        if (lead) return { booking: same, lead };
      }

      // 3. повторная проверка слота по свежим данным
      const day = dayInfo(req.date, read('schedule', true), read('exceptions', true), bookings, new Date());
      const slot = day.slots.find((s) => s.time === req.time);
      if (!slot || slot.state !== 'available') {
        const nearest = nearestFrom(calendar(new Date(), read('schedule').horizonDays, true));
        const code = slot?.state === 'booked' ? 'slot_taken' : 'slot_closed';
        throw new ApiError(
          code,
          slot?.state === 'booked'
            ? 'Это время только что заняли. Мы подобрали ближайшее свободное.'
            : 'На это время замер уже недоступен. Мы подобрали ближайшее свободное.',
          'slot',
          { nearest },
        );
      }

      // 4. атомарная запись брони и заявки
      const meta = read('meta', true);
      const now = new Date().toISOString();
      const leadId = uid('ld');
      const booking: Booking = { id: uid('bk'), date: req.date, time: req.time, leadId, idempotencyKey: req.idempotencyKey, createdAt: now };
      let estimate;
      if (req.params) estimate = snapshot(computeEstimate(req.params, read('settings', true)));
      const lead: Lead = {
        id: leadId, number: meta.leadCounter + 1, createdAt: now, updatedAt: now,
        name, phone, source: req.source ?? 'booking', channel: 'booking', status: 'measurement_booked',
        params: req.params, estimate, slot: { date: req.date, time: req.time, bookingId: booking.id },
        notes: [], comment: req.comment?.slice(0, 500),
      };
      write('bookings', [...bookings, booking]);
      write('leads', [lead, ...leads]);
      write('meta', { ...meta, leadCounter: meta.leadCounter + 1 });
      return { booking, lead };
    }), [350, 650]);
  },

  /* ---------- админка ---------- */

  getSchedule(): Promise<ScheduleSettings> {
    return call(() => read('schedule'));
  },

  saveSchedule(next: ScheduleSettings): Promise<ScheduleSettings> {
    return call(() => {
      const times = [...new Set(next.times.filter((t) => /^\d{2}:\d{2}$/.test(t)))].sort();
      if (!times.length) throw new ApiError('validation', 'Нужно хотя бы одно время замера');
      if (!next.workDays.length) throw new ApiError('validation', 'Отметьте хотя бы один рабочий день');
      const v: ScheduleSettings = {
        ...next, times,
        horizonDays: Math.min(60, Math.max(7, Math.round(next.horizonDays))),
        minLeadHours: Math.min(72, Math.max(0, Math.round(next.minLeadHours))),
      };
      write('schedule', v);
      return v;
    });
  },

  /** Закрыть или открыть весь день. */
  setDay(date: string, open: boolean, reason?: string): Promise<void> {
    return call(() => {
      const schedule = read('schedule');
      const ex = read('exceptions').filter((e) => !(e.date === date && !e.time));
      const isWork = schedule.workDays.includes(parseDate(date).getDay());
      if (!open && read('bookings').some((b) => b.date === date)) {
        throw new ApiError('validation', 'В этот день уже есть записи. Сначала перенесите или отмените их.');
      }
      if (open !== isWork) ex.push({ id: uid('ex'), date, kind: open ? 'open' : 'closed', reason });
      // при открытии дня снимаем точечные закрытия
      write('exceptions', open ? ex.filter((e) => !(e.date === date && e.kind === 'closed')) : ex);
    });
  },

  /** Закрыть или открыть один слот. */
  setSlot(date: string, time: string, open: boolean): Promise<void> {
    return call(() => {
      if (!open && read('bookings').some((b) => b.date === date && b.time === time)) {
        throw new ApiError('slot_taken', 'На это время уже записан клиент');
      }
      const ex = read('exceptions').filter((e) => !(e.date === date && e.time === time));
      const day = dayInfo(date, read('schedule'), ex, [], new Date(0));
      const base = day.slots.find((s) => s.time === time)?.state === 'available';
      if (open !== base) ex.push({ id: uid('ex'), date, time, kind: open ? 'open' : 'closed' });
      write('exceptions', ex);
    });
  },

  /** Перенос замера клиентом: атомарно занимаем новый слот и освобождаем старый. */
  reschedule(leadId: string, date: string, time: string): Promise<BookingConfirmation> {
    return call(() => exclusive(() => {
      const bookings = read('bookings', true);
      const leads = read('leads', true);
      const cur = bookings.find((b) => b.leadId === leadId);
      const lead = leads.find((l) => l.id === leadId);
      if (!cur || !lead) throw new ApiError('not_found', 'Запись не найдена — возможно, её уже отменили');
      if (cur.date === date && cur.time === time) return { booking: cur, lead };
      const others = bookings.filter((b) => b.leadId !== leadId);
      const day = dayInfo(date, read('schedule', true), read('exceptions', true), others, new Date());
      const slot = day.slots.find((x) => x.time === time);
      if (!slot || slot.state !== 'available') {
        const nearest = nearestFrom(calendar(new Date(), read('schedule').horizonDays, true));
        throw new ApiError(slot?.state === 'booked' ? 'slot_taken' : 'slot_closed', 'Это время уже занято. Выберите другое.', 'slot', { nearest });
      }
      const booking = { ...cur, date, time };
      const now = new Date().toISOString();
      const nextLead = { ...lead, slot: { date, time, bookingId: booking.id }, updatedAt: now, notes: [...lead.notes, { id: uid('n'), at: now, text: `Клиент перенёс замер с ${cur.date} ${cur.time} на ${date} ${time}` }] };
      write('bookings', [...others, booking]);
      write('leads', leads.map((l) => (l.id === leadId ? nextLead : l)));
      return { booking, lead: nextLead };
    }), [300, 550]);
  },

  /** Отмена замера клиентом: слот освобождается, заявка помечается. */
  clientCancel(leadId: string): Promise<void> {
    return call(() => exclusive(() => {
      const now = new Date().toISOString();
      write('bookings', read('bookings', true).filter((b) => b.leadId !== leadId));
      write('leads', read('leads', true).map((l) => (l.id === leadId
        ? { ...l, slot: undefined, status: 'lost' as const, updatedAt: now, notes: [...l.notes, { id: uid('n'), at: now, text: 'Клиент отменил замер на сайте' }] }
        : l)));
    }), [250, 450]);
  },

  cancelBooking(leadId: string): Promise<void> {
    return call(() => {
      write('bookings', read('bookings', true).filter((b) => b.leadId !== leadId));
      write('leads', read('leads', true).map((l) => (l.id === leadId
        ? { ...l, slot: undefined, status: l.status === 'measurement_booked' ? 'contacted' as const : l.status, updatedAt: new Date().toISOString() }
        : l)));
    });
  },
};
