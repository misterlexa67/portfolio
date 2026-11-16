import { useMemo } from 'react';
import type { BudgetLevel } from '../../api';
import { boxShapes, poly, pt, sortBoxes, type BoxItem, type Shape } from './engine';
import { PALETTES } from './materials';
import './iso.css';

/* Одна и та же гостиная в трёх бюджетах. Все три варианта нарисованы сразу, переключение — кроссфейд. */

const W = 4.6; const D = 4.2; const H = 2.7;

interface Variant { key: BudgetLevel; shapes: Shape[] }

function quad(pts: [number, number, number][], fill: string, stroke?: string, sw = 0.5): Shape {
  return { kind: 'poly', pts: poly(pts), fill, stroke, sw };
}

function buildRoom(level: BudgetLevel): Shape[] {
  const p = PALETTES[level];
  const L = p.line;
  const out: Shape[] = [];
  const T = 0.14;
  // плита
  out.push(...boxShapes({ x0: -T, y0: -T, z0: -0.2, x1: W, y1: D, z1: 0 }, [p.slab, p.slabL, p.slabR], L));
  // пол
  out.push(quad([[0, 0, 0.01], [W, 0, 0.01], [W, D, 0.01], [0, D, 0.01]], `url(#iso-wood-${level})`, L, 0.4));
  // стены: левая (x=0) и задняя (y=0)
  const accentWall = level === 'economy' ? p.wallR : level === 'standard' ? '#B9B5A6' : '#8C7A66';
  out.push(quad([[0, 0, 0], [0, D, 0], [0, D, H], [0, 0, H]], accentWall, L));
  out.push(quad([[0, 0, 0], [W, 0, 0], [W, 0, H], [0, 0, H]], p.wallL, L));
  // торцы стен (срез)
  out.push(quad([[-T, -T, H], [W, -T, H], [W, 0, H], [0, 0, H], [0, D, H], [-T, D, H]], '#FBF9F5', L, 0.6));
  out.push(quad([[W, -T, 0], [W, 0, 0], [W, 0, H], [W, -T, H]], p.wallBareR, L));
  out.push(quad([[-T, D, 0], [0, D, 0], [0, D, H], [-T, D, H]], p.wallBareL, L));
  // премиум: шпонированные панели на акцентной стене
  if (level === 'premium') {
    for (let y = 0.3; y < D; y += 0.3) out.push({ kind: 'line', pts: poly([[0.005, y, 0.02], [0.005, y, H - 0.02]]), stroke: 'rgba(35,33,30,0.25)', sw: 0.6 });
    out.push({ kind: 'line', pts: poly([[0.01, 0.2, H - 0.12], [0.01, D - 0.2, H - 0.12]]), stroke: '#FFE6B8', sw: 2.2 }); // световая линия
  }
  if (level === 'standard') {
    out.push(quad([[0.005, 0, 0], [0.005, D, 0], [0.005, D, 1.0], [0.005, 0, 1.0]], 'rgba(255,255,255,0.08)', undefined));
  }
  // плинтус
  const skirt = level === 'premium' ? 0.12 : 0.07;
  out.push(quad([[0.01, 0.01, 0], [W, 0.01, 0], [W, 0.01, skirt], [0.01, 0.01, skirt]], level === 'premium' ? '#6F6457' : '#FFFFFF', L, 0.4));
  out.push(quad([[0.01, 0.01, 0], [0.01, D, 0], [0.01, D, skirt], [0.01, 0.01, skirt]], level === 'premium' ? '#5F564B' : '#F4F2EE', L, 0.4));
  // окно на задней стене
  const wx0 = 2.65; const wx1 = 4.05; const wz0 = 0.85; const wz1 = 2.35;
  out.push(quad([[wx0, 0.01, wz0], [wx1, 0.01, wz0], [wx1, 0.01, wz1], [wx0, 0.01, wz1]], p.glass, p.lineDark, 0.9));
  out.push({ kind: 'line', pts: poly([[(wx0 + wx1) / 2, 0.012, wz0], [(wx0 + wx1) / 2, 0.012, wz1]]), stroke: p.lineDark, sw: 0.8 });
  out.push(...boxShapes({ x0: wx0 - 0.08, x1: wx1 + 0.08, y0: 0, y1: 0.22, z0: wz0 - 0.05, z1: wz0 }, ['#FFFFFF', '#F2EFE9', '#DEDAD2'], L));
  if (level !== 'economy') {
    const c = level === 'premium' ? '#D9CDBD' : '#EEE7DC';
    out.push(quad([[wx0 - 0.42, 0.06, 0.05], [wx0 - 0.1, 0.06, 0.05], [wx0 - 0.1, 0.06, 2.55], [wx0 - 0.42, 0.06, 2.55]], c, L, 0.4));
    out.push(quad([[wx1 + 0.1, 0.06, 0.05], [wx1 + 0.4, 0.06, 0.05], [wx1 + 0.4, 0.06, 2.55], [wx1 + 0.1, 0.06, 2.55]], c, L, 0.4));
  }
  // картина над диваном
  if (level !== 'economy') {
    out.push(quad([[0.7, 0.02, 1.35], [1.9, 0.02, 1.35], [1.9, 0.02, 2.1], [0.7, 0.02, 2.1]], level === 'premium' ? '#2E2B27' : '#F8F4EE', L, 0.7));
    out.push(quad([[0.82, 0.025, 1.47], [1.78, 0.025, 1.47], [1.78, 0.025, 1.98], [0.82, 0.025, 1.98]], level === 'premium' ? '#B8693F' : '#D9CDBB', undefined));
  }

  // ковёр
  const rugC = level === 'economy' ? '#E5E1D9' : level === 'standard' ? '#D9CDBB' : '#B4A28A';
  out.push(quad([[0.5, 1.2, 0.02], [2.9, 1.2, 0.02], [2.9, 3.1, 0.02], [0.5, 3.1, 0.02]], rugC, L, 0.4));

  // мебель
  const boxes: BoxItem[] = [];
  const add = (key: string, b: BoxItem['box'], c: [string, string, string]) => boxes.push({ key, layer: 'furniture', box: b, colors: c, line: L });
  add('sofa', { x0: 0.45, x1: 2.6, y0: 0.16, y1: 1.06, z0: 0, z1: 0.42 }, p.fabric);
  add('sofa-back', { x0: 0.45, x1: 2.6, y0: 0.16, y1: 0.38, z0: 0.42, z1: 0.84 }, p.fabric);
  add('arm1', { x0: 0.45, x1: 0.65, y0: 0.38, y1: 1.06, z0: 0.42, z1: 0.6 }, p.fabric);
  add('arm2', { x0: 2.4, x1: 2.6, y0: 0.38, y1: 1.06, z0: 0.42, z1: 0.6 }, p.fabric);
  add('cushion', { x0: 0.75, x1: 1.2, y0: 0.4, y1: 0.52, z0: 0.42, z1: 0.74 }, p.accent);
  if (level !== 'economy') add('cushion2', { x0: 1.9, x1: 2.3, y0: 0.4, y1: 0.52, z0: 0.42, z1: 0.72 }, p.pillow);
  add('table', { x0: 1.1, x1: 2.1, y0: 1.65, y1: 2.25, z0: 0.3, z1: 0.38 }, p.wood);
  add('table-leg', { x0: 1.5, x1: 1.7, y0: 1.85, y1: 2.05, z0: 0, z1: 0.3 }, p.wood);
  // стеллаж на акцентной стене
  if (level === 'premium') {
    add('built-in', { x0: 0.0, x1: 0.42, y0: 2.3, y1: 4.1, z0: 0, z1: 0.55 }, p.cabinet);
    add('built-in-top', { x0: 0.0, x1: 0.32, y0: 2.3, y1: 4.1, z0: 1.7, z1: 1.76 }, p.wood);
  } else {
    add('shelf', { x0: 0.0, x1: 0.36, y0: 2.6, y1: 3.8, z0: 0, z1: level === 'economy' ? 1.2 : 0.7 }, p.cabinet);
  }
  // кресло
  if (level !== 'economy') {
    add('chair', { x0: 3.3, x1: 4.1, y0: 2.3, y1: 3.1, z0: 0, z1: 0.42 }, level === 'premium' ? p.accent : p.fabric);
    add('chair-back', { x0: 3.88, x1: 4.1, y0: 2.3, y1: 3.1, z0: 0.42, z1: 0.82 }, level === 'premium' ? p.accent : p.fabric);
  }
  // торшер
  add('lamp-base', { x0: 2.75, x1: 2.95, y0: 0.35, y1: 0.55, z0: 0, z1: 0.04 }, p.metal);
  add('lamp-pole', { x0: 2.83, x1: 2.87, y0: 0.43, y1: 0.47, z0: 0.04, z1: 1.35 }, p.metal);
  add('lamp-shade', { x0: 2.68, x1: 3.02, y0: 0.28, y1: 0.62, z0: 1.35, z1: 1.62 }, level === 'premium' ? ['#E6C79B', '#C9A26E', '#B08D57'] : ['#FFFFFF', '#F3EFE8', '#E2DDD4']);
  // растение
  add('pot', { x0: 4.05, x1: 4.4, y0: 0.35, y1: 0.7, z0: 0, z1: 0.32 }, level === 'economy' ? p.ceramic : p.cabinet);
  add('leaves', { x0: 3.98, x1: 4.47, y0: 0.28, y1: 0.77, z0: 0.32, z1: level === 'economy' ? 0.8 : 1.15 }, p.plant);
  for (const b of sortBoxes(boxes)) out.push(...boxShapes(b.box, b.colors, L));

  // свет: пятно на полу, подвес
  const [gx, gy] = pt(1.6, 1.9, 0.03);
  out.push({ kind: 'ellipse', cx: gx, cy: gy, rx: 1.2247 * 1.5 * 34, ry: 0.7071 * 1.5 * 34, fill: 'url(#iso-glow)', op: level === 'economy' ? 0.6 : 1 });
  const [ax, ay] = pt(1.6, 1.95, H); const [bx, by] = pt(1.6, 1.95, level === 'premium' ? 1.8 : 2.05);
  out.push({ kind: 'line', pts: `${ax},${ay} ${bx},${by}`, stroke: p.lineDark, sw: 0.8 });
  const lw = level === 'premium' ? 16 : level === 'standard' ? 11 : 5;
  if (level === 'economy') out.push({ kind: 'ellipse', cx: bx, cy: by + 4, rx: 4, ry: 5, fill: '#FFF4D9', op: 1 });
  else out.push({ kind: 'poly', pts: `${bx - lw},${by + 9} ${bx + lw},${by + 9} ${bx + lw * 0.3},${by} ${bx - lw * 0.3},${by}`, fill: p.lamp, stroke: L, sw: 0.5 });
  return out;
}

export function IsoRoom({ level }: { level: BudgetLevel }) {
  const variants: Variant[] = useMemo(() => (['economy', 'standard', 'premium'] as const).map((k) => ({ key: k, shapes: buildRoom(k) })), []);
  const c = [pt(0, 0, H + 0.2), pt(W, 0, H), pt(0, D, H), pt(W, D, -0.3), pt(-0.2, D, -0.2), pt(W, -0.2, -0.2)];
  const xs = c.map((v) => v[0]); const ys = c.map((v) => v[1]);
  const pad = 10;
  const vb = `${Math.min(...xs) - pad} ${Math.min(...ys) - pad} ${Math.max(...xs) - Math.min(...xs) + pad * 2} ${Math.max(...ys) - Math.min(...ys) + pad * 2}`;
  return (
    <svg className="iso iso-room" viewBox={vb} role="img" aria-label={`Гостиная в уровне «${level === 'economy' ? 'Эконом' : level === 'standard' ? 'Стандарт' : 'Премиум'}»`}>
      {variants.map((v) => (
        <g key={v.key} className={`room-v${v.key === level ? ' on' : ''}`}>
          {v.shapes.map((s, i) => s.kind === 'ellipse'
            ? <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.op} />
            : s.kind === 'line'
              ? <polyline key={i} points={s.pts} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" />
              : <polygon key={i} points={s.pts} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} strokeLinejoin="round" />)}
        </g>
      ))}
    </svg>
  );
}
