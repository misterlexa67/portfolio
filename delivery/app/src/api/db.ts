// «База данных» демо-бэкенда: один JSON-документ в localStorage.
// Чтение отдаёт копии (UI не может случайно изменить состояние),
// запись атомарна: изменения применяются к копии и сохраняются целиком либо не применяются вовсе.
import type {
  Cart, Category, Dish, Order, Profile, PromoCode, Restaurant, Settings, Wallet, Zone,
} from './types';
import * as seed from './seed';
import { storage } from './storage';
import { emit, type Topic } from './events';
import { now, mskDayStart } from './time';
import { deliveryFor, resolveOptions, unitPrice } from './pricing';

export const DB_KEY = 'dostavka-est:db';
const VERSION = 4;

export interface DB {
  version: number;
  seededAt: number;
  settings: Settings;
  categories: Category[];
  restaurants: Restaurant[];
  dishes: Dish[];
  zones: Zone[];
  promos: PromoCode[];
  profile: Profile;
  wallet: Wallet;
  cart: Cart;
  orders: Order[];
  idempotency: Record<string, string>;
  orderSeq: number;
}

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

export const emptyCart = (): Cart => ({ restaurantId: null, lines: [], cutlery: 1, comment: '', promoCode: null, updatedAt: 0 });

let uid = 0;
export const newId = (prefix: string): string => {
  uid += 1;
  return `${prefix}-${Date.now().toString(36)}${uid.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
};

function demoOrders(db: DB): Order[] {
  // Несколько уже доставленных заказов других (вымышленных) клиентов за сегодня.
  const t = now();
  const out: Order[] = [];
  const startOfDay = mskDayStart(t);
  const hoursPassed = Math.max(1, Math.floor((t - startOfDay) / 3600000));
  const count = Math.min(14, 3 + hoursPassed);
  // неравномерно: обеденный и вечерний пики, как в жизни
  const GAPS = [18, 25, 40, 22, 15, 30, 75, 95, 35, 20, 15, 28, 60, 80];
  const scale = Math.min(1, Math.max(0.15, (t - startOfDay - 45 * 60000) / (GAPS.slice(0, count).reduce((a, b) => a + b, 0) * 60000)));
  const offsets: number[] = [];
  let acc = 45 * 60000;
  for (let k = 0; k < count; k++) { acc += GAPS[k] * 60000 * scale; offsets.push(acc); }
  const addresses = [
    { street: 'ул. Белинского, 61', point: { x: 650, y: 405 }, district: 'Нижегородский район' },
    { street: 'пр. Гагарина, 50', point: { x: 640, y: 560 }, district: 'Приокский район' },
    { street: 'Московское шоссе, 12', point: { x: 330, y: 290 }, district: 'Канавинский район' },
    { street: 'ул. Минина, 10', point: { x: 640, y: 292 }, district: 'Нижегородский район' },
    { street: 'ул. Ванеева, 110', point: { x: 760, y: 450 }, district: 'Советский район' },
    { street: 'пр. Ленина, 33', point: { x: 370, y: 460 }, district: 'Ленинский район' },
  ];
  for (let i = 0; i < count; i++) {
    const r = db.restaurants[(i * 5 + 2) % db.restaurants.length];
    const dishes = db.dishes.filter((d) => d.restaurantId === r.id);
    const picks = [dishes[i % dishes.length], dishes[(i * 3 + 1) % dishes.length]];
    const lines = picks.map((d, k) => {
      const optionIds = d.addonGroups.filter((gr) => gr.required).map((gr) => gr.options[0].id);
      const res = resolveOptions(d, optionIds);
      const price = unitPrice(d, res.options);
      const qty = k === 0 ? 1 + (i % 2) : 1;
      return { dishId: d.id, name: d.name, image: d.image, qty, unitPrice: price, total: price * qty, options: res.options.map((o) => o.name), optionIds };
    });
    let items = lines.reduce((s, l) => s + l.total, 0);
    if (items < r.minOrder) { lines[0].qty += 1; lines[0].total += lines[0].unitPrice; items += lines[0].unitPrice; }
    const a = addresses[i % addresses.length];
    const dlv = deliveryFor(db, r, a.point);
    if (!dlv) continue;
    const created = t - offsets[count - 1 - i];
    const totals = { items, delivery: dlv.fee, service: db.settings.serviceFee, discount: 0, total: items + dlv.fee + db.settings.serviceFee };
    db.orderSeq += 1;
    out.push({
      id: `o-demo-${i}`, number: String(db.orderSeq), idempotencyKey: `demo-${i}`, createdAt: created,
      customer: { own: false, name: seed.DEMO_CUSTOMERS[i % seed.DEMO_CUSTOMERS.length] },
      restaurant: { id: r.id, name: r.name, address: r.address, location: r.location, image: dishes[0]?.image ?? '' },
      lines, totals, promoCode: null,
      address: { id: `a-demo-${i}`, label: '', street: a.street, district: a.district, details: { entrance: '', floor: '', apartment: '', comment: '' }, point: a.point },
      zone: { id: dlv.zone.id, name: dlv.zone.name }, slot: { kind: 'asap' }, cutlery: 1, comment: '',
      status: 'delivered',
      history: [
        { status: 'created', at: created }, { status: 'paid_demo', at: created },
        { status: 'cooking', at: created + 60000 }, { status: 'picked_up', at: created + 15 * 60000 },
        { status: 'on_the_way', at: created + 17 * 60000 }, { status: 'at_door', at: created + 33 * 60000 },
        { status: 'delivered', at: created + 35 * 60000 },
      ],
      stageStartedAt: created + 35 * 60000, route: dlv.route,
      courier: seed.COURIERS[i % seed.COURIERS.length], eta: dlv.eta,
      rating: i % 3 === 0 ? { stars: 5, comment: '', at: created + 40 * 60000 } : null, tip: 0, refunded: false,
    });
  }
  return out;
}

export function createSeed(): DB {
  const t = now();
  const db: DB = {
    version: VERSION,
    seededAt: t,
    settings: clone(seed.SETTINGS),
    categories: clone(seed.CATEGORIES),
    restaurants: clone(seed.RESTAURANTS),
    dishes: clone(seed.DISHES),
    zones: clone(seed.ZONES),
    promos: clone(seed.PROMOS),
    profile: clone(seed.PROFILE),
    wallet: {
      balance: seed.SETTINGS.startingBalance,
      transactions: [{ id: 'txn-welcome', kind: 'welcome', amount: seed.SETTINGS.startingBalance, at: t, title: 'Приветственный демо-баланс' }],
    },
    cart: emptyCart(),
    orders: [],
    idempotency: {},
    orderSeq: 1040,
  };
  db.orders = demoOrders(db);
  return db;
}

let memory: DB | null = null;

function isValid(v: unknown): v is DB {
  const d = v as DB;
  return !!d && d.version === VERSION && Array.isArray(d.restaurants) && Array.isArray(d.dishes) && !!d.wallet && !!d.cart && !!d.profile;
}

function load(): DB {
  if (memory) return memory;
  const raw = storage.get(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValid(parsed)) { memory = parsed; return memory; }
    } catch { /* повреждённые данные — пересоздаём */ }
  }
  memory = createSeed();
  persist(memory);
  return memory;
}

function persist(db: DB): void {
  storage.set(DB_KEY, JSON.stringify(db));
}

/** Чтение: получает актуальное состояние, возвращает копию результата. */
export function read<T>(fn: (db: DB) => T): T {
  return clone(fn(load()));
}

/** Атомарная запись: при исключении состояние не меняется. */
export function write<T>(topics: Topic[], fn: (db: DB) => T): T {
  const draft = clone(load());
  const result = fn(draft);
  memory = draft;
  persist(draft);
  emit(...topics);
  return clone(result);
}

/**
 * Сброс демо-данных.
 * 'user' — данные покупателя (баланс по текущим настройкам, заказы, корзина, адреса); каталог владельца сохраняется.
 * 'all'  — полностью исходное состояние.
 */
export function resetAll(scope: 'user' | 'all' = 'user'): void {
  const fresh = createSeed();
  if (scope === 'user') {
    const cur = load();
    fresh.settings = cur.settings;
    fresh.restaurants = cur.restaurants;
    fresh.dishes = cur.dishes;
    fresh.zones = cur.zones;
    fresh.promos = cur.promos;
    fresh.categories = cur.categories;
    fresh.orderSeq = cur.orderSeq;
    fresh.orders = cur.orders.filter((o) => !o.customer.own);
    const start = cur.settings.startingBalance;
    fresh.wallet = { balance: start, transactions: [{ id: newId('txn'), kind: 'welcome', amount: start, at: now(), title: 'Приветственный демо-баланс' }] };
  }
  memory = fresh;
  persist(memory);
  emit();
}

/** Для тестов: начать с чистого листа. */
export function __resetForTests(): void {
  memory = null;
  storage.remove(DB_KEY);
}

// Синхронизация между вкладками: админка в одной вкладке — клиент в другой.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== DB_KEY) return;
    memory = null;
    emit();
  });
}
