import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { BudgetLevel, FloorPlan, IsoLayers, RenovationType } from '../../api';
import { useMedia } from '../../lib/hooks';
import { buildGhosts, buildScene, LAYER_ORDER, type Item, type LayerKey, type Shape } from './engine';
import './iso.css';

/* Квартира, которая собирается слоями.
   Слой появляется — «опускается» на место с затуханием; выключается — поднимается и исчезает.
   Мебель меняется вместе с вариантом квартиры: старая уходит, новая опускается. */

export interface IsoApartmentProps {
  plan: FloorPlan;
  layers: IsoLayers;
  level: BudgetLevel;
  type?: RenovationType;
  assembled: boolean;
  stagger?: number;
  /** подсветить слой или несколько (остальное приглушается) */
  focus?: LayerKey | LayerKey[] | null;
  detail?: 'low' | 'high';
  /** «рамка» в метрах, чтобы площадь была видна глазом */
  frame?: { w: number; d: number };
  /** включён демонтаж — при включении старые стены растворяются */
  demolition?: boolean;
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

const Group = memo(function Group({ item, on, lifted, delay, extra }: { item: Item; on: boolean; lifted: boolean; delay: number; extra?: string }) {
  return (
    <g
      className={`iso-el L-${item.layer}${on ? '' : ' off'}${lifted ? ' lift' : ''}${extra ? ` ${extra}` : ''}`}
      style={delay ? ({ '--d': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {item.shapes.map((s, i) => <ShapeEl key={i} s={s} />)}
    </g>
  );
});

export function IsoApartment({ plan, layers, level, type, assembled, stagger = 170, focus = null, detail, frame, demolition, className, title }: IsoApartmentProps) {
  const small = useMedia('(max-width: 640px)');
  const d = detail ?? (small ? 'low' : 'high');
  const scene = useMemo(() => buildScene(plan, { level, detail: d, type, frame }), [plan, level, d, type, frame?.w, frame?.d]); // eslint-disable-line react-hooks/exhaustive-deps

  const [phase, setPhase] = useState<'idle' | 'assembling' | 'ready'>(assembled ? 'assembling' : 'idle');
  useEffect(() => {
    if (!assembled) return;
    setPhase('assembling');
    const t = window.setTimeout(() => setPhase('ready'), stagger * LAYER_ORDER.length + 700);
    return () => window.clearTimeout(t);
  }, [assembled, stagger]);

  // «взрыв» отделки, когда добавился скрытый слой
  // таймеры живут в ref: новый расчёт (новый объект layers) не должен отменять их — иначе отделка «застревает»
  const timers = useRef<Record<string, number>>({});
  const later = (name: string, ms: number, fn: () => void) => {
    window.clearTimeout(timers.current[name]);
    timers.current[name] = window.setTimeout(fn, ms);
  };
  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), []);

  const [lift, setLift] = useState(false);
  const prev = useRef(layers);
  useEffect(() => {
    const p = prev.current;
    prev.current = layers;
    if (phase !== 'ready') return;
    const added = (p.screed !== layers.screed && layers.screed) || (p.electrics !== layers.electrics && layers.electrics) || (p.warmFloor !== layers.warmFloor && layers.warmFloor);
    if (!added || d === 'low') return; // на телефоне без «подъёма» отделки — экономим кадры
    setLift(true);
    later('lift', 1500, () => setLift(false));
  }, [layers, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // смена мебели: исчезнувшие предметы доигрывают уход, новые — появление
  const furnKeys = useRef<Map<string, Item>>(new Map());
  const firstFurn = useRef(true);
  const [leaving, setLeaving] = useState<Item[]>([]);
  const [entering, setEntering] = useState<Set<string>>(new Set());
  useEffect(() => {
    const now = new Map<string, Item>();
    [...scene.flat, ...scene.sorted].forEach((it) => { if (it.layer === 'furniture') now.set(it.key, it); });
    const old = furnKeys.current;
    furnKeys.current = now;
    if (firstFurn.current || phase !== 'ready') { firstFurn.current = false; return; }
    const gone = [...old.entries()].filter(([k]) => !now.has(k)).map(([, it]) => it);
    const fresh = [...now.keys()].filter((k) => !old.has(k));
    // меняется больше половины предметов — это смена варианта, а не сдвиг ползунка
    if (!gone.length && !fresh.length) return;
    setLeaving(gone);
    setEntering(new Set(fresh));
    later('furn', 700, () => { setLeaving([]); setEntering(new Set()); });
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // демонтаж: старые стены растворяются при включении (и один раз при сборке, если демонтаж уже выбран)
  const ghosts = useMemo(() => buildGhosts(plan), [plan.id, plan.house, plan.rooms]); // eslint-disable-line react-hooks/exhaustive-deps
  const [demo, setDemo] = useState(false);
  const prevDemo = useRef(demolition);
  useEffect(() => {
    const was = prevDemo.current;
    prevDemo.current = demolition;
    const start = (phase === 'assembling' && demolition) || (phase === 'ready' && demolition && !was);
    if (!start) return;
    setDemo(true);
    later('demo', 1900, () => setDemo(false));
  }, [demolition, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusList = focus ? (Array.isArray(focus) ? focus : [focus]) : [];
  const lifted = lift || focusList.some((f) => HIDDEN_UNDER.includes(f));
  const isOn = (layer: LayerKey) => phase !== 'idle' && visible(layer, layers);

  // задержка: при сборке — ступенька по слоям; внутри слоя — лёгкий каскад, чтобы слой «оседал»
  const counters: Record<string, number> = {};
  const delayFor = (layer: LayerKey) => {
    const i = (counters[layer] = (counters[layer] ?? -1) + 1);
    const cascade = d === 'low' ? 0 : Math.min(i * 6, 200);
    return (phase === 'assembling' ? LAYER_ORDER.indexOf(layer) * stagger : 0) + cascade;
  };

  const render = (items: Item[]) => items.map((it) => (
    <Group
      key={it.key} item={it} on={isOn(it.layer)} lifted={!!it.lift && lifted} delay={delayFor(it.layer)}
      extra={entering.has(it.key) ? 'entering' : undefined}
    />
  ));

  const [vx, vy] = scene.viewBox.split(' ').map(Number);
  return (
    <svg
      className={`iso${d === 'low' ? ' iso-low' : ''} ${className ?? ''}`}
      viewBox={scene.viewBox}
      role="img"
      aria-label={title ?? `Изометрия квартиры ${plan.area} м²`}
      data-focus={focusList.length ? focusList.join(' ') : undefined}
      preserveAspectRatio="xMidYMid meet"
    >
      <g className="iso-shadow">
        <ellipse cx={scene.width / 2 + vx} cy={vy + scene.height - 18} rx={scene.width * 0.42} ry={14} fill="rgba(35,33,30,0.08)" />
      </g>
      {render(scene.flat)}
      {render(scene.back)}
      {demo && ghosts.map((g) => (
        <g key={g.key} className="iso-ghost">{g.shapes.map((s, i) => <ShapeEl key={i} s={s} />)}</g>
      ))}
      {render(scene.sorted)}
      {leaving.map((it) => (
        <g key={`leave-${it.key}`} className="iso-el leaving">{it.shapes.map((s, i) => <ShapeEl key={i} s={s} />)}</g>
      ))}
      {render(scene.top)}
    </svg>
  );
}
