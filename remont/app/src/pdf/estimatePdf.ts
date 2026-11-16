import { catalog, describeParams, type Estimate, type FloorPlan, type SiteTexts } from '../api';
import { rub, area as fmtArea, weeks as fmtWeeks } from '../lib/format';

/* Фирменный PDF сметы прямо в браузере. jsPDF — с cdnjs, точная версия, грузится по клику.
   Стандартные шрифты jsPDF не умеют кириллицу, поэтому подключаем IBM Plex Sans и Noto Serif Display. */

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

/* Минимальный тип того, что используем из jsPDF. */
interface Doc {
  addFileToVFS(name: string, data: string): void;
  addFont(file: string, name: string, style: string): void;
  setFont(name: string, style?: string): void;
  setFontSize(n: number): void;
  setTextColor(r: number, g?: number, b?: number): void;
  setDrawColor(r: number, g?: number, b?: number): void;
  setFillColor(r: number, g?: number, b?: number): void;
  setLineWidth(n: number): void;
  text(t: string | string[], x: number, y: number, o?: Record<string, unknown>): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): void;
  splitTextToSize(t: string, w: number): string[];
  getTextWidth(t: string): number;
  addPage(): void;
  save(name: string): void;
  setProperties(p: Record<string, string>): void;
}
declare global { interface Window { jspdf?: { jsPDF: new (o: Record<string, unknown>) => Doc } } }

let loading: Promise<void> | null = null;
function loadJsPdf(): Promise<void> {
  if (window.jspdf) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSPDF_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('jspdf')); };
    document.head.appendChild(s);
  });
  return loading;
}

const fontCache = new Map<string, string>();
async function fontB64(url: string): Promise<string> {
  const hit = fontCache.get(url);
  if (hit) return hit;
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  fontCache.set(url, b64);
  return b64;
}

const INK: [number, number, number] = [35, 33, 30];
const SOFT: [number, number, number] = [92, 88, 81];
const MUTE: [number, number, number] = [133, 127, 117];
const LINE: [number, number, number] = [203, 194, 180];
const CLAY: [number, number, number] = [173, 79, 45];
const STONE: [number, number, number] = [233, 227, 217];

export const estimateNumber = (e: Estimate) => {
  const h = [...`${e.createdAt}${e.total}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `М-${String(h % 9000 + 1000)}`;
};

export async function downloadEstimatePdf(e: Estimate, plan: FloorPlan, texts: SiteTexts | undefined, base = './') {
  await loadJsPdf();
  const [reg, semi, serif] = await Promise.all([
    fontB64(`${base}pdf/plex-400.ttf`), fontB64(`${base}pdf/plex-600.ttf`), fontB64(`${base}pdf/serif-400.ttf`),
  ]);
  const doc = new window.jspdf!.jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('plex-400.ttf', reg); doc.addFont('plex-400.ttf', 'Plex', 'normal');
  doc.addFileToVFS('plex-600.ttf', semi); doc.addFont('plex-600.ttf', 'Plex', 'bold');
  doc.addFileToVFS('serif-400.ttf', serif); doc.addFont('serif-400.ttf', 'Serif', 'normal');
  doc.setProperties({ title: `Смета ${estimateNumber(e)} — Метр`, author: 'Метр (демо)', subject: 'Смета на ремонт квартиры' });

  const p = e.params;
  const L = 18; const R = 192; const W = R - L;
  const set = (size: number, color = INK, font: 'Plex' | 'Serif' = 'Plex', style = 'normal') => {
    doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color);
  };
  const hair = (y: number, c = LINE, w = 0.2) => { doc.setDrawColor(...c); doc.setLineWidth(w); doc.line(L, y, R, y); };

  // шапка
  set(30, INK, 'Serif'); doc.text('Метр', L, 26);
  set(8, MUTE); doc.text('РЕМОНТ КВАРТИР · НИЖНИЙ НОВГОРОД', L, 32);
  set(8, CLAY); doc.text('ДЕМО-КОНЦЕПТ, БИЗНЕС ВЫМЫШЛЕННЫЙ', R, 20, { align: 'right' });
  set(9, SOFT);
  doc.text(`Смета ${estimateNumber(e)}`, R, 26, { align: 'right' });
  doc.text(new Date(e.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), R, 31, { align: 'right' });
  hair(37, INK, 0.5);

  // заголовок и параметры
  set(20, INK, 'Serif'); doc.text('Смета на ремонт квартиры', L, 50);
  set(9.5, SOFT); doc.text(describeParams(p), L, 57);

  const house = catalog.houseTypes.find((h) => h.id === p.house)!;
  const rows: [string, string][] = [
    ['Дом', `${house.name}, ${house.years}`],
    ['Площадь', fmtArea(p.area)],
    ['Комнат / санузлов', `${p.rooms} / ${p.bathrooms}`],
    ['Тип ремонта', catalog.renovationTypes.find((t) => t.id === p.type)!.name],
    ['Уровень материалов', catalog.budgetLevels.find((l) => l.id === p.level)!.name],
    ['Дополнительно', p.options.length ? p.options.map((o) => catalog.options.find((x) => x.id === o)!.name.toLowerCase()).join(', ') : 'нет'],
    ['Срок', fmtWeeks(e.weeks.min, e.weeks.max)],
  ];
  let y = 68;
  rows.forEach(([k, v]) => {
    set(8.5, MUTE); doc.text(k, L, y);
    set(9.5, INK); doc.text(doc.splitTextToSize(v, 70), L + 38, y);
    y += v.length > 40 ? 10 : 6.4;
  });

  // планировка
  const bx = 132; const by = 62; const bw = 60; const bh = 46;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.rect(bx - 2, by - 4, bw + 4, bh + 10);
  const inside = plan.items.filter((r) => r.kind !== 'balcony');
  const k = Math.min(bw / plan.width, (bh - 4) / plan.depth);
  const ox = bx + (bw - plan.width * k) / 2; const oy = by + (bh - 4 - plan.depth * k) / 2;
  doc.setDrawColor(...INK);
  inside.forEach((r) => r.rects.forEach((q) => { doc.setLineWidth(0.25); doc.rect(ox + q.x * k, oy + q.y * k, q.w * k, q.h * k); }));
  doc.setLineWidth(0.7); doc.rect(ox, oy, plan.width * k, plan.depth * k);
  set(6.5, MUTE); doc.text(plan.scaled || !p.planId ? 'УСЛОВНАЯ ПЛАНИРОВКА' : 'ТИПОВАЯ ПЛАНИРОВКА, ПРИМЕРНО', bx, by + bh + 3);

  // таблица этапов
  y = Math.max(y, 116) + 4;
  hair(y - 6, INK, 0.4);
  set(7.5, MUTE);
  doc.text('ЭТАП', L, y - 1.5); doc.text('ДОЛЯ', 150, y - 1.5, { align: 'right' }); doc.text('СУММА', R, y - 1.5, { align: 'right' });
  y += 5;
  e.lines.forEach((l) => {
    set(10, INK, 'Plex', 'bold'); doc.text(l.title, L, y);
    set(7.5, SOFT);
    const inc = doc.splitTextToSize(l.includes.slice(0, 4).join(' · '), 96);
    doc.text(inc, L, y + 4.4);
    // полоска доли
    doc.setFillColor(...STONE); doc.rect(118, y - 2.6, 24, 2.2, 'F');
    doc.setFillColor(...(l.kind === 'materials' ? CLAY : INK)); doc.rect(118, y - 2.6, Math.max(0.6, 24 * l.share), 2.2, 'F');
    set(9, SOFT); doc.text(`${Math.round(l.share * 100)}%`, 150, y, { align: 'right' });
    set(10, INK); doc.text(rub(l.amount), R, y, { align: 'right' });
    y += 6 + inc.length * 3.4;
    hair(y - 3);
    y += 2;
  });

  // итоги
  y += 2;
  set(9, SOFT); doc.text('Работы', 130, y); doc.text(rub(e.worksTotal), R, y, { align: 'right' });
  y += 5.5; doc.text('Материалы', 130, y); doc.text(rub(e.materialsTotal), R, y, { align: 'right' });
  y += 9;
  set(9, MUTE); doc.text('ИТОГО, ОТ', 130, y - 1);
  set(20, CLAY, 'Serif'); doc.text(rub(e.total), R, y + 1, { align: 'right' });
  y += 6; set(8.5, SOFT); doc.text(`${rub(e.perM2)} за м²`, R, y, { align: 'right' });

  const footer = () => {
    hair(281);
    set(7.5, MUTE);
    const c = texts?.contacts;
    doc.text(c ? `${c.phone} · ${c.email} · ${c.hours}` : 'Метр', L, 286);
    doc.text('Демо-концепт, бизнес вымышленный. Документ сформирован в браузере.', R, 286, { align: 'right' });
  };

  // платежи
  y += 12;
  if (y > 222) { footer(); doc.addPage(); y = 24; }
  set(12, INK, 'Serif'); doc.text('Оплата по этапам', L, y);
  y += 7;
  const segW = W / e.payments.length;
  e.payments.forEach((pay, i) => {
    const x = L + i * segW;
    doc.setFillColor(...(i === 0 ? CLAY : STONE)); doc.rect(x, y, segW - 1.5, 2.4, 'F');
    set(14, INK, 'Serif'); doc.text(`${pay.percent}%`, x, y + 10);
    set(8.5, INK); doc.text(rub(pay.amount), x, y + 15.5);
    set(7.5, SOFT); doc.text(doc.splitTextToSize(pay.after, segW - 4), x, y + 20);
  });
  y += 32;

  // обещание
  doc.setFillColor(...STONE); doc.roundedRect(L, y, W, 18, 2, 2, 'F');
  set(11, INK, 'Serif'); doc.text(`${texts?.fixedPromise ?? 'Смета фиксируется в договоре. Цена не изменится'}.`, L + 6, y + 7.5);
  set(7.5, SOFT); doc.text('Это предварительный расчёт «от» по типовой планировке. Точную смету инженер составит после бесплатного замера.', L + 6, y + 13);

  footer();

  doc.save(`Смета-${estimateNumber(e)}-Метр.pdf`);
}
