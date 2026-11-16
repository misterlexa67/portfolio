// Модели данных. Сервисный слой (src/api) — единственный источник правды:
// UI получает отсюда готовые цены, итоги, статусы и никогда не считает деньги сам.

export type ID = string;
export type Rub = number; // целые рубли

export interface Point { x: number; y: number }

/* ---------- Каталог ---------- */

export interface Category { id: ID; name: string; image: string }

export interface OpenHours { open: string; close: string } // "HH:MM", close может быть "24:00"

export type Cover =
  | { kind: 'photo'; src: string; position?: string }
  | { kind: 'still'; tint: string; images: string[] };

export interface MenuSection { id: ID; name: string }

export interface Restaurant {
  id: ID;
  name: string;
  tagline: string;
  categoryIds: ID[];
  rating: number;
  ratingCount: number;
  cookMinutes: number;      // среднее время приготовления
  baseDeliveryFee: Rub;     // базовая доставка; итог = база + надбавка зоны
  minOrder: Rub;
  hours: OpenHours;
  location: Point;
  address: string;
  cover: Cover;
  sections: MenuSection[];
  enabled: boolean;
  sort: number;
}

export interface AddonOption { id: ID; name: string; price: Rub }
export interface AddonGroup {
  id: ID;
  name: string;
  kind: 'single' | 'multi';
  required: boolean;
  max?: number;
  options: AddonOption[];
}

export type DishTag = 'hit' | 'new' | 'spicy' | 'veg';

export interface Dish {
  id: ID;
  restaurantId: ID;
  sectionId: ID;
  name: string;
  description: string;
  composition: string;
  price: Rub;
  oldPrice: Rub | null;
  weight: number;
  unit: 'г' | 'мл' | 'шт';
  calories: number;
  image: string;
  available: boolean;
  tags: DishTag[];
  addonGroups: AddonGroup[];
  sort: number;
}

/* ---------- Деньги и правила ---------- */

export interface Zone {
  id: ID;
  name: string;
  description: string;
  surcharge: Rub;       // надбавка к базовой доставке ресторана
  extraMinutes: number;
  polygon: Point[];
  enabled: boolean;
  sort: number;         // меньше — приоритетнее при пересечении
}

export interface PromoCode {
  id: ID;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  minSubtotal: Rub;
  maxDiscount: Rub | null;
  description: string;
  enabled: boolean;
}

export interface Settings {
  serviceFee: Rub;
  startingBalance: Rub;
  demoSpeed: number;        // множитель скорости симуляции заказа
  simulateErrors: boolean;  // имитация сбоев сети для проверки состояний ошибок
  adminPin: string;
}

/* ---------- Пользователь ---------- */

export interface AddressDetails { entrance: string; floor: string; apartment: string; comment: string }

export interface Address {
  id: ID;
  label: string;         // «Дом», «Работа» или пусто
  street: string;
  district: string;
  details: AddressDetails;
  point: Point;
}

export interface Profile {
  addresses: Address[];
  selectedAddressId: ID | null;
  favoriteRestaurants: ID[];
  favoriteDishes: ID[];
  recentSearches: string[];
}

export type TxnKind = 'welcome' | 'topup' | 'order' | 'tip' | 'refund';
export interface Txn { id: ID; kind: TxnKind; amount: Rub; at: number; title: string; orderId?: ID }
export interface Wallet { balance: Rub; transactions: Txn[] }

/* ---------- Корзина ---------- */

export interface CartLine { id: ID; dishId: ID; qty: number; optionIds: ID[] }
export interface Cart {
  restaurantId: ID | null;
  lines: CartLine[];
  cutlery: number;
  comment: string;
  promoCode: string | null;
  updatedAt: number;
}

export interface QuoteLine {
  lineId: ID;
  dishId: ID;
  name: string;
  image: string;
  qty: number;
  unitPrice: Rub;
  total: Rub;
  options: string[];
  available: boolean;
  weight: string;
}

export interface Totals {
  items: Rub;
  delivery: Rub;
  service: Rub;
  discount: Rub;
  total: Rub;
}

export type BlockerCode =
  | 'empty' | 'min_order' | 'closed' | 'unavailable' | 'no_address' | 'out_of_zone' | 'restaurant_off';

export interface Blocker { code: BlockerCode; message: string }

export interface Quote {
  restaurant: { id: ID; name: string; isOpen: boolean; opensAt: string | null; hours: OpenHours } | null;
  lines: QuoteLine[];
  count: number;
  totals: Totals;
  minOrder: Rub;
  minOrderLeft: Rub;
  promo: { code: string; applied: boolean; message: string; discount: Rub } | null;
  zone: { id: ID; name: string } | null;
  eta: { min: number; max: number } | null;
  cutlery: number;
  comment: string;
  blockers: Blocker[];
  canCheckout: boolean;
}

/* ---------- Заказы ---------- */

export const ORDER_STATUSES = [
  'created', 'paid_demo', 'cooking', 'picked_up', 'on_the_way', 'at_door', 'delivered', 'cancelled',
] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export interface OrderLine { dishId: ID; name: string; image: string; qty: number; unitPrice: Rub; total: Rub; options: string[]; optionIds: ID[] }

export type Slot = { kind: 'asap' } | { kind: 'time'; at: number };

export interface Courier { name: string; rating: number; vehicle: string; phoneMasked: string }

export interface Order {
  id: ID;
  number: string;
  idempotencyKey: string;
  createdAt: number;
  customer: { own: boolean; name: string };
  restaurant: { id: ID; name: string; address: string; location: Point; image: string };
  lines: OrderLine[];
  totals: Totals;
  promoCode: string | null;
  address: Address;
  zone: { id: ID; name: string };
  slot: Slot;
  cutlery: number;
  comment: string;
  status: OrderStatus;
  history: { status: OrderStatus; at: number }[];
  stageStartedAt: number;
  route: Point[];
  courier: Courier;
  eta: { min: number; max: number };
  rating: { stars: number; comment: string; at: number } | null;
  tip: Rub;
  refunded: boolean;
}

/** Срез заказа для экрана отслеживания — всё, что нужно для плавной анимации. */
export interface Tracking {
  status: OrderStatus;
  stageStartedAt: number;
  stageEndsAt: number | null;
  serverNow: number;
  minutesLeft: number | null;
  startsAt: number | null;   // для заказа ко времени
}

/* ---------- Ответы каталога ---------- */

export interface RestaurantCard {
  id: ID;
  name: string;
  tagline: string;
  cover: Cover;
  rating: number;
  ratingCount: number;
  categoryIds: ID[];
  minOrder: Rub;
  deliveryFee: Rub | null;
  eta: { min: number; max: number } | null;
  distanceKm: number | null;
  isOpen: boolean;
  opensAt: string | null;
  hasDiscount: boolean;
  favorite: boolean;
  inZone: boolean;
}

export type SortKey = 'recommended' | 'rating' | 'time' | 'fee';
export interface RestaurantFilters {
  category?: ID | null;
  collection?: 'fast' | 'near' | 'discount' | null;
  minRating?: number | null;
  maxMinutes?: number | null;
  maxFee?: number | null;
  freeDelivery?: boolean;
  sort?: SortKey;
}

export interface SearchResult {
  restaurants: RestaurantCard[];
  dishes: { dish: Dish; restaurantName: string; restaurantOpen: boolean }[];
}

export interface DishQuote { unitPrice: Rub; total: Rub; valid: boolean; message: string | null }

/* ---------- Админ ---------- */

export interface AdminStats {
  ordersToday: number;
  revenueToday: Rub;
  averageCheck: Rub;
  activeOrders: number;
  byStatus: Record<OrderStatus, number>;
  hourly: { hour: number; orders: number; revenue: Rub }[];
  topDishes: { name: string; qty: number }[];
}
