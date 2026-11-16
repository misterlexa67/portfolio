import type {
  Booking, CabinetClient, CalcOrigin, CalcParams, FaqItem, Lead, PriceSettings, Project,
  ScheduleSettings, SiteTexts, SlotException,
} from './types';
import { SEED_PRICES } from './seed/catalog';
import {
  SEED_FAQ, SEED_GUARANTEES, SEED_SCHEDULE, SEED_TEXTS,
  seedCabinet, seedExceptions, seedLeads, seedProjects,
} from './seed/content';

/* «База данных» демо: localStorage с запасным хранением в памяти.
   Каждая коллекция — отдельный ключ. Все обращения к localStorage — в try/catch. */

export interface Collections {
  settings: PriceSettings;
  schedule: ScheduleSettings;
  exceptions: SlotException[];
  bookings: Booking[];
  leads: Lead[];
  projects: Project[];
  faq: FaqItem[];
  texts: SiteTexts;
  cabinet: CabinetClient;
  meta: { seededAt: string; leadCounter: number };
  draft: { params: CalcParams; origin: CalcOrigin; savedAt: string } | null;
  session: { admin: boolean; client: boolean };
}
export type Key = keyof Collections;

const PREFIX = 'metr-v2:';
const memory = new Map<Key, unknown>();
const listeners = new Set<(key: Key) => void>();

function seedFor<K extends Key>(key: K): Collections[K] {
  const now = new Date();
  const map: { [P in Key]: () => Collections[P] } = {
    settings: () => SEED_PRICES,
    schedule: () => SEED_SCHEDULE,
    exceptions: () => seedExceptions(now),
    bookings: () => seedLeads(now).bookings,
    leads: () => seedLeads(now).leads,
    projects: () => seedProjects(),
    faq: () => [...SEED_FAQ, ...SEED_GUARANTEES],
    texts: () => SEED_TEXTS,
    cabinet: () => seedCabinet(now),
    meta: () => ({ seededAt: now.toISOString(), leadCounter: 101 }),
    draft: () => null,
    session: () => ({ admin: false, client: false }),
  };
  return JSON.parse(JSON.stringify(map[key]()));
}

function readRaw(key: Key): unknown | undefined {
  try {
    const s = window.localStorage.getItem(PREFIX + key);
    return s == null ? undefined : JSON.parse(s);
  } catch {
    return undefined;
  }
}

/** Читает коллекцию. fresh=true — мимо кэша (нужно для атомарной брони). */
export function read<K extends Key>(key: K, fresh = false): Collections[K] {
  if (!fresh && memory.has(key)) return memory.get(key) as Collections[K];
  let value = typeof window !== 'undefined' ? readRaw(key) : undefined;
  if (value === undefined) {
    value = memory.has(key) ? memory.get(key) : seedFor(key);
    // заявки и брони сидим вместе, чтобы ссылки совпадали
    if ((key === 'leads' || key === 'bookings') && !memory.has(key)) {
      const pair = key === 'leads' ? 'bookings' : 'leads';
      if (readRaw(pair) === undefined && !memory.has(pair)) persist(pair, seedFor(pair));
    }
    persist(key, value as Collections[K]);
  }
  memory.set(key, value);
  return value as Collections[K];
}

function persist<K extends Key>(key: K, value: Collections[K]) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* приватный режим или переполнение — остаёмся в памяти */
  }
}

export function write<K extends Key>(key: K, value: Collections[K]) {
  persist(key, value);
  listeners.forEach((fn) => fn(key));
}

export function subscribe(fn: (key: Key) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Сброс к демо-данным (кнопка в админке). */
export function resetAll() {
  const keys: Key[] = ['settings', 'schedule', 'exceptions', 'bookings', 'leads', 'projects', 'faq', 'texts', 'cabinet', 'meta'];
  keys.forEach((k) => {
    memory.delete(k);
    try { window.localStorage.removeItem(PREFIX + k); } catch { /* ignore */ }
  });
  keys.forEach((k) => write(k, read(k)));
}

// Изменения из другой вкладки (админка открыта рядом с сайтом) — сразу на экран.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length) as Key;
    memory.delete(key);
    listeners.forEach((fn) => fn(key));
  });
}
