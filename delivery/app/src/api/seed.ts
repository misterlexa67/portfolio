// Стартовые данные. Всё вымышленное: рестораны, курьеры, клиенты.
import type {
  AddonGroup, Category, Dish, DishTag, PromoCode, Restaurant, Settings, Zone, Address, Profile,
} from './types';

export const img = (folder: string, name: string): string => `assets/cut/${folder}/${name}.webp`;

/** Библиотека фото для админки — все нарезанные блюда и обложки. */
export const IMAGE_LIBRARY: { folder: string; title: string; names: string[] }[] = [
  { folder: 'burgers', title: 'Бургеры', names: ['classic', 'bacon', 'crispy-chicken', 'double-pickles', 'grand', 'chicken-cheese', 'fries', 'wedges', 'nuggets', 'onion-rings', 'lemonade', 'milkshake', 'ketchup', 'garlic-sauce'] },
  { folder: 'sushi', title: 'Суши', names: ['nigiri-salmon', 'nigiri-tuna', 'nigiri-shrimp', 'nigiri-eel', 'maki-salmon', 'california', 'philadelphia', 'unagi-roll', 'baked-salmon', 'baked-eel', 'red-dragon', 'tempura-roll', 'gunkan-ikura', 'gunkan-spicy', 'gunkan-chuka', 'ginger', 'wasabi'] },
  { folder: 'shawarma', title: 'Шаурма и вок', names: ['shawarma-chicken', 'shawarma-beef', 'shawarma-spicy', 'shawarma-falafel', 'wok-beef', 'rice-shrimp', 'wok-shrimp', 'rice-lamb', 'khinkali', 'tom-yum', 'chuka-salad', 'spring-rolls'] },
  { folder: 'coffee', title: 'Кофе и десерты', names: ['cappuccino', 'iced-latte', 'mocha', 'americano', 'caramel-frappe', 'red-velvet', 'cheesecake', 'fondant', 'macaron', 'croissant'] },
  { folder: 'healthy', title: 'Полезное', names: ['chicken-bowl', 'poke-salmon', 'caprese', 'green-smoothie', 'berry-smoothie', 'feta-salad', 'granola-bowl'] },
];
export const COVER_LIBRARY = ['burgers', 'sushi', 'wok'].map((n) => img('covers', n));

export const SETTINGS: Settings = {
  serviceFee: 49,
  startingBalance: 3000,
  demoSpeed: 1,
  simulateErrors: false,
  adminPin: '0000',
};

export const CATEGORIES: Category[] = [
  { id: 'burgers', name: 'Бургеры', image: img('burgers', 'classic') },
  { id: 'wok', name: 'Вок', image: img('shawarma', 'wok-beef') },
  { id: 'sushi', name: 'Суши', image: img('sushi', 'philadelphia') },
  { id: 'shawarma', name: 'Шаурма', image: img('shawarma', 'shawarma-chicken') },
  { id: 'coffee', name: 'Кофе и десерты', image: img('coffee', 'cappuccino') },
  { id: 'healthy', name: 'Полезное', image: img('healthy', 'poke-salmon') },
];

export const ZONES: Zone[] = [
  {
    id: 'z-center', name: 'Центр', description: 'Нижегородский район у Кремля и Покровки',
    surcharge: 0, extraMinutes: 0, enabled: true, sort: 1,
    polygon: [
      { x: 480, y: 266 }, { x: 600, y: 258 }, { x: 700, y: 244 }, { x: 742, y: 300 },
      { x: 722, y: 392 }, { x: 622, y: 432 }, { x: 512, y: 422 }, { x: 494, y: 350 },
    ],
  },
  {
    id: 'z-upper', name: 'Нагорная часть', description: 'Советский, Приокский и окраины Нижегородского',
    surcharge: 60, extraMinutes: 10, enabled: true, sort: 2,
    polygon: [
      { x: 478, y: 266 }, { x: 700, y: 244 }, { x: 860, y: 224 }, { x: 960, y: 236 },
      { x: 985, y: 420 }, { x: 950, y: 610 }, { x: 870, y: 690 }, { x: 350, y: 690 },
      { x: 415, y: 600 }, { x: 468, y: 515 }, { x: 490, y: 420 }, { x: 492, y: 340 },
    ],
  },
  {
    id: 'z-lower', name: 'Заречная часть', description: 'Канавинский, Ленинский, Московский, Сормовский, Автозаводский',
    surcharge: 120, extraMinutes: 15, enabled: true, sort: 3,
    polygon: [
      { x: 30, y: 206 }, { x: 300, y: 236 }, { x: 420, y: 268 }, { x: 436, y: 300 },
      { x: 448, y: 360 }, { x: 446, y: 430 }, { x: 418, y: 505 }, { x: 358, y: 585 },
      { x: 280, y: 660 }, { x: 250, y: 690 }, { x: 30, y: 690 },
    ],
  },
];

export const PROMOS: PromoCode[] = [
  { id: 'p-est10', code: 'ЕСТЬ10', kind: 'percent', value: 10, minSubtotal: 0, maxDiscount: 500, description: 'Скидка 10% на любой заказ', enabled: true },
  { id: 'p-first', code: 'ПЕРВЫЙ200', kind: 'fixed', value: 200, minSubtotal: 1200, maxDiscount: null, description: '200 ₽ на заказ от 1 200 ₽', enabled: true },
  { id: 'p-night', code: 'НОЧЬ15', kind: 'percent', value: 15, minSubtotal: 800, maxDiscount: 400, description: 'Ночная скидка 15% — сейчас выключена', enabled: false },
];

/* ---------- Добавки ---------- */

let gid = 0;
const g = (name: string, kind: 'single' | 'multi', required: boolean, options: [string, number][], max?: number): AddonGroup => {
  gid += 1;
  return {
    id: `g${gid}`, name, kind, required, max,
    options: options.map(([n, p], i) => ({ id: `g${gid}o${i + 1}`, name: n, price: p })),
  };
};

const sauces = () => g('Соус', 'multi', false, [['Кетчуп', 40], ['Чесночный', 40], ['Сырный', 50]], 2);
const doneness = () => g('Прожарка', 'single', true, [['Medium', 0], ['Well done', 0]]);
const burgerExtras = () => g('Добавить', 'multi', false, [['Вторая котлета', 190], ['Бекон', 90], ['Чеддер', 50], ['Халапеньо', 40]]);
const rollExtras = () => g('К роллу', 'multi', false, [['Имбирь', 30], ['Васаби', 30], ['Соевый соус', 30], ['Спайси-соус', 40]]);
const lavash = () => g('Лаваш', 'single', true, [['Обычный', 0], ['Сырный', 40]]);
const shawarmaExtras = () => g('Добавить', 'multi', false, [['Двойное мясо', 120], ['Сыр', 50], ['Халапеньо', 30], ['Картофель фри внутрь', 40]]);
const wokBase = () => g('Основа', 'single', true, [['Пшеничная лапша', 0], ['Удон', 30], ['Рис', 0], ['Гречневая соба', 30]]);
const wokSauce = () => g('Соус', 'single', true, [['Терияки', 0], ['Устричный', 0], ['Кисло-сладкий', 0], ['Острый сычуаньский', 0]]);
const wokExtras = () => g('Добавить', 'multi', false, [['Курица', 90], ['Креветки', 150], ['Кешью', 70], ['Двойные овощи', 60]]);
const coffeeSize = () => g('Объём', 'single', true, [['250 мл', 0], ['350 мл', 50], ['450 мл', 90]]);
const milk = () => g('Молоко', 'single', true, [['Обычное', 0], ['Овсяное', 60], ['Миндальное', 70], ['Безлактозное', 40]]);
const syrup = () => g('Сироп', 'multi', false, [['Ваниль', 40], ['Карамель', 40], ['Солёная карамель', 40], ['Лесной орех', 40]], 2);
const bowlBase = () => g('Основа', 'single', true, [['Киноа', 0], ['Бурый рис', 0], ['Микс салатов', 0]]);
const bowlExtras = () => g('Добавить', 'multi', false, [['Авокадо', 90], ['Яйцо пашот', 60], ['Двойной белок', 150]]);

/* ---------- Рестораны и блюда ---------- */

type DishSeed = [
  id: string, section: string, name: string, image: string, price: number, oldPrice: number | null,
  weight: number, unit: Dish['unit'], kcal: number, description: string, composition: string,
  tags?: DishTag[], addons?: AddonGroup[],
];

const R: Restaurant[] = [];
const D: Dish[] = [];

function restaurant(r: Omit<Restaurant, 'enabled' | 'sort'>, dishes: DishSeed[]): void {
  R.push({ ...r, enabled: true, sort: R.length + 1 });
  dishes.forEach((d, i) => {
    const [id, sectionId, name, image, price, oldPrice, weight, unit, calories, description, composition, tags = [], addonGroups = []] = d;
    D.push({ id, restaurantId: r.id, sectionId, name, image, price, oldPrice, weight, unit, calories, description, composition, tags, addonGroups, available: true, sort: i + 1 });
  });
}

restaurant({
  id: 'burger-buro', name: 'Бургер Бюро', tagline: 'Фермерская говядина и бриошь из своей пекарни',
  categoryIds: ['burgers'], rating: 4.8, ratingCount: 1240, cookMinutes: 15, baseDeliveryFee: 0, minOrder: 600,
  hours: { open: '10:00', close: '24:00' }, location: { x: 585, y: 336 }, address: 'Большая Покровская ул., 34',
  cover: { kind: 'photo', src: img('covers', 'burgers'), position: '50% 45%' },
  sections: [{ id: 'burgers', name: 'Бургеры' }, { id: 'snacks', name: 'Закуски' }, { id: 'sauces', name: 'Соусы' }, { id: 'drinks', name: 'Напитки' }],
}, [
  ['bb-classic', 'burgers', 'Классический чизбургер', img('burgers', 'classic'), 420, null, 290, 'г', 690, 'Сочная котлета из мраморной говядины, тянущийся чеддер и наш фирменный соус.', 'Говяжья котлета 150 г, чеддер, томаты, салат айсберг, маринованный лук, фирменный соус, булочка бриошь', ['hit'], [doneness(), burgerExtras(), sauces()]],
  ['bb-bacon', 'burgers', 'Бургер с беконом', img('burgers', 'bacon'), 490, 560, 320, 'г', 820, 'Хрустящий бекон, двойной чеддер и томаты — для тех, кто проголодался всерьёз.', 'Говяжья котлета 150 г, бекон, чеддер, томаты, салат, соус барбекю, булочка бриошь', [], [doneness(), burgerExtras(), sauces()]],
  ['bb-crispy', 'burgers', 'Криспи чикен', img('burgers', 'crispy-chicken'), 390, null, 280, 'г', 640, 'Куриное бедро в хрустящей панировке, томаты и лёгкий соус с травами.', 'Куриное бедро в панировке, томаты, салат, соус с травами, булочка бриошь', [], [burgerExtras(), sauces()]],
  ['bb-double', 'burgers', 'Двойной с огурчиками', img('burgers', 'double-pickles'), 590, null, 380, 'г', 1040, 'Две котлеты, двойной сыр и много маринованных огурчиков.', 'Две говяжьи котлеты по 120 г, чеддер, маринованные огурцы, лук, горчичный соус, булочка', ['hit'], [doneness(), burgerExtras(), sauces()]],
  ['bb-grand', 'burgers', 'Гранд', img('burgers', 'grand'), 520, null, 340, 'г', 860, 'Большая котлета 180 г, свежие овощи и соус на копчёной паприке.', 'Говяжья котлета 180 г, чеддер, томаты, салат, красный лук, соус с паприкой, булочка', ['new'], [doneness(), burgerExtras(), sauces()]],
  ['bb-chicken-cheese', 'burgers', 'Чикен чиз', img('burgers', 'chicken-cheese'), 410, null, 300, 'г', 710, 'Курица в панировке под двойным сыром.', 'Куриное бедро в панировке, двойной чеддер, салат, сырный соус, булочка', [], [burgerExtras(), sauces()]],
  ['bb-fries', 'snacks', 'Картофель фри', img('burgers', 'fries'), 190, null, 150, 'г', 430, 'Тонкий хрустящий фри с морской солью.', 'Картофель, масло подсолнечное, морская соль', ['veg'], [g('Размер', 'single', true, [['Стандарт', 0], ['Большой', 70]]), sauces()]],
  ['bb-wedges', 'snacks', 'Картофельные дольки', img('burgers', 'wedges'), 210, null, 170, 'г', 380, 'Запечённые дольки со специями и розмарином.', 'Картофель, паприка, розмарин, чеснок, соль', ['veg'], [sauces()]],
  ['bb-nuggets', 'snacks', 'Наггетсы, 9 шт', img('burgers', 'nuggets'), 290, null, 180, 'г', 470, 'Кусочки куриного филе в хрустящей панировке.', 'Куриное филе, панировка, специи', [], [sauces()]],
  ['bb-rings', 'snacks', 'Луковые кольца', img('burgers', 'onion-rings'), 230, null, 140, 'г', 410, 'Сладкий лук в пивном кляре.', 'Лук, кляр, соль', ['veg'], [sauces()]],
  ['bb-ketchup', 'sauces', 'Кетчуп', img('burgers', 'ketchup'), 50, null, 40, 'г', 45, 'Томатный, на спелых томатах.', 'Томаты, сахар, уксус, специи', ['veg']],
  ['bb-garlic', 'sauces', 'Чесночный соус', img('burgers', 'garlic-sauce'), 50, null, 40, 'г', 160, 'Сливочный, с запечённым чесноком.', 'Майонез, запечённый чеснок, укроп', ['veg']],
  ['bb-lemonade', 'drinks', 'Домашний лимонад', img('burgers', 'lemonade'), 220, null, 400, 'мл', 160, 'Свежевыжатый лимон, мята и немного тростникового сахара.', 'Лимон, мята, тростниковый сахар, вода', ['veg'], [g('Вкус', 'single', true, [['Классический', 0], ['Маракуйя', 30], ['Клубника-базилик', 30]])]],
  ['bb-shake', 'drinks', 'Молочный коктейль', img('burgers', 'milkshake'), 290, null, 400, 'мл', 520, 'Густой коктейль на пломбире со взбитыми сливками.', 'Молоко, пломбир, сливки, шоколадный топпинг', [], [g('Вкус', 'single', true, [['Ванильный', 0], ['Клубничный', 0], ['Шоколадный', 0]])]],
]);

restaurant({
  id: 'nori-bar', name: 'Нори-бар', tagline: 'Роллы и нигири из охлаждённой рыбы',
  categoryIds: ['sushi'], rating: 4.9, ratingCount: 2080, cookMinutes: 25, baseDeliveryFee: 99, minOrder: 900,
  hours: { open: '11:00', close: '23:00' }, location: { x: 510, y: 284 }, address: 'Рождественская ул., 33',
  cover: { kind: 'photo', src: img('covers', 'sushi'), position: '50% 60%' },
  sections: [{ id: 'rolls', name: 'Роллы' }, { id: 'baked', name: 'Запечённые и темпура' }, { id: 'nigiri', name: 'Нигири' }, { id: 'gunkan', name: 'Гунканы' }],
}, [
  ['nb-phila', 'rolls', 'Филадельфия', img('sushi', 'philadelphia'), 690, null, 260, 'г', 450, 'Классика: нежный лосось, сливочный сыр и огурец. 8 шт.', 'Лосось, сливочный сыр, огурец, рис, нори', ['hit'], [rollExtras()]],
  ['nb-california', 'rolls', 'Калифорния с масаго', img('sushi', 'california'), 590, null, 240, 'г', 390, 'Снежный краб, авокадо, огурец и икра масаго. 8 шт.', 'Снежный краб, авокадо, огурец, икра масаго, японский майонез, рис, нори', [], [rollExtras()]],
  ['nb-unagi', 'rolls', 'Унаги ролл', img('sushi', 'unagi-roll'), 640, null, 230, 'г', 420, 'Копчёный угорь под соусом унаги и кунжутом. 8 шт.', 'Угорь, сливочный сыр, огурец, соус унаги, кунжут, рис, нори', [], [rollExtras()]],
  ['nb-dragon', 'rolls', 'Красный дракон', img('sushi', 'red-dragon'), 660, null, 250, 'г', 410, 'Яркий ролл в красной икре тобико с лососем и огурцом. 8 шт.', 'Лосось, сливочный сыр, огурец, икра тобико, рис, нори', ['new'], [rollExtras()]],
  ['nb-maki', 'rolls', 'Маки с лососем', img('sushi', 'maki-salmon'), 290, null, 120, 'г', 190, 'Тонкий ролл с лососем. 6 шт.', 'Лосось, рис, нори', [], [rollExtras()]],
  ['nb-baked-salmon', 'baked', 'Запечённый с лососем', img('sushi', 'baked-salmon'), 620, 690, 250, 'г', 480, 'Тёплый ролл под сырной шапкой и кунжутом. 8 шт.', 'Лосось, сливочный сыр, огурец, сырный соус, кунжут, рис, нори', [], [rollExtras()]],
  ['nb-baked-eel', 'baked', 'Запечённый с угрём', img('sushi', 'baked-eel'), 640, null, 250, 'г', 500, 'Угорь и сливочный сыр под соусом унаги. 8 шт.', 'Угорь, сливочный сыр, огурец, соус унаги, кунжут, рис, нори', [], [rollExtras()]],
  ['nb-tempura', 'baked', 'Темпура ролл', img('sushi', 'tempura-roll'), 560, null, 260, 'г', 540, 'Горячий ролл в хрустящей панировке панко. 8 шт.', 'Лосось, сливочный сыр, огурец, панко, рис, нори', [], [rollExtras()]],
  ['nb-n-salmon', 'nigiri', 'Нигири с лососем, 2 шт', img('sushi', 'nigiri-salmon'), 260, null, 70, 'г', 110, 'Охлаждённый лосось на тёплом рисе.', 'Лосось, рис, васаби', []],
  ['nb-n-tuna', 'nigiri', 'Нигири с тунцом, 2 шт', img('sushi', 'nigiri-tuna'), 290, null, 70, 'г', 100, 'Тунец с плотной текстурой и мягким вкусом.', 'Тунец, рис, васаби', []],
  ['nb-n-shrimp', 'nigiri', 'Нигири с креветкой, 2 шт', img('sushi', 'nigiri-shrimp'), 270, null, 70, 'г', 95, 'Тигровая креветка на рисе.', 'Креветка, рис, васаби', []],
  ['nb-n-eel', 'nigiri', 'Нигири с угрём, 2 шт', img('sushi', 'nigiri-eel'), 310, null, 75, 'г', 130, 'Копчёный угорь, соус унаги, кунжут.', 'Угорь, рис, соус унаги, кунжут, нори', []],
  ['nb-g-ikura', 'gunkan', 'Гункан с икрой лосося, 2 шт', img('sushi', 'gunkan-ikura'), 390, null, 60, 'г', 90, 'Крупная икра лосося в хрустящем нори.', 'Икра лосося, рис, нори', ['hit']],
  ['nb-g-spicy', 'gunkan', 'Спайси гункан, 2 шт', img('sushi', 'gunkan-spicy'), 280, null, 70, 'г', 120, 'Лосось в остром соусе с кунжутом.', 'Лосось, спайси-соус, кунжут, рис, нори', ['spicy']],
  ['nb-g-chuka', 'gunkan', 'Гункан с чукой, 2 шт', img('sushi', 'gunkan-chuka'), 220, null, 70, 'г', 80, 'Салат из водорослей с ореховым соусом.', 'Водоросли чука, ореховый соус, кунжут, рис, нори', ['veg']],
]);

restaurant({
  id: 'lavash', name: 'Лаваш и угли', tagline: 'Шаурма на углях, хинкали и плов',
  categoryIds: ['shawarma'], rating: 4.7, ratingCount: 3410, cookMinutes: 12, baseDeliveryFee: 0, minOrder: 500,
  hours: { open: '09:00', close: '02:00' }, location: { x: 356, y: 306 }, address: 'Московское шоссе, 3',
  cover: { kind: 'still', tint: '#F2E9DF', images: [img('shawarma', 'shawarma-beef'), img('shawarma', 'rice-lamb'), img('burgers', 'garlic-sauce')] },
  sections: [{ id: 'shawarma', name: 'Шаурма' }, { id: 'hot', name: 'Горячее' }, { id: 'sides', name: 'Закуски и соусы' }, { id: 'drinks', name: 'Напитки' }],
}, [
  ['lu-chicken', 'shawarma', 'Шаурма с курицей', img('shawarma', 'shawarma-chicken'), 360, null, 380, 'г', 620, 'Курица на углях, свежие овощи и чесночный соус в тонком лаваше.', 'Куриное бедро, томаты, огурцы, капуста, чесночный соус, лаваш', ['hit'], [lavash(), shawarmaExtras()]],
  ['lu-beef', 'shawarma', 'Шаурма с говядиной', img('shawarma', 'shawarma-beef'), 420, null, 380, 'г', 680, 'Говядина на углях, маринованный лук и соус тахини.', 'Говядина, томаты, огурцы, маринованный лук, тахини, лаваш', [], [lavash(), shawarmaExtras()]],
  ['lu-spicy', 'shawarma', 'Острая шаурма', img('shawarma', 'shawarma-spicy'), 390, null, 380, 'г', 640, 'Курица в остром маринаде, халапеньо и соус шрирача.', 'Куриное бедро, халапеньо, томаты, салат, соус шрирача, лаваш', ['spicy'], [lavash(), shawarmaExtras()]],
  ['lu-falafel', 'shawarma', 'Шаурма с фалафелем', img('shawarma', 'shawarma-falafel'), 340, null, 350, 'г', 560, 'Хрустящий фалафель из нута, хумус и овощи.', 'Фалафель, хумус, томаты, огурцы, салат, тахини, лаваш', ['veg'], [lavash(), shawarmaExtras()]],
  ['lu-plov', 'hot', 'Плов с бараниной', img('shawarma', 'rice-lamb'), 450, null, 350, 'г', 640, 'Рассыпчатый плов с бараниной, морковью и зирой.', 'Рис девзира, баранина, морковь, лук, зира, барбарис', ['hit']],
  ['lu-khinkali', 'hot', 'Хинкали с говядиной, 4 шт', img('shawarma', 'khinkali'), 390, null, 320, 'г', 560, 'Сочные хинкали с бульоном внутри и кинзой.', 'Тесто, говядина, свинина, лук, кинза, специи'],
  ['lu-fries', 'sides', 'Картофель фри', img('burgers', 'fries'), 170, null, 150, 'г', 430, 'Хрустящий, с солью.', 'Картофель, масло, соль', ['veg']],
  ['lu-wedges', 'sides', 'Картофельные дольки', img('burgers', 'wedges'), 190, null, 170, 'г', 380, 'Со специями и чесноком.', 'Картофель, паприка, чеснок, соль', ['veg']],
  ['lu-garlic', 'sides', 'Чесночный соус', img('burgers', 'garlic-sauce'), 50, null, 40, 'г', 160, 'Фирменный, к любой шаурме.', 'Йогурт, чеснок, укроп', ['veg']],
  ['lu-tomato', 'sides', 'Острый томатный соус', img('burgers', 'ketchup'), 50, null, 40, 'г', 50, 'Томаты, перец чили, чеснок.', 'Томаты, чили, чеснок, специи', ['veg', 'spicy']],
  ['lu-lemonade', 'drinks', 'Лимонад лимон-мята', img('burgers', 'lemonade'), 200, null, 400, 'мл', 150, 'Освежающий, не приторный.', 'Лимон, мята, сахар, вода', ['veg']],
]);

restaurant({
  id: 'wok-oka', name: 'Вок на Оке', tagline: 'Лапша и рис с огня, том ям и баоцзы',
  categoryIds: ['wok'], rating: 4.6, ratingCount: 980, cookMinutes: 18, baseDeliveryFee: 79, minOrder: 700,
  hours: { open: '11:00', close: '23:00' }, location: { x: 700, y: 440 }, address: 'ул. Ванеева, 34',
  cover: { kind: 'photo', src: img('covers', 'wok'), position: '50% 55%' },
  sections: [{ id: 'wok', name: 'Вок' }, { id: 'soups', name: 'Супы' }, { id: 'snacks', name: 'Закуски' }, { id: 'drinks', name: 'Напитки' }],
}, [
  ['wo-beef', 'wok', 'Вок с говядиной', img('shawarma', 'wok-beef'), 490, null, 350, 'г', 610, 'Говядина, перец и стручковая фасоль, обжаренные на сильном огне.', 'Лапша, говядина, болгарский перец, стручковая фасоль, лук, кунжут', ['hit'], [wokBase(), wokSauce(), wokExtras()]],
  ['wo-shrimp', 'wok', 'Вок с креветками', img('shawarma', 'wok-shrimp'), 560, null, 350, 'г', 540, 'Тигровые креветки, овощи и соус на выбор.', 'Лапша, креветки, перец, фасоль, морковь, кунжут', [], [wokBase(), wokSauce(), wokExtras()]],
  ['wo-rice-shrimp', 'wok', 'Жареный рис с креветками', img('shawarma', 'rice-shrimp'), 520, null, 330, 'г', 560, 'Рис с яйцом, горошком и креветками.', 'Рис, креветки, яйцо, зелёный горошек, морковь, лук', [], [wokSauce(), wokExtras()]],
  ['wo-rice-beef', 'wok', 'Рис с говядиной по-сычуаньски', img('shawarma', 'rice-lamb'), 480, null, 340, 'г', 600, 'Пряный рис с говядиной и красным луком.', 'Рис, говядина, морковь, красный лук, сычуаньский перец', ['spicy'], [wokExtras()]],
  ['wo-tomyum', 'soups', 'Том ям с креветками', img('shawarma', 'tom-yum'), 590, null, 400, 'мл', 380, 'Кисло-острый суп на кокосовом молоке с креветками и грибами.', 'Кокосовое молоко, креветки, шампиньоны, томаты, лемонграсс, лайм, чили', ['hit', 'spicy'], [g('К супу', 'multi', false, [['Рис', 50], ['Двойные креветки', 190]])]],
  ['wo-bao', 'snacks', 'Баоцзы со свининой, 4 шт', img('shawarma', 'khinkali'), 360, null, 240, 'г', 480, 'Паровые пирожки с сочной начинкой.', 'Пшеничное тесто, свинина, капуста, имбирь, зелёный лук'],
  ['wo-spring', 'snacks', 'Спринг-роллы с овощами', img('shawarma', 'spring-rolls'), 290, null, 180, 'г', 340, 'Хрустящие роллы с овощами и сладким чили.', 'Рисовое тесто, капуста, морковь, грибы, соус сладкий чили', ['veg']],
  ['wo-chuka', 'snacks', 'Салат чука', img('shawarma', 'chuka-salad'), 270, null, 150, 'г', 140, 'Водоросли с ореховым соусом и кунжутом.', 'Водоросли чука, ореховый соус, кунжут', ['veg']],
  ['wo-lemonade', 'drinks', 'Имбирный лимонад', img('burgers', 'lemonade'), 210, null, 400, 'мл', 140, 'Имбирь, лимон и мёд.', 'Имбирь, лимон, мёд, вода', ['veg']],
]);

restaurant({
  id: 'penka', name: 'Пенка', tagline: 'Спешелти-кофе и десерты из своей кондитерской',
  categoryIds: ['coffee'], rating: 4.9, ratingCount: 1760, cookMinutes: 10, baseDeliveryFee: 49, minOrder: 400,
  hours: { open: '08:00', close: '22:00' }, location: { x: 632, y: 298 }, address: 'ул. Минина, 6',
  cover: { kind: 'still', tint: '#F3EBE4', images: [img('coffee', 'cappuccino'), img('coffee', 'croissant'), img('coffee', 'cheesecake')] },
  sections: [{ id: 'coffee', name: 'Кофе' }, { id: 'cold', name: 'Холодные напитки' }, { id: 'desserts', name: 'Десерты и выпечка' }],
}, [
  ['pe-cappuccino', 'coffee', 'Капучино', img('coffee', 'cappuccino'), 230, null, 250, 'мл', 120, 'Эспрессо из эфиопской арабики и бархатное молоко.', 'Эспрессо, молоко', ['hit'], [coffeeSize(), milk(), syrup()]],
  ['pe-mocha', 'coffee', 'Мокко', img('coffee', 'mocha'), 290, null, 300, 'мл', 260, 'Кофе с горячим шоколадом и шапкой сливок.', 'Эспрессо, молоко, бельгийский шоколад, сливки', [], [coffeeSize(), milk(), syrup()]],
  ['pe-americano', 'coffee', 'Американо', img('coffee', 'americano'), 180, null, 300, 'мл', 10, 'Чистый вкус с нотами шоколада и ягод.', 'Эспрессо, вода', [], [coffeeSize(), syrup()]],
  ['pe-iced-latte', 'cold', 'Айс латте', img('coffee', 'iced-latte'), 280, null, 350, 'мл', 150, 'Холодное молоко, лёд и двойной эспрессо.', 'Эспрессо, молоко, лёд', [], [milk(), syrup()]],
  ['pe-frappe', 'cold', 'Карамельный фраппе', img('coffee', 'caramel-frappe'), 330, null, 400, 'мл', 340, 'Взбитый ледяной кофе с карамелью и сливками.', 'Эспрессо, молоко, лёд, карамель, сливки', ['new'], [milk()]],
  ['pe-velvet', 'desserts', 'Красный бархат', img('coffee', 'red-velvet'), 340, null, 130, 'г', 420, 'Влажные коржи и лёгкий крем-чиз.', 'Мука, какао, пахта, сливочный сыр, сливки, сахар'],
  ['pe-cheesecake', 'desserts', 'Чизкейк с ягодами', img('coffee', 'cheesecake'), 320, 360, 130, 'г', 380, 'Нью-йоркский чизкейк с ягодным соусом.', 'Сливочный сыр, сливки, яйца, печенье, ягоды', ['hit']],
  ['pe-fondant', 'desserts', 'Шоколадный фондан', img('coffee', 'fondant'), 350, null, 120, 'г', 450, 'Тёплый кекс с жидким шоколадным центром.', 'Тёмный шоколад, масло, яйца, мука, сахар', [], [g('Подача', 'multi', false, [['Шарик пломбира', 90]])]],
  ['pe-macaron', 'desserts', 'Малиновый макарон', img('coffee', 'macaron'), 120, null, 25, 'г', 100, 'Миндальное печенье с малиновым ганашем.', 'Миндальная мука, белок, сахар, малина, белый шоколад'],
  ['pe-croissant', 'desserts', 'Круассан', img('coffee', 'croissant'), 190, null, 80, 'г', 320, 'Слоёный, на французском сливочном масле.', 'Мука, сливочное масло 82%, молоко, дрожжи', [], [g('Начинка', 'single', true, [['Без начинки', 0], ['Миндальный крем', 70], ['Ветчина и сыр', 110]])]],
]);

restaurant({
  id: 'svezho', name: 'Свежо', tagline: 'Боулы, салаты и смузи — сытно и сбалансированно',
  categoryIds: ['healthy'], rating: 4.8, ratingCount: 1120, cookMinutes: 15, baseDeliveryFee: 0, minOrder: 700,
  hours: { open: '09:00', close: '22:00' }, location: { x: 382, y: 432 }, address: 'пр. Ленина, 15',
  cover: { kind: 'still', tint: '#EDF0E7', images: [img('healthy', 'poke-salmon'), img('healthy', 'berry-smoothie'), img('healthy', 'chicken-bowl')] },
  sections: [{ id: 'bowls', name: 'Боулы' }, { id: 'salads', name: 'Салаты' }, { id: 'smoothie', name: 'Смузи' }],
}, [
  ['sv-chicken', 'bowls', 'Боул с курицей терияки', img('healthy', 'chicken-bowl'), 490, null, 380, 'г', 520, 'Курица терияки, авокадо, эдамаме и томаты черри.', 'Куриное филе, киноа, авокадо, эдамаме, черри, руккола, соус терияки, кунжут', ['hit'], [bowlBase(), bowlExtras()]],
  ['sv-poke', 'bowls', 'Поке с лососем', img('healthy', 'poke-salmon'), 620, null, 360, 'г', 480, 'Лосось, манго, огурец и водоросли на рисе.', 'Лосось, рис, манго, огурец, водоросли чука, микрозелень, соус понзу', ['hit'], [bowlBase(), bowlExtras()]],
  ['sv-granola', 'bowls', 'Гранола-боул с йогуртом', img('healthy', 'granola-bowl'), 360, null, 280, 'г', 390, 'Греческий йогурт, банан, ягоды и хрустящая гранола.', 'Греческий йогурт, гранола, банан, клубника, голубика, чиа, мята', ['veg']],
  ['sv-caprese', 'salads', 'Капрезе с моцареллой', img('healthy', 'caprese'), 450, null, 260, 'г', 340, 'Шарики моцареллы, томаты черри, базилик и бальзамик.', 'Моцарелла, черри, руккола, красный лук, базилик, бальзамический крем', ['veg']],
  ['sv-feta', 'salads', 'Салат с фетой и авокадо', img('healthy', 'feta-salad'), 480, null, 300, 'г', 360, 'Хрустящие листья, фета, авокадо и томаты.', 'Микс салатов, фета, авокадо, черри, огурец, оливковое масло, лимон', ['veg'], [bowlExtras()]],
  ['sv-chuka', 'salads', 'Чука с ореховым соусом', img('shawarma', 'chuka-salad'), 290, null, 150, 'г', 140, 'Водоросли, кунжут и ореховый соус.', 'Водоросли чука, ореховый соус, кунжут', ['veg']],
  ['sv-green', 'smoothie', 'Зелёный смузи', img('healthy', 'green-smoothie'), 320, null, 400, 'мл', 210, 'Шпинат, яблоко, банан и киви.', 'Шпинат, яблоко, банан, киви, вода', ['veg'], [g('Добавить', 'multi', false, [['Протеин', 80], ['Семена чиа', 40]])]],
  ['sv-berry', 'smoothie', 'Ягодный смузи', img('healthy', 'berry-smoothie'), 320, 380, 400, 'мл', 230, 'Клубника, малина, голубика и банан.', 'Клубника, малина, голубика, банан, йогурт', ['veg'], [g('Добавить', 'multi', false, [['Протеин', 80], ['Семена чиа', 40]])]],
]);

export const RESTAURANTS = R;
export const DISHES = D;

export const DEFAULT_ADDRESS: Address = {
  id: 'a-home',
  label: 'Дом',
  street: 'ул. Белинского, 61',
  district: 'Нижегородский район',
  details: { entrance: '2', floor: '4', apartment: '17', comment: '' },
  point: { x: 650, y: 405 },
};

export const PROFILE: Profile = {
  addresses: [DEFAULT_ADDRESS],
  selectedAddressId: DEFAULT_ADDRESS.id,
  favoriteRestaurants: [],
  favoriteDishes: [],
  recentSearches: [],
};

export const COURIERS = [
  { name: 'Артём', rating: 4.98, vehicle: 'Самокат', phoneMasked: '+7 9•• •••-41-07' },
  { name: 'Ильдар', rating: 4.95, vehicle: 'Велосипед', phoneMasked: '+7 9•• •••-18-52' },
  { name: 'Мария', rating: 4.99, vehicle: 'Самокат', phoneMasked: '+7 9•• •••-77-30' },
  { name: 'Георгий', rating: 4.93, vehicle: 'Автомобиль', phoneMasked: '+7 9•• •••-05-64' },
  { name: 'Дарина', rating: 4.97, vehicle: 'Пешком', phoneMasked: '+7 9•• •••-62-19' },
  { name: 'Тимур', rating: 4.96, vehicle: 'Велосипед', phoneMasked: '+7 9•• •••-33-88' },
];

/** Вымышленные клиенты — чтобы дашборд владельца не был пустым. */
export const DEMO_CUSTOMERS = ['Анна С.', 'Павел Д.', 'Елена В.', 'Олег Т.', 'Ксения М.', 'Илья Р.', 'Наталья К.', 'Денис Ф.'];
