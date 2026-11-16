import { useEffect, useRef } from 'react';
import type { FloorPlan, PlanRoom } from '../api';
import { drawLines } from '../lib/motion';
import './plan.css';

/* Типовая планировка как чертёж: линии прорисовываются, комнаты кликабельны. Единицы — сантиметры. */

const U = 100;
const fmtA = (a: number) => a.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

export function PlanDrawing({ plan, selected, onSelect, animate = true, compact }: {
  plan: FloorPlan; selected?: string | null; onSelect?: (id: string | null) => void; animate?: boolean; compact?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => (animate ? drawLines(ref.current, { duration: 0.7, stagger: 0.03 }) : undefined), [plan.id, animate]);

  const W = plan.width * U; const D = plan.depth * U;
  const balcony = plan.items.filter((r) => r.kind === 'balcony');
  const minY = Math.min(0, ...balcony.flatMap((b) => b.rects.map((q) => q.y * U)));
  const fs = Math.max(W, D * 1.3) * 0.026;
  const pad = fs * 4.2;
  const vb = `${-pad} ${minY - pad} ${W + pad * 2} ${D - minY + pad * 2}`;

  const label = (room: PlanRoom) => {
    const q = [...room.rects].sort((a, b) => b.w * b.h - a.w * a.h)[0];
    const cx = (q.x + q.w / 2) * U; const cy = (q.y + q.h / 2) * U;
    const small = q.w < 1.5 || q.h < 1.3;
    // в узкой комнате подпись мельче — если влезает по ширине, показываем название
    const nameFs = small ? fs * 0.72 : fs;
    const fitsW = (t: string) => t.length * nameFs * 0.56 <= q.w * U * 0.92;
    const tallEnough = q.h * U >= nameFs * 2.6;
    // полное название → первое слово → короткое по типу комнаты
    const SHORT: Record<string, string> = { bath: 'Санузел', wc: 'Туалет', storage: 'Кладовая', hall: 'Прихожая', kitchen: 'Кухня' };
    const candidates = small ? [room.name, room.name.split(' ').slice(-1)[0], SHORT[room.kind] ?? room.name, room.kind === 'bath' ? 'С/у' : ''] : [room.name];
    const fitName = candidates.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).find((t) => t && fitsW(t));
    return { cx, cy, small, nameFs, showName: !small || (tallEnough && !!fitName), shortName: fitName ?? room.name };
  };

  // окна на наружных стенах (верхняя кромка и правая/нижняя для кухонь)
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

  return (
    <svg ref={ref} className={`plan${compact ? ' plan-compact' : ''}`} viewBox={vb} role="group" aria-label={`Планировка: ${plan.items.filter((r) => r.kind !== 'balcony').map((r) => `${r.name} ${fmtA(r.area)} м²`).join(', ')}`}>
      {/* комнаты */}
      {plan.items.map((room) => {
        const sel = selected === room.id;
        const isBalcony = room.kind === 'balcony';
        const interactive = !!onSelect && !isBalcony;
        return (
          <g
            key={room.id}
            className={`pl-room${sel ? ' sel' : ''}${isBalcony ? ' balc' : ''}${interactive ? ' click' : ''}`}
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-pressed={interactive ? sel : undefined}
            aria-label={interactive ? `${room.name}, ${fmtA(room.area)} м²` : undefined}
            onClick={interactive ? () => onSelect!(sel ? null : room.id) : undefined}
            onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect!(sel ? null : room.id); } } : undefined}
          >
            {room.rects.map((q, i) => (
              <rect key={i} x={q.x * U} y={q.y * U} width={q.w * U} height={q.h * U} className="pl-fill" data-fade />
            ))}
            {room.rects.map((q, i) => (
              <rect key={`l${i}`} x={q.x * U} y={q.y * U} width={q.w * U} height={q.h * U} className="pl-line" pathLength={1} data-draw />
            ))}
          </g>
        );
      })}
      {/* наружный контур */}
      <rect x={0} y={0} width={W} height={D} className="pl-outer" pathLength={1} data-draw />
      {windows}

      {/* размерные линии */}
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

      {/* подписи */}
      {plan.items.map((room) => {
        const { cx, cy, small, nameFs, showName, shortName } = label(room);
        const name = small ? shortName : room.name.length > 14 && room.rects[0].w < 2.6 ? room.name.split(' ')[0] : room.name;
        return (
          <g key={`t-${room.id}`} className={`pl-label${selected === room.id ? ' sel' : ''}`} data-fade pointerEvents="none">
            {showName && <text x={cx} y={cy - nameFs * 0.25} fontSize={nameFs} textAnchor="middle" className="pl-name">{name}</text>}
            <text x={cx} y={showName ? cy + nameFs * 1.05 : cy + fs * 0.35} fontSize={fs * (small ? 0.72 : 0.92)} textAnchor="middle" className="pl-area">{fmtA(room.area)}</text>
          </g>
        );
      })}
    </svg>
  );
}
