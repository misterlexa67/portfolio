import { useMemo, useState } from 'react';
import { api, type Project } from '../api';
import { layersFor } from '../api/pricing';
import { IsoApartment } from './iso/IsoApartment';
import './beforeafter.css';

/* «До / после» — иллюстрации кодом, не фото. «До» — квартира после демонтажа, «после» — готовый ремонт. */

const BEFORE = { screed: false, partitions: true, electrics: false, warmFloor: false, walls: false, floor: false, light: false, furniture: false, conditioner: false };

export function BeforeAfter({ project }: { project: Project }) {
  const [pos, setPos] = useState(55);
  const params = { area: project.area, house: project.house, rooms: project.rooms, bathrooms: project.bathrooms, type: project.type, level: project.level, options: project.options };
  const plan = useMemo(() => api.plans.forParams(params), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const after = useMemo(() => layersFor(params), [project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ba">
      <div className="ba-stage">
        <div className="ba-layer ba-before"><IsoApartment plan={plan} layers={BEFORE} level="economy" assembled detail="low" stagger={0} title="До ремонта: голые стены и плита" /></div>
        <div className="ba-layer ba-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}><IsoApartment plan={plan} layers={after} level={project.level} assembled detail="low" stagger={0} title="После ремонта" /></div>
        <span className="ba-line" style={{ left: `${pos}%` }} aria-hidden="true"><span className="ba-knob" /></span>
        <span className="ba-tag ba-tag-l mono">до</span>
        <span className="ba-tag ba-tag-r mono">после</span>
        <input
          className="ba-range" type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Сравнить до и после"
        />
      </div>
    </div>
  );
}
