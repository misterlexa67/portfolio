import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BRIDGES, LANDMARKS, MAP_H, MAP_W, OKA, OKA_WIDTH, VOLGA, VOLGA_WIDTH, type Point, type Zone } from '../api';

/** Сглаживание ломаной: Catmull-Rom → кубические Безье. */
export function smoothPath(pts: Point[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}
const poly = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
const line = (pts: Point[]) => `M${pts.map((p) => `${p.x},${p.y}`).join(' L')}`;

const ROADS: Point[][] = [
  [{ x: 548, y: 262 }, { x: 578, y: 330 }, { x: 604, y: 392 }],
  [{ x: 604, y: 392 }, { x: 640, y: 520 }, { x: 700, y: 640 }, { x: 740, y: 700 }],
  [{ x: 660, y: 262 }, { x: 800, y: 300 }, { x: 1000, y: 330 }],
  [{ x: 610, y: 410 }, { x: 760, y: 460 }, { x: 1000, y: 520 }],
  [{ x: 520, y: 300 }, { x: 640, y: 296 }, { x: 720, y: 270 }],
  [{ x: 432, y: 302 }, { x: 300, y: 300 }, { x: 140, y: 290 }, { x: 0, y: 300 }],
  [{ x: 440, y: 408 }, { x: 360, y: 470 }, { x: 260, y: 590 }, { x: 180, y: 700 }],
  [{ x: 300, y: 300 }, { x: 250, y: 240 }, { x: 60, y: 220 }],
  [{ x: 330, y: 470 }, { x: 160, y: 540 }, { x: 0, y: 560 }],
];

const DISTRICT_LABELS: { name: string; p: Point }[] = [
  { name: 'НИЖЕГОРОДСКИЙ', p: { x: 640, y: 352 } },
  { name: 'СОВЕТСКИЙ', p: { x: 770, y: 420 } },
  { name: 'ПРИОКСКИЙ', p: { x: 800, y: 600 } },
  { name: 'КАНАВИНСКИЙ', p: { x: 340, y: 350 } },
  { name: 'МОСКОВСКИЙ', p: { x: 200, y: 268 } },
  { name: 'ЛЕНИНСКИЙ', p: { x: 300, y: 430 } },
  { name: 'АВТОЗАВОДСКИЙ', p: { x: 150, y: 620 } },
  { name: 'БОР', p: { x: 520, y: 80 } },
];

export interface MapPin { id: string; kind: 'restaurant' | 'home' | 'pick'; point: Point; label?: string; muted?: boolean }

interface Props {
  zones?: Zone[];
  highlightZoneId?: string | null;
  pins?: MapPin[];
  route?: Point[];
  courier?: Point | null;
  onPick?: (p: Point) => void;
  focus?: Point[];
  draft?: Point[];             // контур зоны в редакторе админки
  className?: string;
  label: string;
  children?: ReactNode;
  compactLabels?: boolean;
}

/** Рамка вокруг точек с пропорциями контейнера — без лишнего зума и обрезки. */
function fitBox(points: Point[] | undefined, aspect: number): string {
  if (!points || !points.length) return `0 0 ${MAP_W} ${MAP_H}`;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const pad = 80;
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = x1 - x0, h = y1 - y0;
  // минимальный охват — около 9 км, чтобы город читался
  const minSide = 440;
  if (aspect >= 1) { h = Math.max(h, minSide); w = Math.max(w, minSide * aspect); } else { w = Math.max(w, minSide); h = Math.max(h, minSide / aspect); }
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  return `${(cx - w / 2).toFixed(0)} ${(cy - h / 2).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`;
}

export function CityMap({ zones = [], highlightZoneId, pins = [], route, courier, onPick, focus, draft, className = '', label, children, compactLabels }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [aspect, setAspect] = useState(1.4);
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setAspect(Math.round((width / height) * 20) / 20);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const viewBox = useMemo(() => fitBox(focus, aspect), [focus, aspect]);
  const zoneList = useMemo(() => zones.filter((z) => z.enabled).sort((a, b) => b.sort - a.sort), [zones]);

  const handle = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick || !svg.current) return;
    const pt = svg.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.current.getScreenCTM();
    if (!m) return;
    const p = pt.matrixTransform(m.inverse());
    onPick({ x: Math.round(p.x), y: Math.round(p.y) });
  };

  const traveled = useMemo(() => {
    if (!route || !courier) return null;
    // путь до текущей позиции курьера — для «пройденной» части маршрута
    let best = 0, bd = Infinity;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1];
      const t = Math.max(0, Math.min(1, ((courier.x - a.x) * (b.x - a.x) + (courier.y - a.y) * (b.y - a.y)) / (((b.x - a.x) ** 2 + (b.y - a.y) ** 2) || 1)));
      const px = a.x + t * (b.x - a.x), py = a.y + t * (b.y - a.y);
      const d = Math.hypot(px - courier.x, py - courier.y);
      if (d < bd) { bd = d; best = i; }
    }
    return [...route.slice(0, best + 1), courier];
  }, [route, courier]);

  return (
    <svg
      ref={svg}
      className={`city-map${onPick ? ' is-pickable' : ''} ${className}`}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label}
      onClick={handle}
    >
      <rect x={-400} y={-400} width={MAP_W + 800} height={MAP_H + 800} fill="var(--c-map-land)" />
      {/* Заволжье чуть темнее */}
      <path d={`M-400,-400 L1400,-400 L1400,${VOLGA[VOLGA.length - 1].y} ${VOLGA.slice().reverse().map((p) => `L${p.x},${p.y}`).join(' ')} L-400,${VOLGA[0].y} Z`} fill="var(--c-map-land-2)" />

      {ROADS.map((r, i) => <path key={i} d={smoothPath(r)} className="map-road" />)}

      {/* Реки */}
      <path d={smoothPath([{ x: -400, y: 160 }, ...VOLGA, { x: 1400, y: 170 }])} className="map-water-edge" strokeWidth={VOLGA_WIDTH + 3} />
      <path d={smoothPath(OKA)} className="map-water-edge" strokeWidth={OKA_WIDTH + 3} />
      <path d={smoothPath([{ x: -400, y: 160 }, ...VOLGA, { x: 1400, y: 170 }])} className="map-water" strokeWidth={VOLGA_WIDTH} />
      <path d={smoothPath(OKA)} className="map-water" strokeWidth={OKA_WIDTH} />
      <text x={150} y={186} className="map-river">Волга</text>
      <text x={372} y={560} className="map-river" transform="rotate(-52 372 560)">Ока</text>

      {BRIDGES.map((b) => <line key={b.id} x1={b.lower.x} y1={b.lower.y} x2={b.upper.x} y2={b.upper.y} className="map-bridge" />)}

      {/* Зоны доставки */}
      {zoneList.map((z) => (
        <polygon
          key={z.id}
          points={poly(z.polygon)}
          className={`map-zone map-zone--${Math.min(3, z.sort)}${highlightZoneId === z.id ? ' is-active' : ''}`}
        />
      ))}

      {!compactLabels && DISTRICT_LABELS.map((d) => <text key={d.name} x={d.p.x} y={d.p.y} className="map-district">{d.name}</text>)}
      {LANDMARKS.map((l) => (
        <g key={l.name} className="map-landmark">
          <circle cx={l.point.x} cy={l.point.y} r={3.5} />
          {!compactLabels && <text x={l.point.x + 8} y={l.point.y + 4}>{l.name}</text>}
        </g>
      ))}

      {draft && draft.length > 0 && (
        <g className="map-draft">
          {draft.length >= 3 && <polygon points={poly(draft)} />}
          {draft.length < 3 && <path d={line(draft)} />}
          {draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6} />)}
        </g>
      )}

      {route && route.length > 1 && (
        <g>
          <path d={line(route)} className="map-route" />
          {traveled && <path d={line(traveled)} className="map-route-done" />}
        </g>
      )}

      {pins.map((p) => (
        <g key={p.id} className={`map-pin map-pin--${p.kind}${p.muted ? ' is-muted' : ''}`} transform={`translate(${p.point.x} ${p.point.y})`}>
          {p.kind === 'restaurant' && (
            <>
              <circle r={15} className="map-pin__halo" />
              <circle r={11} className="map-pin__dot" />
              <path d="M-3.5 -5v4.5M-5.5 -5v2.6a2 2 0 0 0 4 0V-5M-3.5 -0.5v6M4 5.5V-5c-1.6.8-2.5 2.6-2.5 5V1.5H4" className="map-pin__glyph" />
            </>
          )}
          {(p.kind === 'home' || p.kind === 'pick') && (
            <g className="map-pin__drop">
              <ellipse cx={0} cy={2} rx={7} ry={2.5} className="map-pin__shadow" />
              <path d="M0 0c-8-9-13-14-13-21a13 13 0 0 1 26 0c0 7-5 12-13 21z" className="map-pin__body" />
              <circle cx={0} cy={-21} r={4.5} className="map-pin__hole" />
            </g>
          )}
          {p.label && <text y={p.kind === 'restaurant' ? -22 : -42} className="map-pin__label">{p.label}</text>}
        </g>
      ))}

      {courier && (
        <g className="map-courier" transform={`translate(${courier.x} ${courier.y})`}>
          <circle r={22} className="map-courier__pulse" />
          <circle r={15} className="map-courier__dot" />
          <g transform="translate(-9 -9) scale(0.75)" className="map-courier__glyph">
            <circle cx="6" cy="17.5" r="2.25" /><circle cx="18" cy="17.5" r="2.25" />
            <path d="M8.25 17.5h7.5l-2-8.5H16M13.75 9 11 6.5H9M18 17.5 16.5 9" />
          </g>
        </g>
      )}
      {children}
    </svg>
  );
}
