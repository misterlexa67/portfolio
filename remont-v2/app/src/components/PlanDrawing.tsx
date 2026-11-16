import { useEffect, useMemo, useRef } from 'react';
import { api, type FloorPlan, type PlanRoom } from '../api';
import { drawLines } from '../lib/motion';
import './plan.css';

/* Типовая планировка как чертёж: стены, окна, двери с дугой открывания, сантехника и кухня тонкими линиями.
   Линии прорисовываются при смене планировки; комнаты кликабельны. Единицы — сантиметры. */

const U = 100;
const fmtA = (a: number) => a.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const mainRect = (room: PlanRoom) => [...room.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];

/** Сантехника и кухня — тонкими линиями, как на чертеже. */
function Fixtures({ room, hasWc }: { room: PlanRoom; hasWc: boolean }) {
  const R = mainRect(room);
  const along = R.w >= R.h * 0.8 ? 'x' : 'y';
  const span = along === 'x' ? R.w : R.h;
  const deep = along === 'x' ? R.h : R.w;
  // прямоугольник в локальных координатах «вдоль/поперёк» → см
  const rect = (u0: number, v0: number, u1: number, v1: number) => along === 'x'
    ? { x: (R.x + u0) * U, y: (R.y + v0) * U, w: (u1 - u0) * U, h: (v1 - v0) * U }
    : { x: (R.x + v0) * U, y: (R.y + u0) * U, w: (v1 - v0) * U, h: (u1 - u0) * U };
  const pt = (u: number, v: number) => along === 'x' ? [(R.x + u) * U, (R.y + v) * U] : [(R.x + v) * U, (R.y + u) * U];
  const out: JSX.Element[] = [];
  const toilet = (k: string, u: number) => {
    const t = rect(u - 0.2, 0.06, u + 0.2, 0.24);
    const [cx, cy] = pt(u, 0.48);
    out.push(<rect key={`${k}t`} {...{ x: t.x, y: t.y, width: t.w, height: t.h }} rx={4} />);
    out.push(<ellipse key={`${k}b`} cx={cx} cy={cy} rx={along === 'x' ? 17 : 23} ry={along === 'x' ? 23 : 17} />);
  };
  if (room.kind === 'bath') {
    const tub = Math.min(1.7, span - 0.1);
    if (tub > 1.2 && deep > 1.2) {
      const t = rect(0.05, 0.05, tub, 0.78);
      const i = rect(0.15, 0.13, tub - 0.1, 0.7);
      out.push(<rect key="tub" x={t.x} y={t.y} width={t.w} height={t.h} rx={6} />);
      out.push(<rect key="tubin" x={i.x} y={i.y} width={i.w} height={i.h} rx={22} />);
      const [dx, dy] = pt(tub - 0.25, 0.42);
      out.push(<circle key="drain" cx={dx} cy={dy} r={3} />);
    } else {
      const s = rect(0.05, 0.05, Math.min(0.95, span - 0.1), Math.min(0.95, deep - 0.1));
      out.push(<rect key="shower" x={s.x} y={s.y} width={s.w} height={s.h} />);
      out.push(<line key="sh1" x1={s.x} y1={s.y} x2={s.x + s.w} y2={s.y + s.h} />);
      out.push(<line key="sh2" x1={s.x + s.w} y1={s.y} x2={s.x} y2={s.y + s.h} />);
    }
    if (deep > 1.3) {
      const sk = rect(span - 0.6, deep - 0.45, span - 0.1, deep - 0.05);
      const [cx, cy] = pt(span - 0.35, deep - 0.25);
      out.push(<rect key="sink" x={sk.x} y={sk.y} width={sk.w} height={sk.h} rx={5} />);
      out.push(<ellipse key="sinkb" cx={cx} cy={cy} rx={14} ry={10} />);
    }
    if (!hasWc && span > 1.6) toilet('wc', Math.min(span - 0.35, tub + 0.4 > span - 0.3 ? span - 0.35 : tub + 0.35));
  }
  if (room.kind === 'wc') toilet('wc', span / 2);
  if (room.kind === 'kitchen') {
    const len = Math.min(span - 0.15, 3.2);
    const c = rect(0.05, 0.05, len, 0.65);
    out.push(<rect key="counter" x={c.x} y={c.y} width={c.w} height={c.h} />);
    // варочная панель: 4 конфорки
    const hu = Math.min(0.75, len * 0.3);
    [[hu - 0.13, 0.22], [hu + 0.13, 0.22], [hu - 0.13, 0.46], [hu + 0.13, 0.46]].forEach(([u, v], i) => {
      const [cx, cy] = pt(u, v);
      out.push(<circle key={`hob${i}`} cx={cx} cy={cy} r={i < 2 ? 8 : 6} />);
    });
    // мойка
    const s = rect(len * 0.62, 0.14, len * 0.62 + 0.5, 0.56);
    const [mx, my] = pt(len * 0.62 + 0.25, 0.35);
    out.push(<rect key="ksink" x={s.x} y={s.y} width={s.w} height={s.h} rx={6} />);
    out.push(<circle key="kdrain" cx={mx} cy={my} r={3} />);
  }
  return <g className="pl-fix" data-fade>{out}</g>;
}

export function PlanDrawing({ plan, selected, hovered, onSelect, onHover, animate = true, compact, drawKey }: {
  plan: FloorPlan; selected?: string | null; hovered?: string | null;
  onSelect?: (id: string | null) => void; onHover?: (id: string | null) => void;
  animate?: boolean; compact?: boolean;
  /** ключ прорисовки: линии рисуются заново только при смене дома/комнат, а не при движении ползунка */
  drawKey?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => (animate ? drawLines(ref.current, { duration: 0.7, stagger: 0.025 }) : undefined), [drawKey ?? plan.id, animate]); // eslint-disable-line react-hooks/exhaustive-deps
  const doors = useMemo(() => api.plans.doors(plan), [plan]);
  const hasWc = plan.items.some((r) => r.kind === 'wc');

  const W = plan.width * U; const D = plan.depth * U;
  const balcony = plan.items.filter((r) => r.kind === 'balcony');
  const minY = Math.min(0, ...balcony.flatMap((b) => b.rects.map((q) => q.y * U)));
  const fs = Math.max(W, D * 1.3) * 0.026;
  const pad = fs * 4.2;
  const vb = `${-pad} ${minY - pad} ${W + pad * 2} ${D - minY + pad * 2}`;

  const label = (room: PlanRoom) => {
    const q = mainRect(room);
    const cx = (q.x + q.w / 2) * U; const cy = (q.y + q.h / 2) * U;
    const small = q.w < 1.5 || q.h < 1.3;
    const nameFs = small ? fs * 0.72 : fs;
    const fitsW = (t: string) => t.length * nameFs * 0.56 <= q.w * U * 0.92;
    const tallEnough = q.h * U >= nameFs * 2.6;
    const SHORT: Record<string, string> = { bath: 'Санузел', wc: 'Туалет', storage: 'Кладовая', hall: 'Прихожая', kitchen: 'Кухня' };
    const candidates = small ? [room.name, room.name.split(' ').slice(-1)[0], SHORT[room.kind] ?? room.name, room.kind === 'bath' ? 'С/у' : ''] : [room.name];
    const fitName = candidates.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).find((t) => t && fitsW(t));
    // в комнатах с сантехникой подпись чуть ниже центра, чтобы не лечь на приборы
    // в комнатах с сантехникой подпись — в свободной части, подальше от приборов у задней стены
    const wet = ['bath', 'wc', 'kitchen'].includes(room.kind);
    const shift = wet ? (q.h * U > fs * 5 ? q.h * U * 0.22 : q.h * U * 0.18) : 0;
    return { cx, cy: cy + shift, small, nameFs, showName: !small || (tallEnough && !!fitName), shortName: fitName ?? room.name };
  };

  const windows = plan.items.filter((r) => ['living', 'bedroom', 'kitchen'].includes(r.kind)).flatMap((r) => r.rects.flatMap((q, i) => {
    const out: JSX.Element[] = [];
    if (Math.abs(q.y) < 0.02) {
      const w = Math.min(1.5, q.w * 0.45) * U; const x = (q.x + q.w / 2) * U - w / 2;
      out.push(<g key={`${r.id}-${i}-t`} className="pl-win"><rect x={x} y={-9} width={w} height={18} /><line x1={x} x2={x + w} y1={0} y2={0} /></g>);
    }
    if (Math.abs(q.y + q.h - plan.depth) < 0.02 && r.kind === 'kitchen') {
      const w = Math.min(1.4, q.w * 0.45) * U; const x = (q.x + q.w / 2) * U - w / 2;
      out.push(<g key={`${r.id}-${i}-b`} className="pl-win"><rect x={x} y={D - 9} width={w} height={18} /><line x1={x} x2={x + w} y1={D} y2={D} /></g>);
    }
    return out;
  }));

  const active = hovered ?? selected;

  return (
    <svg ref={ref} className={`plan${compact ? ' plan-compact' : ''}`} viewBox={vb} role="group" aria-label={`Планировка: ${plan.items.filter((r) => r.kind !== 'balcony').map((r) => `${r.name} ${fmtA(r.area)} м²`).join(', ')}`}>
      {plan.items.map((room) => {
        const sel = active === room.id;
        const isBalcony = room.kind === 'balcony';
        const interactive = !!onSelect && !isBalcony;
        return (
          <g
            key={room.id}
            className={`pl-room${sel ? ' sel' : ''}${isBalcony ? ' balc' : ''}${interactive ? ' click' : ''}`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? selected === room.id : undefined}
            aria-label={interactive ? `${room.name}, ${fmtA(room.area)} м²` : undefined}
            onClick={interactive ? () => onSelect!(selected === room.id ? null : room.id) : undefined}
            onPointerEnter={interactive && onHover ? (e) => { if (e.pointerType === 'mouse') onHover(room.id); } : undefined}
            onPointerLeave={interactive && onHover ? () => onHover(null) : undefined}
            onFocus={interactive && onHover ? () => onHover(room.id) : undefined}
            onBlur={interactive && onHover ? () => onHover(null) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(selected === room.id ? null : room.id); } } : undefined}
          >
            {room.rects.map((q, i) => <rect key={i} x={q.x * U} y={q.y * U} width={q.w * U} height={q.h * U} className="pl-fill" data-fade />)}
            {room.rects.map((q, i) => <rect key={`l${i}`} x={q.x * U} y={q.y * U} width={q.w * U} height={q.h * U} className="pl-line" pathLength={1} data-draw />)}
          </g>
        );
      })}
      <rect x={0} y={0} width={W} height={D} className="pl-outer" pathLength={1} data-draw />
      {windows}

      {/* двери: проём в стене, полотно и дуга открывания */}
      <g className="pl-doors" data-fade>
        {doors.map((d, i) => {
          const x1 = d.x1 * U; const y1 = d.y1 * U; const x2 = d.x2 * U; const y2 = d.y2 * U;
          const len = Math.hypot(x2 - x1, y2 - y1);
          const leaf = d.o === 'h' ? [x1, y1 + d.swing * len] : [x1 + d.swing * len, y1];
          const sweep = d.o === 'h' ? (d.swing > 0 ? 0 : 1) : (d.swing > 0 ? 1 : 0);
          return (
            <g key={i} className={d.entrance ? 'pl-door entrance' : 'pl-door'}>
              <line className="pl-gap" x1={x1} y1={y1} x2={x2} y2={y2} />
              <line className="pl-leaf" x1={x1} y1={y1} x2={leaf[0]} y2={leaf[1]} />
              <path className="pl-arc" d={`M ${leaf[0]} ${leaf[1]} A ${len} ${len} 0 0 ${sweep} ${x2} ${y2}`} />
            </g>
          );
        })}
      </g>

      {plan.items.filter((r) => ['bath', 'wc', 'kitchen'].includes(r.kind)).map((r) => <Fixtures key={`f-${r.id}`} room={r} hasWc={hasWc} />)}

      <g className="pl-dim" data-fade>
        <line x1={0} x2={W} y1={minY - pad * 0.55} y2={minY - pad * 0.55} />
        <line x1={0} x2={0} y1={minY - pad * 0.75} y2={minY - pad * 0.35} />
        <line x1={W} x2={W} y1={minY - pad * 0.75} y2={minY - pad * 0.35} />
        <text x={W / 2} y={minY - pad * 0.55 - fs * 0.45} fontSize={fs * 0.9} textAnchor="middle">{Math.round(W * 10).toLocaleString('ru-RU')}</text>
        <line x1={-pad * 0.55} x2={-pad * 0.55} y1={0} y2={D} />
        <line x1={-pad * 0.75} x2={-pad * 0.35} y1={0} y2={0} />
        <line x1={-pad * 0.75} x2={-pad * 0.35} y1={D} y2={D} />
        <text x={-pad * 0.55 - fs * 0.45} y={D / 2} fontSize={fs * 0.9} textAnchor="middle" transform={`rotate(-90 ${-pad * 0.55 - fs * 0.45} ${D / 2})`}>{Math.round(D * 10).toLocaleString('ru-RU')}</text>
      </g>

      {plan.items.map((room) => {
        const { cx, cy, small, nameFs, showName, shortName } = label(room);
        const name = small ? shortName : room.name.length > 14 && room.rects[0].w < 2.6 ? room.name.split(' ')[0] : room.name;
        return (
          <g key={`t-${room.id}`} className={`pl-label${active === room.id ? ' sel' : ''}`} data-fade pointerEvents="none">
            {showName && <text x={cx} y={cy - nameFs * 0.25} fontSize={nameFs} textAnchor="middle" className="pl-name">{name}</text>}
            <text x={cx} y={showName ? cy + nameFs * 1.05 : cy + fs * 0.35} fontSize={fs * (small ? 0.72 : 0.92)} textAnchor="middle" className="pl-area">{fmtA(room.area)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Позиция центра комнаты в процентах от рамки SVG — для подсказки поверх чертежа. */
export function roomAnchor(plan: FloorPlan, roomId: string): { left: number; top: number } | null {
  const room = plan.items.find((r) => r.id === roomId);
  if (!room) return null;
  const W = plan.width * U; const D = plan.depth * U;
  const balcony = plan.items.filter((r) => r.kind === 'balcony');
  const minY = Math.min(0, ...balcony.flatMap((b) => b.rects.map((q) => q.y * U)));
  const fs = Math.max(W, D * 1.3) * 0.026;
  const pad = fs * 4.2;
  const q = mainRect(room);
  return {
    left: (((q.x + q.w / 2) * U + pad) / (W + pad * 2)) * 100,
    top: (((q.y) * U - (minY - pad)) / (D - minY + pad * 2)) * 100,
  };
}
