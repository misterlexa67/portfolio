import { api, catalog, encodeShare, type Estimate, type FloorPlan, type SiteTexts } from '../api';
import { rub, area as fmtArea, weeks as fmtWeeks, parseDate } from '../lib/format';

/* Фирменный PDF сметы прямо в браузере: обложка, планировка, этапы с объёмами, график оплаты, QR на этот расчёт.
   jsPDF и генератор QR — с cdnjs, точные версии, грузятся по клику.
   Стандартные шрифты jsPDF не умеют кириллицу — подключаем IBM Plex Sans и Noto Serif Display. */

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';

interface Doc {
  addFileToVFS(name: string, data: string): void;
  addFont(file: string, name: string, style: string): void;
  setFont(name: string, style?: string): void;
  setFontSize(n: number): void;
  setTextColor(r: number, g?: number, b?: number): void;
  setDrawColor(r: number, g?: number, b?: number): void;
  setFillColor(r: number, g?: number, b?: number): void;
  setLineWidth(n: number): void;
  setLineDashPattern(p: number[], phase: number): void;
  text(t: string | string[], x: number, y: number, o?: Record<string, unknown>): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  rect(x: number, y: number, w: number, h: number, style?: string): void;
  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style?: string): void;
  circle(x: number, y: number, r: number, style?: string): void;
  lines(l: number[][], x: number, y: number, scale?: number[], style?: string, closed?: boolean): void;
  splitTextToSize(t: string, w: number): string[];
  addPage(): void;
  save(name: string): void;
  setProperties(p: Record<string, string>): void;
}
interface QR { addData(d: string): void; make(): void; getModuleCount(): number; isDark(r: number, c: number): boolean }
declare global {
  interface Window {
    jspdf?: { jsPDF: new (o: Record<string, unknown>) => Doc };
    qrcode?: (type: number, ecl: string) => QR;
  }
}

const loaded = new Map<string, Promise<void>>();
function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (ready()) return Promise.resolve();
  const hit = loaded.get(src);
  if (hit) return hit;
  const p = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => { loaded.delete(src); reject(new Error(src)); };
    document.head.appendChild(s);
  });
  loaded.set(src, p);
  return p;
}

const fontCache = new Map<string, string>();
async function fontB64(url: string): Promise<string> {
  const hit = fontCache.get(url);
  if (hit) return hit;
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  fontCache.set(url, b64);
  return b64;
}

const INK: [number, number, number] = [35, 33, 30];
const SOFT: [number, number, number] = [92, 88, 81];
const MUTE: [number, number, number] = [111, 105, 95];
const LINE: [number, number, number] = [203, 194, 180];
const CLAY: [number, number, number] = [173, 79, 45];
const STONE: [number, number, number] = [233, 227, 217];
const PAPER: [number, number, number] = [246, 242, 236];

export const estimateNumber = (e: Estimate) => {
  const h = [...`${e.createdAt}${e.total}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `М-${String(h % 9000 + 1000)}`;
};

export async function downloadEstimatePdf(e: Estimate, plan: FloorPlan, texts: SiteTexts | undefined, opts: { start?: string; base?: string } = {}) {
  const base = opts.base ?? './';
  await Promise.all([loadScript(JSPDF_URL, () => !!window.jspdf), loadScript(QR_URL, () => !!window.qrcode)]);
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
  const set = (size: number, color = INK, font: 'Plex' | 'Serif' = 'Plex', style = 'normal') => { doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color); };
  const hair = (y: number, c = LINE, w = 0.2) => { doc.setDrawColor(...c); doc.setLineWidth(w); doc.line(L, y, R, y); };
  const house = catalog.houseTypes.find((h) => h.id === p.house)!;
  const type = catalog.renovationTypes.find((t) => t.id === p.type)!;
  const level = catalog.budgetLevels.find((l) => l.id === p.level)!;
  const no = estimateNumber(e);
  let page = 1;
  const footer = () => {
    hair(283);
    set(7.5, MUTE);
    const c = texts?.contacts;
    doc.text(c ? `${c.phone} · ${c.email} · ${c.hours}` : 'Метр', L, 288);
    doc.text(`Демо-концепт, бизнес вымышленный · смета ${no} · стр. ${page}`, R, 288, { align: 'right' });
  };
  const newPage = () => { footer(); doc.addPage(); page += 1; };

  /* ---------- 1. Обложка ---------- */
  doc.setFillColor(...PAPER); doc.rect(0, 0, 210, 297, 'F');
  set(30, INK, 'Serif'); doc.text('Метр', L, 28);
  set(8, MUTE); doc.text('РЕМОНТ КВАРТИР · НИЖНИЙ НОВГОРОД', L, 34);
  set(8, CLAY); doc.text('ДЕМО-КОНЦЕПТ, БИЗНЕС ВЫМЫШЛЕННЫЙ', R, 22, { align: 'right' });
  set(9, SOFT);
  doc.text(`Смета ${no}`, R, 28, { align: 'right' });
  doc.text(new Date(e.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), R, 33, { align: 'right' });
  hair(40, INK, 0.5);

  set(34, INK, 'Serif'); doc.text(['Смета на ремонт', 'квартиры'], L, 62);
  set(12, SOFT); doc.text(`${house.name}, ${p.rooms}-комн., ${fmtArea(p.area)} · ${type.name} · «${level.name}»`, L, 86);

  // планировка крупно, с дверями
  const bx = L; const by = 96; const bw = W; const bh = 104;
  doc.setFillColor(251, 249, 245); doc.roundedRect(bx, by, bw, bh, 3, 3, 'F');
  const k = Math.min((bw - 24) / plan.width, (bh - 24) / plan.depth);
  const ox = bx + (bw - plan.width * k) / 2; const oy = by + (bh - plan.depth * k) / 2;
  doc.setDrawColor(...INK);
  plan.items.filter((r) => r.kind !== 'balcony').forEach((r) => r.rects.forEach((q) => { doc.setLineWidth(0.3); doc.rect(ox + q.x * k, oy + q.y * k, q.w * k, q.h * k); }));
  doc.setLineWidth(0.9); doc.rect(ox, oy, plan.width * k, plan.depth * k);
  api.plans.doors(plan).forEach((d) => {
    const x1 = ox + d.x1 * k; const y1 = oy + d.y1 * k; const x2 = ox + d.x2 * k; const y2 = oy + d.y2 * k;
    doc.setDrawColor(251, 249, 245); doc.setLineWidth(1.4); doc.line(x1, y1, x2, y2);
    doc.setDrawColor(...SOFT); doc.setLineWidth(0.25);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (d.o === 'h') doc.line(x1, y1, x1, y1 + d.swing * len); else doc.line(x1, y1, x1 + d.swing * len, y1);
  });
  set(6.5, MUTE);
  plan.items.filter((r) => r.kind !== 'balcony').forEach((r) => {
    const q = [...r.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    if (q.w * k < 14 || q.h * k < 9) return;
    set(7, INK); doc.text(r.name.split(' ')[0], ox + (q.x + q.w / 2) * k, oy + (q.y + q.h / 2) * k - 0.5, { align: 'center' });
    set(6.5, MUTE); doc.text(`${r.area.toLocaleString('ru-RU')} м²`, ox + (q.x + q.w / 2) * k, oy + (q.y + q.h / 2) * k + 3.5, { align: 'center' });
  });
  set(6.5, MUTE); doc.text(plan.scaled || !p.planId ? 'УСЛОВНАЯ ПЛАНИРОВКА ПОД ВАШУ ПЛОЩАДЬ' : 'ТИПОВАЯ ПЛАНИРОВКА, ПРИМЕРНО', bx + 6, by + bh - 5);

  // итог и QR
  const ty = 214;
  set(9, MUTE); doc.text('ИТОГО ПОД КЛЮЧ, ОТ', L, ty);
  set(30, CLAY, 'Serif'); doc.text(rub(e.total), L, ty + 13);
  set(10, SOFT); doc.text(`${rub(e.perM2)} за м² · срок ${fmtWeeks(e.weeks.min, e.weeks.max)}`, L, ty + 21);
  set(9, SOFT); doc.text([`Работы — ${rub(e.worksTotal)}`, `Материалы — ${rub(e.materialsTotal)}`], L, ty + 30);
  const url = `${window.location.origin}${window.location.pathname}?${encodeShare(e)}#smeta`;
  const qr = window.qrcode!(0, 'M'); qr.addData(url); qr.make();
  const n = qr.getModuleCount(); const qs = 38; const cell = qs / n; const qx = R - qs; const qy = ty - 6;
  doc.setFillColor(255, 255, 255); doc.rect(qx - 3, qy - 3, qs + 6, qs + 6, 'F');
  doc.setFillColor(...INK);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(qx + c * cell, qy + r * cell, cell + 0.02, cell + 0.02, 'F');
  set(7.5, SOFT); doc.text(doc.splitTextToSize('Наведите камеру — откроется этот расчёт с той же квартирой', 50), R, qy + qs + 8, { align: 'right' });
  doc.setFillColor(...STONE); doc.roundedRect(L, 262, W, 14, 2, 2, 'F');
  set(10.5, INK, 'Serif'); doc.text(`${texts?.fixedPromise ?? 'Смета фиксируется в договоре. Цена не изменится'}.`, L + 6, 271);

  /* ---------- 2. Этапы с объёмами ---------- */
  newPage();
  let y = 26;
  set(20, INK, 'Serif'); doc.text('Этапы и объёмы работ', L, y);
  set(9, SOFT); doc.text('Объёмы посчитаны по площади и комнатам; после замера уточним до сантиметра.', L, y + 7);
  y += 18;
  const head = () => {
    hair(y - 5, INK, 0.4); set(7.5, MUTE);
    doc.text('ЭТАП / РАБОТЫ', L, y - 1); doc.text('ОБЪЁМ', 150, y - 1, { align: 'right' }); doc.text('СУММА', R, y - 1, { align: 'right' });
    y += 5;
  };
  head();
  e.lines.forEach((l) => {
    const need = 11 + l.items.length * 6.6;
    if (y + need > 272) { newPage(); y = 26; head(); }
    doc.setFillColor(...STONE); doc.rect(L, y - 5, W, 8.4, 'F');
    doc.setFillColor(...(l.kind === 'materials' ? CLAY : INK)); doc.rect(L, y - 5, 1.2, 8.4, 'F');
    set(12, INK, 'Plex', 'bold'); doc.text(l.title, L + 4, y + 0.8);
    set(9, SOFT); doc.text(`${Math.round(l.share * 100)}%`, 150, y + 0.8, { align: 'right' });
    set(12, INK, 'Plex', 'bold'); doc.text(rub(l.amount), R - 2, y + 0.8, { align: 'right' });
    y += 9.5;
    l.items.forEach((it) => {
      set(10.5, INK); doc.text(it.title, L + 4, y);
      set(10.5, SOFT); doc.text(`${it.qty.toLocaleString('ru-RU')} ${it.unit}`, 150, y, { align: 'right' });
      set(10.5, INK); doc.text(rub(it.amount), R - 2, y, { align: 'right' });
      doc.setDrawColor(...LINE); doc.setLineWidth(0.1); doc.line(L + 4, y + 2.3, R, y + 2.3);
      y += 6.6;
    });
    y += 3;
  });
  if (y > 248) { newPage(); y = 30; }
  y += 2; hair(y - 3, INK, 0.4);
  set(10.5, SOFT); doc.text('Работы', 120, y + 3); doc.text(rub(e.worksTotal), R, y + 3, { align: 'right' });
  doc.text('Материалы', 120, y + 9.5); doc.text(rub(e.materialsTotal), R, y + 9.5, { align: 'right' });
  set(10, MUTE); doc.text('ИТОГО, ОТ', 120, y + 19);
  set(20, CLAY, 'Serif'); doc.text(rub(e.total), R, y + 20, { align: 'right' });

  /* ---------- 3. График оплаты ---------- */
  newPage();
  y = 26;
  set(20, INK, 'Serif'); doc.text('График оплаты', L, y);
  const startD = opts.start ? parseDate(opts.start) : null;
  set(9, SOFT); doc.text(startD ? `Начало ремонта — ${startD.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}. Даты примерные.` : 'Даты примерные — от дня старта.', L, y + 7);
  y += 20;
  e.payments.forEach((pay, i) => {
    const when = startD ? new Date(startD.getTime() + pay.dayOffset * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : `через ${Math.round(pay.dayOffset / 7)} нед.`;
    doc.setFillColor(...(i === 0 ? CLAY : STONE)); doc.rect(L, y - 7, 2.2, 34, 'F');
    set(28, INK, 'Plex', 'normal'); doc.text(`${pay.percent}%`, L + 8, y + 5);
    set(14, INK, 'Plex', 'bold'); doc.text(rub(pay.amount), R, y + 3, { align: 'right' });
    set(11, CLAY); doc.text(`≈ ${when} · ${pay.after}`, L + 46, y + 1);
    set(11, SOFT); doc.text(doc.splitTextToSize(`Готово: ${pay.ready}`, 110), L + 46, y + 8.5);
    y += 46;
  });
  doc.setFillColor(...STONE); doc.roundedRect(L, y, W, 22, 2, 2, 'F');
  set(11, INK, 'Serif'); doc.text(`${texts?.fixedPromise ?? 'Смета фиксируется в договоре. Цена не изменится'}.`, L + 6, y + 8);
  set(8, SOFT); doc.text(doc.splitTextToSize('Каждый следующий платёж — только после того, как вы приняли этап по чек-листу. Это расчёт «от» по типовой планировке; точную смету инженер пришлёт после бесплатного замера.', W - 12), L + 6, y + 14);
  footer();

  doc.save(`Смета-${no}-Метр.pdf`);
}
