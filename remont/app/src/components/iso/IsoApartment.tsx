import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { BudgetLevel, FloorPlan, IsoLayers } from '../../api';
import { useMedia } from '../../lib/hooks';
import { buildScene, LAYER_ORDER, type Item, type LayerKey, type Shape } from './engine';
import './iso.css';

/* Квартира, которая собирается слоями.
   Каждый элемент знает свой слой; видимость и «подъём» отделки — через CSS (opacity + transform). */

export interface IsoApartmentProps {
  plan: FloorPlan;
  layers: IsoLayers;
  level: BudgetLevel;
  /** true — квартира собрана; false — ждёт появления на экране */
  assembled: boolean;
  /** задержка между слоями при первой сборке, мс */
  stagger?: number;
  /** подсветить слой (остальная отделка приподнимается) */
  focus?: LayerKey | null;
  detail?: 'low' | 'high';
  className?: string;
  title?: string;
}

const visible = (layer: LayerKey, l: IsoLayers): boolean => {
  switch (layer) {
    case 'base': return true;
    case 'screed': return l.screed;
    case 'warmFloor': return l.warmFloor;
    case 'electrics': return l.electrics;
    case 'partitions': return l.partitions;
    case 'walls': return l.walls;
    case 'floor': return l.floor;
    case 'light': return l.light;
    case 'furniture': return l.furniture;
    case 'conditioner': return l.conditioner;
  }
};

const HIDDEN_UNDER: LayerKey[] = ['screed', 'warmFloor', 'electrics'];

function ShapeEl({ s }: { s: Shape }) {
  if (s.kind === 'ellipse') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.op} />;
  if (s.kind === 'line') return <polyline points={s.pts} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />;
  return <polygon points={s.pts} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} opacity={s.op} strokeLinejoin="round" />;
}

const Group = memo(function Group({ item, on, lifted, delay }: { item: Item; on: boolean; lifted: boolean; delay: number }) {
  return (
    <g
      className={`iso-el L-${item.layer}${on ? '' : ' off'}${lifted ? ' lift' : ''}`}
      style={delay ? ({ '--d': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {item.shapes.map((s, i) => <ShapeEl key={i} s={s} />)}
    </g>
  );
});

export function IsoApartment({ plan, layers, level, assembled, stagger = 170, focus = null, detail, className, title }: IsoApartmentProps) {
  const small = useMedia('(max-width: 640px)');
  const d = detail ?? (small ? 'low' : 'high');
  const scene = useMemo(() => buildScene(plan, { level, detail: d }), [plan, level, d]);

  // первая сборка — со ступенькой по слоям, дальше изменения без задержек
  const [phase, setPhase] = useState<'idle' | 'assembling' | 'ready'>(assembled ? 'assembling' : 'idle');
  useEffect(() => {
    if (!assembled) return;
    setPhase('assembling');
    const t = window.setTimeout(() => setPhase('ready'), stagger * LAYER_ORDER.length + 700);
    return () => window.clearTimeout(t);
  }, [assembled, stagger]);

  // «Взрыв» отделки: когда добавился скрытый слой (стяжка, электрика, тёплый пол) — показываем, что под полом
  const [lift, setLift] = useState(false);
  const prev = useRef(layers);
  useEffect(() => {
    const p = prev.current;
    prev.current = layers;
    if (phase !== 'ready') return;
    const added = (p.screed !== layers.screed && layers.screed) || (p.electrics !== layers.electrics && layers.electrics) || (p.warmFloor !== layers.warmFloor && layers.warmFloor);
    if (!added) return;
    setLift(true);
    const t = window.setTimeout(() => setLift(false), 1500);
    return () => window.clearTimeout(t);
  }, [layers, phase]);

  const lifted = lift || (focus ? HIDDEN_UNDER.includes(focus) : false);
  const delayFor = (layer: LayerKey) => (phase === 'assembling' ? LAYER_ORDER.indexOf(layer) * stagger : 0);
  const isOn = (layer: LayerKey) => phase !== 'idle' && visible(layer, layers);

  const render = (items: Item[]) => items.map((it) => (
    <Group key={it.key} item={it} on={isOn(it.layer)} lifted={!!it.lift && lifted} delay={delayFor(it.layer)} />
  ));

  return (
    <svg
      className={`iso ${className ?? ''}`}
      viewBox={scene.viewBox}
      role="img"
      aria-label={title ?? `Изометрия квартиры ${plan.area} м²`}
      data-focus={focus ?? undefined}
      preserveAspectRatio="xMidYMid meet"
    >
      <g className="iso-shadow">
        <ellipse cx={(scene.width / 2) + Number(scene.viewBox.split(' ')[0])} cy={Number(scene.viewBox.split(' ')[1]) + scene.height - 18} rx={scene.width * 0.42} ry={14} fill="rgba(35,33,30,0.08)" />
      </g>
      {render(scene.flat)}
      {render(scene.back)}
      {render(scene.sorted)}
      {render(scene.top)}
    </svg>
  );
}
