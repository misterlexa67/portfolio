import type { HouseTypeId } from '../api';

/* Фасады типовых домов — линейные рисунки кодом. */

interface Spec { floors: number; cols: number; w: number; roof: 'flat' | 'cornice' | 'crown'; balcony?: 'none' | 'strip' | 'loggia' | 'glass'; brick?: boolean; arch?: boolean }
const SPECS: Record<HouseTypeId, Spec> = {
  khrushchevka: { floors: 5, cols: 6, w: 96, roof: 'flat', balcony: 'strip', brick: true },
  brezhnevka: { floors: 9, cols: 6, w: 92, roof: 'flat', balcony: 'strip' },
  stalinka: { floors: 6, cols: 5, w: 100, roof: 'cornice', arch: true },
  panel90: { floors: 10, cols: 5, w: 88, roof: 'flat', balcony: 'loggia' },
  novostroyka: { floors: 17, cols: 4, w: 64, roof: 'crown', balcony: 'glass' },
};

export function HouseFacade({ type, lit }: { type: HouseTypeId; lit?: boolean }) {
  const s = SPECS[type];
  const H = 120; const base = 116;
  const fh = Math.min(10, 96 / s.floors);
  const top = base - fh * s.floors - 4;
  const x0 = (120 - s.w) / 2;
  const colW = s.w / s.cols;
  const wins: JSX.Element[] = [];
  for (let f = 0; f < s.floors; f++) {
    for (let c = 0; c < s.cols; c++) {
      const y = base - 4 - (f + 1) * fh + fh * 0.22;
      const x = x0 + c * colW + colW * 0.24;
      const w = colW * 0.52; const h = fh * 0.56;
      const on = lit && f === Math.floor(s.floors * 0.55) && c === s.cols - 2;
      wins.push(s.arch && f === s.floors - 1
        ? <path key={`${f}-${c}`} d={`M${x} ${y + h} V${y + w / 2} A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2} V${y + h} Z`} className={on ? 'fw fw-on' : 'fw'} />
        : <rect key={`${f}-${c}`} x={x} y={y} width={w} height={h} className={on ? 'fw fw-on' : 'fw'} />);
      if (s.balcony === 'loggia' && c % 2 === 1) wins.push(<rect key={`l${f}-${c}`} x={x - colW * 0.12} y={y + h * 0.55} width={w + colW * 0.24} height={h * 0.5} className="fb" />);
      if (s.balcony === 'glass' && c === 1) wins.push(<rect key={`g${f}-${c}`} x={x - colW * 0.16} y={y - fh * 0.1} width={w + colW * 0.32} height={fh * 0.86} className="fb fb-glass" />);
    }
    if (s.balcony === 'strip' && f > 0 && f % 1 === 0) {
      const y = base - 4 - f * fh;
      wins.push(<line key={`s${f}`} x1={x0 + colW * 1.1} x2={x0 + colW * 1.9} y1={y - fh * 0.04} y2={y - fh * 0.04} className="fs" />);
    }
  }
  return (
    <svg viewBox={`0 0 120 ${H}`} className="facade" aria-hidden="true">
      <line x1="4" x2="116" y1={base} y2={base} className="fg" />
      <rect x={x0} y={top} width={s.w} height={base - top} className="fbody" />
      {s.brick && Array.from({ length: Math.floor((base - top) / 3) }, (_, i) => (
        <line key={`b${i}`} x1={x0} x2={x0 + s.w} y1={top + i * 3} y2={top + i * 3} className="fbrick" />
      ))}
      {s.roof === 'cornice' && <><rect x={x0 - 4} y={top - 3} width={s.w + 8} height={4} className="fbody" /><rect x={x0} y={base - 10} width={s.w} height={6} className="fbase" /></>}
      {s.roof === 'crown' && <rect x={x0 + 8} y={top - 7} width={s.w - 16} height={7} className="fbody" />}
      {s.roof === 'flat' && <line x1={x0 - 1} x2={x0 + s.w + 1} y1={top} y2={top} className="froof" />}
      {wins}
      <rect x={x0 + s.w / 2 - 4} y={base - 8} width={8} height={8} className="fdoor" />
    </svg>
  );
}
