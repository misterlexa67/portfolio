import type { DistrictId, Project } from '../../api';
import './map.css';

/* Стилизованная схема Нижнего Новгорода: 8 районов, Волга и Ока. Не картография — схема для ориентира. */

export const DISTRICT_SHAPES: Record<DistrictId, { pts: string; label: [number, number] }> = {
  sormovsky: { pts: '0,150 270,160 285,300 240,395 0,405', label: [118, 228] },
  moskovsky: { pts: '270,160 430,170 435,255 385,330 285,300', label: [352, 196] },
  kanavinsky: { pts: '430,170 600,180 560,250 520,330 470,420 385,330 435,255', label: [452, 352] },
  leninsky: { pts: '240,395 285,300 385,330 470,420 440,520 320,545 235,485', label: [348, 505] },
  avtozavodsky: { pts: '0,405 240,395 235,485 320,545 440,520 400,610 345,700 315,800 0,800', label: [160, 470] },
  nizhegorodsky: { pts: '600,180 1000,135 1000,330 800,355 640,365 520,330 560,250', label: [880, 300] },
  sovetsky: { pts: '520,330 640,365 800,355 1000,330 1000,525 760,565 560,525 470,420', label: [900, 400] },
  priroksky: { pts: '470,420 560,525 760,565 1000,525 1000,800 315,800 345,700 400,610 440,520', label: [700, 762] },
};

const NAMES: Record<DistrictId, string> = {
  sormovsky: 'Сормовский', moskovsky: 'Московский', kanavinsky: 'Канавинский', leninsky: 'Ленинский',
  avtozavodsky: 'Автозаводский', nizhegorodsky: 'Нижегородский', sovetsky: 'Советский', priroksky: 'Приокский',
};

export function MapNN({ projects, district, activeId, onPick, onDistrict, counts }: {
  projects: Project[];
  district: DistrictId | 'all';
  activeId: string | null;
  onPick: (p: Project) => void;
  onDistrict: (d: DistrictId | 'all') => void;
  counts: Partial<Record<DistrictId, number>>;
}) {
  return (
    <svg className="mapnn" viewBox="0 60 1000 740" role="group" aria-label="Схема Нижнего Новгорода с примерами объектов">
      <defs>
        <pattern id="map-hatch" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="var(--hairline)" strokeWidth="1" />
        </pattern>
      </defs>
      {(Object.keys(DISTRICT_SHAPES) as DistrictId[]).map((id) => {
        const on = district === id;
        const dim = district !== 'all' && !on;
        return (
          <polygon
            key={id} points={DISTRICT_SHAPES[id].pts}
            className={`md${on ? ' on' : ''}${dim ? ' dim' : ''}`}
            onClick={() => onDistrict(on ? 'all' : id)}
          >
            <title>{NAMES[id]} район</title>
          </polygon>
        );
      })}
      {/* реки поверх границ районов */}
      <path className="river" d="M0,95 C250,105 500,120 700,110 S900,80 1000,70 L1000,140 C880,150 760,175 640,185 C560,190 520,182 470,178 C350,170 250,165 0,160 Z" />
      <path className="river-oka" d="M300,820 C330,720 360,650 410,580 C450,520 465,470 485,410 C505,350 530,290 604,178" />
      <text className="river-t" x="140" y="132">Волга</text>
      <text className="river-t" x="0" y="0" transform="translate(392 640) rotate(-62)">Ока</text>
      {/* ориентир */}
      <g className="landmark" transform="translate(648 212)">
        <path d="M-9 6 L-9 -4 L-5 -8 L-1 -4 L-1 6 M1 6 L1 -2 L5 -6 L9 -2 L9 6 Z" />
        <text x="14" y="4">Кремль</text>
      </g>

      {(Object.keys(DISTRICT_SHAPES) as DistrictId[]).map((id) => {
        const [x, y] = DISTRICT_SHAPES[id].label;
        return (
          <text key={`l-${id}`} className={`md-label${district === id ? ' on' : ''}`} x={x} y={y} textAnchor="middle">
            {NAMES[id].toUpperCase()}
            {counts[id] ? <tspan className="md-count" dx="6">{counts[id]}</tspan> : null}
          </text>
        );
      })}

      {projects.map((p) => {
        const on = p.id === activeId;
        return (
          <g
            key={p.id} className={`pin${on ? ' on' : ''}`} transform={`translate(${p.x} ${p.y})`}
            role="button" tabIndex={0} aria-pressed={on} aria-label={`${p.title}, ${NAMES[p.district]} район`}
            onClick={() => onPick(p)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p); } }}
          >
            <circle r="22" className="pin-hit" />
            <circle r={on ? 14 : 9} className="pin-ring" />
            <circle r={on ? 6 : 4.5} className="pin-dot" />
          </g>
        );
      })}
    </svg>
  );
}

export const districtName = (id: DistrictId) => NAMES[id];
