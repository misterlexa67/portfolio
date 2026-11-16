import { computeEstimate } from '../pricing';
import type {
  Booking, CabinetClient, CalcParams, FaqItem, Lead, Project, ScheduleSettings, SiteTexts, SlotException,
} from '../types';
import { SEED_PRICES } from './catalog';

/* Демо-данные. Даты считаются от «сегодня», чтобы демо всегда выглядело живым. */

export const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const nextWorkday = (d: Date, n: number) => {
  let x = addDays(d, n);
  while (x.getDay() === 0) x = addDays(x, 1);
  return x;
};

export const SEED_TEXTS: SiteTexts = {
  heroTitle: 'Ремонт квартир в Нижнем по смете, которая',
  heroAccent: 'не растёт',
  heroLead: 'Считаем до рубля до начала работ, фиксируем цену в договоре и берём оплату по этапам. Каждый день — фотоотчёт в личном кабинете.',
  promises: [
    { title: 'Смета в договоре', text: 'Цена не изменится, даже если подорожают материалы.' },
    { title: 'Оплата по этапам', text: 'Аванс 20%. Остальное — после приёмки каждого этапа.' },
    { title: 'Гарантия 3 года', text: 'На все работы. Переделываем за свой счёт.' },
  ],
  fixedPromise: 'Смета фиксируется в договоре. Цена не изменится',
  contacts: {
    phone: '+7 (831) 555-01-01',
    email: 'hello@metr.demo',
    address: 'Студия на Ильинской (адрес вымышленный)',
    hours: 'Пн–Сб, 9:00–20:00',
    telegram: '@metr_nn_demo',
    max: 'metr_nn_demo',
    whatsapp: '+7 (900) 555-01-01',
  },
};

export const SEED_SCHEDULE: ScheduleSettings = {
  workDays: [1, 2, 3, 4, 5, 6],
  times: ['10:00', '12:00', '14:00', '16:00', '18:00'],
  horizonDays: 21,
  minLeadHours: 3,
};

export function seedExceptions(now: Date): SlotException[] {
  return [
    { id: 'ex-1', date: isoDate(nextWorkday(now, 4)), kind: 'closed', reason: 'Выезд всей команды на сдачу объекта' },
    { id: 'ex-2', date: isoDate(nextWorkday(now, 2)), time: '10:00', kind: 'closed', reason: 'Приёмка материалов' },
  ];
}

type P = Omit<Project, 'price' | 'order' | 'enabled' | 'id'>;
const PROJECTS: P[] = [
  { title: 'Двушка для молодой семьи', district: 'nizhegorodsky', street: 'район ул. Белинского', house: 'stalinka', rooms: 2, bathrooms: 1, area: 64, weeks: 14, type: 'capital', level: 'premium', options: ['demolition', 'electrics', 'warmFloor'], year: 2025, x: 760, y: 240, note: 'Сохранили лепнину, перекрытия усилили, проводку заменили полностью.' },
  { title: 'Квартира-мастерская', district: 'nizhegorodsky', street: 'район ул. Ильинской', house: 'stalinka', rooms: 3, bathrooms: 1, area: 92, weeks: 22, type: 'designer', level: 'premium', options: ['demolition', 'electrics', 'conditioner', 'designProject'], year: 2026, x: 880, y: 205, note: 'Высокие потолки обыграли светом в профилях, кухню вынесли в холл.' },
  { title: 'Однушка под сдачу', district: 'sovetsky', street: 'район ул. Бекетова', house: 'khrushchevka', rooms: 1, bathrooms: 1, area: 31, weeks: 6, type: 'cosmetic', level: 'economy', options: ['demolition'], year: 2025, x: 700, y: 430, note: 'Сделали за 6 недель, квартира сдана в аренду через 10 дней.' },
  { title: 'Трёшка с двумя санузлами', district: 'sovetsky', street: 'район пр. Гагарина', house: 'novostroyka', rooms: 3, bathrooms: 2, area: 88, weeks: 17, type: 'capital', level: 'standard', options: ['electrics', 'warmFloor', 'conditioner'], year: 2026, x: 850, y: 470, note: 'Из бетона под ключ: шумоизоляция, кондиционеры во всех комнатах.' },
  { title: 'Брежневка для родителей', district: 'priroksky', street: 'район ул. Ларина', house: 'brezhnevka', rooms: 2, bathrooms: 1, area: 54, weeks: 12, type: 'capital', level: 'standard', options: ['demolition', 'electrics', 'warmFloor'], year: 2025, x: 640, y: 640, note: 'Убрали порожки, расширили дверные проёмы, тёплый пол в ванной.' },
  { title: 'Евродвушка в новом доме', district: 'priroksky', street: 'район Щербинок', house: 'novostroyka', rooms: 2, bathrooms: 2, area: 63, weeks: 13, type: 'capital', level: 'economy', options: ['electrics'], year: 2026, x: 780, y: 690, note: 'Бюджетно, но без компромиссов по черновым: стяжка, штукатурка по маякам.' },
  { title: 'Квартира у Стрелки', district: 'kanavinsky', street: 'район ул. Совнаркомовской', house: 'panel90', rooms: 2, bathrooms: 1, area: 56, weeks: 12, type: 'capital', level: 'standard', options: ['demolition', 'electrics'], year: 2025, x: 480, y: 270, note: 'Объединили кухню с лоджией, перенесли радиатор по согласованию.' },
  { title: 'Хрущёвка-трансформер', district: 'moskovsky', street: 'район ул. Чаадаева', house: 'khrushchevka', rooms: 2, bathrooms: 1, area: 45, weeks: 11, type: 'capital', level: 'standard', options: ['demolition', 'electrics'], year: 2025, x: 340, y: 230, note: 'Проходную комнату сделали изолированной, кладовая стала гардеробной.' },
  { title: 'Светлая однушка', district: 'moskovsky', street: 'район Московского шоссе', house: 'panel90', rooms: 1, bathrooms: 1, area: 38, weeks: 5, type: 'cosmetic', level: 'standard', options: [], year: 2026, x: 380, y: 300, note: 'Освежили без пыли: покраска, новый пол и свет за 5 недель.' },
  { title: 'Трёшка у парка', district: 'sormovsky', street: 'район ул. Коминтерна', house: 'panel90', rooms: 3, bathrooms: 1, area: 77, weeks: 16, type: 'capital', level: 'standard', options: ['demolition', 'electrics', 'warmFloor'], year: 2025, x: 140, y: 270, note: 'Ремонт с проживанием по комнатам: семья не переезжала.' },
  { title: 'Двушка на Ленина', district: 'leninsky', street: 'район пр. Ленина', house: 'brezhnevka', rooms: 2, bathrooms: 1, area: 54, weeks: 8, type: 'cosmetic', level: 'standard', options: ['electrics'], year: 2026, x: 320, y: 440, note: 'Заменили проводку и обновили отделку, санузел сохранили.' },
  { title: 'Первая квартира', district: 'avtozavodsky', street: 'район ул. Мончегорской', house: 'khrushchevka', rooms: 1, bathrooms: 1, area: 30, weeks: 9, type: 'capital', level: 'economy', options: ['demolition', 'electrics'], year: 2025, x: 120, y: 560, note: 'Капитальный ремонт в минимальном бюджете, без потери качества черновых.' },
  { title: 'Трёшка для большой семьи', district: 'avtozavodsky', street: 'район пр. Молодёжного', house: 'panel90', rooms: 3, bathrooms: 2, area: 76, weeks: 16, type: 'capital', level: 'standard', options: ['demolition', 'electrics', 'warmFloor'], year: 2026, x: 230, y: 640, note: 'Второй санузел — за счёт кладовой, согласовали перепланировку.' },
  { title: 'Новостройка с дизайн-проектом', district: 'avtozavodsky', street: 'район ул. Веденяпина', house: 'novostroyka', rooms: 2, bathrooms: 1, area: 58, weeks: 19, type: 'designer', level: 'standard', options: ['electrics', 'conditioner', 'designProject'], year: 2026, x: 90, y: 690, note: 'Скрытые двери, кухня-остров, сценарии освещения.' },
];

export function seedProjects(): Project[] {
  return PROJECTS.map((p, i) => {
    const est = computeEstimate(
      { area: p.area, house: p.house, rooms: p.rooms, bathrooms: p.bathrooms, type: p.type, level: p.level, options: p.options },
      SEED_PRICES,
    );
    return { ...p, id: `pr-${i + 1}`, price: Math.round(est.total / 10000) * 10000, order: i, enabled: true };
  });
}

export const SEED_FAQ: FaqItem[] = [
  { q: 'Сколько длится ремонт?', a: 'Косметический — 4–8 недель, капитальный двушки — 10–14 недель, дизайнерский — от 16 недель. Точный срок пишем в договоре по каждому этапу.' },
  { q: 'Цена точно не вырастет?', a: 'Да. Смета фиксируется в договоре. Если мы ошиблись в объёмах — это наш риск. Цена меняется только если вы сами решили что-то добавить, и только после вашего письменного согласия.' },
  { q: 'Кто закупает материалы?', a: 'Черновые закупаем мы по оптовым ценам, без наценки — чеки видны в кабинете. Чистовые можете выбрать сами или доверить нам: снабженец привезёт образцы.' },
  { q: 'Что если вы сорвёте сроки?', a: 'Платим 0,1% от суммы договора за каждый день просрочки. Это прописано в договоре, а не обещано на словах.' },
  { q: 'Как оплачивать?', a: 'Четыре платежа по этапам: аванс 20%, затем после приёмки черновых и чистовых, и 10% — после сдачи. Можно картой, переводом или в рассрочку через банк.' },
  { q: 'Можно ли жить в квартире во время ремонта?', a: 'При капитальном ремонте — лучше нет: пыль и отключения воды. При косметическом можно, делаем по комнатам. Обсудим на замере.' },
  { q: 'Сколько стоит замер?', a: 'Бесплатно. Инженер приедет с лазерным дальномером, сделает обмерный план и через 2 дня пришлёт точную смету.' },
  { q: 'Какая гарантия?', a: '3 года на все работы и гарантия производителя на материалы. Если что-то пошло не так — приезжаем в течение 48 часов и устраняем за свой счёт.' },
].map((x, i) => ({ ...x, id: `faq-${i + 1}`, group: 'faq' as const, enabled: true, order: i }));

export const SEED_GUARANTEES: FaqItem[] = [
  { q: 'Фиксированная смета', a: 'Сумма в договоре — окончательная. Пересмотр только по вашей инициативе.' },
  { q: '3 года гарантии', a: 'На все виды работ, с выездом мастера в течение 48 часов.' },
  { q: 'Неустойка за срыв сроков', a: '0,1% от суммы договора за каждый день просрочки.' },
  { q: 'Фотоотчёт каждый день', a: 'Прораб выкладывает фото и комментарии в кабинет клиента.' },
].map((x, i) => ({ ...x, id: `gr-${i + 1}`, group: 'guarantee' as const, enabled: true, order: i }));

export function seedCabinet(now: Date): CabinetClient {
  const d = (n: number) => isoDate(addDays(now, n));
  const at = (n: number, h: number, m = 0) => { const x = addDays(now, n); x.setHours(h, m, 0, 0); return x.toISOString(); };
  const total = 1486000;
  return {
    clientName: 'Анна Сергеевна',
    address: 'ул. Ларина, 14 — кв. 37 (адрес вымышленный)',
    district: 'priroksky',
    house: 'brezhnevka',
    rooms: 2,
    area: 54.5,
    type: 'capital',
    level: 'standard',
    contractTotal: total,
    startDate: d(-62),
    planEnd: d(24),
    foreman: { name: 'Игорь Власов', phone: '+7 (900) 555-02-02' },
    stages: [
      { id: 'st-1', title: 'Замер и смета', start: d(-75), end: d(-70), status: 'done', progress: 100 },
      { id: 'st-2', title: 'Договор и аванс', start: d(-68), end: d(-64), status: 'done', progress: 100 },
      { id: 'st-3', title: 'Демонтаж', start: d(-62), end: d(-55), status: 'done', progress: 100 },
      { id: 'st-4', title: 'Черновые работы', start: d(-54), end: d(-20), status: 'done', progress: 100 },
      { id: 'st-5', title: 'Чистовые работы', start: d(-19), end: d(14), status: 'current', progress: 55 },
      { id: 'st-6', title: 'Сантехника и свет', start: d(15), end: d(21), status: 'next', progress: 0 },
      { id: 'st-7', title: 'Клининг и сдача', start: d(22), end: d(24), status: 'next', progress: 0 },
    ],
    photos: [
      { id: 'ph-1', stageId: 'st-3', date: d(-58), caption: 'Сняли старую плитку и стяжку в ванной', scene: 'demolition' },
      { id: 'ph-2', stageId: 'st-4', date: d(-47), caption: 'Залили стяжку по маякам, перепад ушёл', scene: 'screed' },
      { id: 'ph-3', stageId: 'st-4', date: d(-38), caption: 'Развели электрику — 46 точек по проекту', scene: 'electrics' },
      { id: 'ph-4', stageId: 'st-4', date: d(-26), caption: 'Штукатурка по маякам, отклонение до 1 мм', scene: 'plaster' },
      { id: 'ph-5', stageId: 'st-5', date: d(-12), caption: 'Плитка в ванной: керамогранит 60×120', scene: 'tile' },
      { id: 'ph-6', stageId: 'st-5', date: d(-5), caption: 'Первый слой краски в спальне', scene: 'paint' },
      { id: 'ph-7', stageId: 'st-5', date: d(-1), caption: 'Начали укладку инженерной доски в гостиной', scene: 'floor' },
    ],
    payments: [
      { id: 'pay-1', label: 'Аванс 20% — при подписании договора', amount: 297200, due: d(-66), paid: true },
      { id: 'pay-2', label: '30% — после приёмки черновых', amount: 445800, due: d(-19), paid: true },
      { id: 'pay-3', label: '40% — после приёмки чистовых', amount: 594400, due: d(15), paid: false },
      { id: 'pay-4', label: '10% — после сдачи квартиры', amount: total - 297200 - 445800 - 594400, due: d(25), paid: false },
    ],
    updates: [
      { id: 'up-1', at: at(-26, 18, 10), author: 'Игорь, прораб', text: 'Черновые закончили. Завтра в 11:00 приёмка — пройдём по чек-листу из 38 пунктов.', photoId: 'ph-4' },
      { id: 'up-2', at: at(-19, 12, 30), author: 'Игорь, прораб', text: 'Черновые приняты, акт подписан в кабинете. Начинаем чистовые.' },
      { id: 'up-3', at: at(-12, 17, 45), author: 'Игорь, прораб', text: 'Ванная: плитка уложена, затирка — завтра. Цвет затирки «тёплый серый», как согласовали.', photoId: 'ph-5' },
      { id: 'up-4', at: at(-5, 16, 0), author: 'Игорь, прораб', text: 'Спальня покрашена в один слой. Второй слой — после высыхания, в четверг.', photoId: 'ph-6' },
      { id: 'up-5', at: at(-3, 10, 15), author: 'Марина, снабжение', text: 'Инженерная доска приехала, 58 м² с запасом 7%. Чек загружен в раздел «Платежи».' },
      { id: 'up-6', at: at(-1, 19, 20), author: 'Игорь, прораб', text: 'Начали пол в гостиной. По графику идём на 2 дня раньше.', photoId: 'ph-7' },
    ],
  };
}

/* Несколько заявок, чтобы панель владельца выглядела рабочей. */
export function seedLeads(now: Date): { leads: Lead[]; bookings: Booking[] } {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  const snap = (p: CalcParams) => {
    const e = computeEstimate(p, SEED_PRICES, now);
    return {
      total: e.total, perM2: e.perM2, weeks: e.weeks, worksTotal: e.worksTotal, materialsTotal: e.materialsTotal,
      priceVersion: e.priceVersion, lines: e.lines.map((l) => ({ id: l.id, title: l.title, amount: l.amount })),
    };
  };
  const p1: CalcParams = { area: 54.5, house: 'brezhnevka', rooms: 2, bathrooms: 1, type: 'capital', level: 'standard', options: ['demolition', 'electrics', 'warmFloor'], planId: 'brezhnevka-2' };
  const p2: CalcParams = { area: 45.5, house: 'khrushchevka', rooms: 2, bathrooms: 1, type: 'capital', level: 'economy', options: ['demolition', 'electrics'], planId: 'khrushchevka-2' };
  const p3: CalcParams = { area: 63.6, house: 'novostroyka', rooms: 2, bathrooms: 2, type: 'designer', level: 'premium', options: ['electrics', 'warmFloor', 'conditioner', 'designProject'] };
  const p4: CalcParams = { area: 38, house: 'panel90', rooms: 1, bathrooms: 1, type: 'cosmetic', level: 'standard', options: [] };

  const day2 = isoDate(nextWorkday(now, 2));
  const day3 = isoDate(nextWorkday(now, 3));
  const bookings: Booking[] = [
    { id: 'bk-1', date: day2, time: '12:00', leadId: 'ld-2', idempotencyKey: 'seed-1', createdAt: hoursAgo(20) },
    { id: 'bk-2', date: day3, time: '16:00', leadId: 'ld-3', idempotencyKey: 'seed-2', createdAt: hoursAgo(30) },
  ];
  const base = { notes: [], updatedAt: hoursAgo(1) };
  const leads: Lead[] = [
    { ...base, id: 'ld-1', number: 101, createdAt: hoursAgo(1.5), name: 'Ольга', phone: '+7 (900) 111-22-33', source: 'calculator', channel: 'telegram', status: 'new', params: p1, estimate: snap(p1) },
    { ...base, id: 'ld-2', number: 100, createdAt: hoursAgo(20), name: 'Дмитрий Р.', phone: '+7 (900) 222-33-44', source: 'house_picker', channel: 'booking', status: 'measurement_booked', params: p2, estimate: snap(p2), slot: { date: day2, time: '12:00', bookingId: 'bk-1' } },
    { ...base, id: 'ld-3', number: 99, createdAt: hoursAgo(30), name: 'Марина', phone: '+7 (900) 333-44-55', source: 'map', channel: 'booking', status: 'measurement_booked', params: p3, estimate: snap(p3), slot: { date: day3, time: '16:00', bookingId: 'bk-2' }, notes: [{ id: 'n-1', at: hoursAgo(28), text: 'Хочет как в проекте на Веденяпина, но с двумя санузлами' }] },
    { ...base, id: 'ld-4', number: 98, createdAt: hoursAgo(52), name: 'Сергей П.', phone: '+7 (900) 444-55-66', source: 'booking', channel: 'callback', status: 'contacted' },
    { ...base, id: 'ld-5', number: 97, createdAt: hoursAgo(80), name: 'Екатерина', phone: '+7 (900) 555-66-77', source: 'calculator', channel: 'telegram', status: 'estimate_sent', params: p4, estimate: snap(p4) },
    { ...base, id: 'ld-6', number: 96, createdAt: hoursAgo(150), name: 'Алексей', phone: '+7 (900) 666-77-88', source: 'house_picker', channel: 'booking', status: 'contract', params: p1, estimate: snap(p1) },
    { ...base, id: 'ld-7', number: 95, createdAt: hoursAgo(200), name: 'Ирина В.', phone: '+7 (900) 777-88-99', source: 'calculator', channel: 'telegram', status: 'lost', params: p2, estimate: snap(p2), notes: [{ id: 'n-2', at: hoursAgo(190), text: 'Выбрала частного мастера дешевле' }] },
  ];
  return { leads, bookings };
}
