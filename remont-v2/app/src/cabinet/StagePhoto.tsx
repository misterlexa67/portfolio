import { useMemo } from 'react';
import type { CabinetScene, FloorPlan, IsoLayers } from '../api';
import { IsoApartment } from '../components/iso/IsoApartment';

/* «Фото» этапа — иллюстрация тем же изометрическим движком: каждый этап показывает свои слои. */

const MINI: FloorPlan = {
  id: 'mini', house: 'brezhnevka', rooms: 1, bathrooms: 1, area: 18.2, width: 5, depth: 3.8,
  items: [
    { id: 'living-0', kind: 'bedroom', name: 'Спальня', rects: [{ x: 0, y: 0, w: 3.2, h: 3.8 }], area: 12.2 },
    { id: 'bath-1', kind: 'bath', name: 'Ванная', rects: [{ x: 3.2, y: 0, w: 1.8, h: 2.1 }], area: 3.8 },
    { id: 'hall-2', kind: 'hall', name: 'Прихожая', rects: [{ x: 3.2, y: 2.1, w: 1.8, h: 1.7 }], area: 3.1 },
  ],
};
const KITCHEN: FloorPlan = {
  ...MINI, id: 'mini-k',
  items: [
    { id: 'kitchen-0', kind: 'kitchen', name: 'Кухня', rects: [{ x: 0, y: 0, w: 3.2, h: 3.8 }], area: 12.2 },
    { id: 'bath-1', kind: 'bath', name: 'Ванная', rects: [{ x: 3.2, y: 0, w: 1.8, h: 2.1 }], area: 3.8 },
    { id: 'hall-2', kind: 'hall', name: 'Прихожая', rects: [{ x: 3.2, y: 2.1, w: 1.8, h: 1.7 }], area: 3.1 },
  ],
};

const NONE: IsoLayers = { screed: false, partitions: true, electrics: false, warmFloor: false, walls: false, floor: false, light: false, furniture: false, conditioner: false };
const SCENES: Record<CabinetScene, IsoLayers> = {
  demolition: NONE,
  screed: { ...NONE, screed: true },
  electrics: { ...NONE, screed: true, electrics: true, warmFloor: true },
  plaster: { ...NONE, screed: true, walls: true },
  tile: { ...NONE, screed: true, walls: true, floor: true },
  paint: { ...NONE, screed: true, walls: true, floor: true, light: true },
  floor: { ...NONE, screed: true, walls: true, floor: true, light: true, conditioner: true },
  kitchen: { ...NONE, screed: true, walls: true, floor: true, light: true, furniture: true },
};

export function StagePhoto({ scene, title }: { scene: CabinetScene; title: string }) {
  const plan = scene === 'kitchen' ? KITCHEN : MINI;
  const layers = useMemo(() => SCENES[scene], [scene]);
  return (
    <div className={`stage-photo sp-${scene}`}>
      <IsoApartment plan={plan} layers={layers} level="standard" assembled detail="high" stagger={0} title={title} />
    </div>
  );
}
