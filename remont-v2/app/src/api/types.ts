/* Модели данных «Метр». Это контракт между UI и сервисным слоем:
   при переходе на настоящий бэкенд меняется только реализация api/, не UI. */

export type HouseTypeId = 'khrushchevka' | 'brezhnevka' | 'stalinka' | 'panel90' | 'novostroyka';
export type RenovationType = 'cosmetic' | 'capital' | 'designer';
export type BudgetLevel = 'economy' | 'standard' | 'premium';
export type OptionId = 'demolition' | 'electrics' | 'warmFloor' | 'conditioner' | 'designProject';
export type RoomKind =
  | 'living' | 'bedroom' | 'kitchen' | 'bath' | 'wc' | 'hall' | 'storage' | 'balcony'
  | 'study' | 'wardrobe' | 'laundry' | 'gym' | 'cinema' | 'library';
export type DistrictId =
  | 'nizhegorodsky' | 'sovetsky' | 'priroksky' | 'kanavinsky'
  | 'moskovsky' | 'sormovsky' | 'leninsky' | 'avtozavodsky';

/* ---------- Каталог ---------- */

export interface HouseType {
  id: HouseTypeId;
  name: string;
  years: string;
  note: string;          // чем дом особенный для ремонта
  ceiling: number;       // высота потолка, м
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface PlanRoom {
  id: string;
  kind: RoomKind;
  name: string;
  rects: Rect[];         // метры, x вправо, y вниз (вид сверху)
  area: number;          // м², считается из rects
  /** функциональная комната, выделенная из слишком большой (кабинет, гардеробная…) — не входит в число жилых комнат */
  extra?: boolean;
}

export interface FloorPlan {
  id: string;            // `${house}-${rooms}`
  house: HouseTypeId;
  rooms: number;         // жилых комнат
  bathrooms: number;
  area: number;          // общая площадь без балкона, м²
  width: number;
  depth: number;
  items: PlanRoom[];
  scaled?: boolean;      // планировка подогнана под введённую площадь
}

export interface OptionDef {
  id: OptionId;
  name: string;
  hint: string;
  unit: 'perM2' | 'fixed' | 'perRoom';
  stage: StageId;
  weeks: number;         // сколько добавляет к сроку
}

/* ---------- Цены (всё редактируется в админке) ---------- */

export type StageId = 'design' | 'rough' | 'electrics' | 'plumbing' | 'finishing' | 'materials' | 'debris';

export interface PriceSettings {
  version: number;                                   // растёт при каждом сохранении
  updatedAt: string;
  worksPerM2: Record<RenovationType, number>;        // работы, ₽/м²
  materialsPerM2: Record<RenovationType, number>;    // черновые+чистовые материалы, ₽/м² (уровень «Стандарт»)
  houseCoef: Record<HouseTypeId, number>;            // коэффициент сложности дома (к работам)
  budget: Record<BudgetLevel, { works: number; materials: number }>;
  bathroom: Record<RenovationType, { works: number; materials: number }>; // за каждый санузел
  perRoom: number;                                   // двери, проёмы, откосы — за жилую комнату
  debrisPerM2: number;                               // вывоз мусора
  options: Record<OptionId, number>;                 // цена по unit из OptionDef
  workShares: Record<RenovationType, Record<'rough' | 'electrics' | 'plumbing' | 'finishing', number>>;
  weeks: Record<RenovationType, { base: number; perM2: number }>;
  payments: PaymentStageDef[];
  minArea: number;
  maxArea: number;
}

export interface PaymentStageDef { id: string; label: string; after: string; percent: number }

/* ---------- Расчёт ---------- */

export type CalcOrigin = 'calculator' | 'house_picker' | 'map' | 'share' | 'booking';

export interface CalcParams {
  area: number;
  house: HouseTypeId;
  rooms: number;          // 1–4
  bathrooms: number;      // 1–3
  type: RenovationType;
  level: BudgetLevel;
  options: OptionId[];
  planId?: string;        // типовая планировка, если выбрана в «Выберите ваш дом»
}

/** Слой, к которому относится позиция сметы (для чипов калькулятора и подсветки изометрии). */
export type CostLayer =
  | 'screed' | 'partitions' | 'electrics' | 'warmFloor' | 'walls' | 'floor' | 'light' | 'conditioner'
  | 'demolition' | 'plumbing' | 'design' | 'debris';

/** Позиция сметы с объёмом: «Штукатурка стен — 142 м²». */
export interface EstimateItem { id: string; title: string; qty: number; unit: string; amount: number; layer: CostLayer }

export interface EstimateLine {
  id: StageId;
  title: string;
  amount: number;
  share: number;          // 0..1
  includes: string[];     // «что входит» — коротко
  items: EstimateItem[];  // «что входит» — с объёмами; сумма позиций = amount
  kind: 'works' | 'materials' | 'service';
}

export interface PaymentStep {
  id: string; label: string; after: string; percent: number; amount: number;
  dayOffset: number;      // через сколько дней от начала ремонта примерно наступает платёж
  ready: string;          // что будет готово к этому моменту
  layers: CostLayer[];    // какие слои готовы к этому платежу (для подсветки изометрии)
}

export interface IsoLayers {
  screed: boolean; partitions: boolean; electrics: boolean; warmFloor: boolean;
  walls: boolean; floor: boolean; light: boolean; furniture: boolean; conditioner: boolean;
}

export interface Estimate {
  params: CalcParams;
  priceVersion: number;
  createdAt: string;
  lines: EstimateLine[];
  worksTotal: number;
  materialsTotal: number;
  total: number;
  perM2: number;
  weeks: { min: number; max: number };
  payments: PaymentStep[];
  layers: IsoLayers;
  houseCoef: number;
  layerCosts: Partial<Record<CostLayer, number>>;   // вклад слоя в цену: работы + материалы
  volumes: { wallArea: number; floorArea: number; tileArea: number; sockets: number; lights: number; cable: number; doors: number };
}

/* ---------- Заявки ---------- */

export const LEAD_STATUSES = [
  'new', 'contacted', 'measurement_booked', 'estimate_sent', 'contract', 'in_progress', 'done', 'lost',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadChannel = 'booking' | 'telegram' | 'callback';

export interface LeadNote { id: string; at: string; text: string }

export interface EstimateSnapshot {
  total: number; perM2: number; weeks: { min: number; max: number };
  worksTotal: number; materialsTotal: number; priceVersion: number;
  lines: { id: StageId; title: string; amount: number }[];
}

export interface Lead {
  id: string;
  number: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  phone: string;
  source: CalcOrigin;
  channel: LeadChannel;
  status: LeadStatus;
  params?: CalcParams;
  estimate?: EstimateSnapshot;
  slot?: { date: string; time: string; bookingId: string };
  notes: LeadNote[];
  comment?: string;
}

/* ---------- Слоты замера ---------- */

export type SlotState = 'available' | 'booked' | 'closed';

export interface ScheduleSettings {
  workDays: number[];     // 0 — вс, 1 — пн … 6 — сб
  times: string[];        // начала слотов, «HH:MM»
  horizonDays: number;
  minLeadHours: number;   // нельзя записаться ближе, чем за N часов
}

export interface SlotException { id: string; date: string; time?: string; kind: 'closed' | 'open'; reason?: string }

export interface Booking { id: string; date: string; time: string; leadId: string; idempotencyKey: string; createdAt: string }

export interface DaySlots { date: string; workday: boolean; slots: { time: string; state: SlotState; leadId?: string }[] }

export interface BookingRequest {
  date: string; time: string;
  name: string; phone: string; consent: boolean;
  idempotencyKey: string;
  params?: CalcParams;
  source?: CalcOrigin;
  comment?: string;
}

export interface BookingConfirmation { booking: Booking; lead: Lead }

/* ---------- Объекты на карте ---------- */

export interface Project {
  id: string;
  title: string;
  district: DistrictId;
  street: string;
  house: HouseTypeId;
  rooms: number;
  bathrooms: number;
  area: number;
  weeks: number;
  price: number;
  type: RenovationType;
  level: BudgetLevel;
  options: OptionId[];
  year: number;
  x: number;              // координаты на схеме карты 0..1000 × 0..800
  y: number;
  enabled: boolean;
  order: number;
  note: string;
}

/* ---------- Контент ---------- */

export interface FaqItem { id: string; group: 'faq' | 'guarantee'; q: string; a: string; enabled: boolean; order: number }

export interface SiteTexts {
  heroTitle: string;
  heroAccent: string;     // часть заголовка, выделенная курсивом и цветом
  heroLead: string;
  promises: { title: string; text: string }[];
  fixedPromise: string;
  contacts: {
    phone: string; email: string; address: string; hours: string;
    telegram: string; max: string; whatsapp: string;
  };
}

/* ---------- Кабинет клиента ---------- */

export type CabinetScene = 'demolition' | 'screed' | 'electrics' | 'plaster' | 'tile' | 'paint' | 'floor' | 'kitchen';

export interface CabinetStage { id: string; title: string; start: string; end: string; status: 'done' | 'current' | 'next'; progress: number }
export interface CabinetPhoto { id: string; stageId: string; date: string; caption: string; scene: CabinetScene }
export interface CabinetPayment { id: string; label: string; amount: number; due: string; paid: boolean }
export interface CabinetUpdate { id: string; at: string; author: string; text: string; photoId?: string }

export interface CabinetClient {
  clientName: string;
  address: string;
  district: DistrictId;
  house: HouseTypeId;
  rooms: number;
  area: number;
  type: RenovationType;
  level: BudgetLevel;
  contractTotal: number;
  startDate: string;
  planEnd: string;
  foreman: { name: string; phone: string };
  stages: CabinetStage[];
  photos: CabinetPhoto[];
  payments: CabinetPayment[];
  updates: CabinetUpdate[];
}

/* ---------- Ошибки ---------- */

export type ApiErrorCode =
  | 'validation' | 'slot_taken' | 'slot_closed' | 'slot_past' | 'not_found'
  | 'area_range' | 'consent' | 'phone' | 'name' | 'pin' | 'payments_sum' | 'storage';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,                       // человеческий текст на русском, его можно показывать
    public field?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
