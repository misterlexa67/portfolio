import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, decodeShare, subscribe, type CalcOrigin, type CalcParams, type Estimate, type FloorPlan, type Project } from '../api';

/* Состояние калькулятора на лендинге. Деньги не считает — только хранит параметры
   и спрашивает у сервисного слоя. Расчёт, бюджеты, смета и PDF читают отсюда один и тот же Estimate. */

export const DEFAULT_PARAMS: CalcParams = {
  area: 54.5, house: 'brezhnevka', rooms: 2, bathrooms: 1, type: 'capital', level: 'standard',
  options: ['demolition', 'electrics'], planId: 'brezhnevka-2',
};

interface SharedInfo { total?: number; priceVersion?: number }

interface CalcCtx {
  params: CalcParams;
  origin: CalcOrigin;
  estimate: Estimate | null;
  pending: boolean;
  plan: FloorPlan;
  touched: boolean;
  estimateOpen: boolean;
  shared: SharedInfo | null;
  /** какие параметры только что поменялись извне («Хочу так же», выбор дома) — для короткой подсветки */
  changed: { keys: string[]; at: number };
  set: (patch: Partial<CalcParams>, origin?: CalcOrigin) => void;
  applyPlan: (plan: FloorPlan) => void;
  applyProject: (p: Project) => void;
  restore: (params: CalcParams, origin: CalcOrigin) => void;
  openEstimate: (open?: boolean) => void;
  dismissShared: () => void;
}

const Ctx = createContext<CalcCtx | null>(null);

export function CalcProvider({ children }: { children: ReactNode }) {
  const initialShare = useMemo(() => (typeof window !== 'undefined' ? decodeShare(window.location.search) : null), []);
  const [params, setParams] = useState<CalcParams>(initialShare?.params ?? DEFAULT_PARAMS);
  const [origin, setOrigin] = useState<CalcOrigin>(initialShare ? 'share' : 'calculator');
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [pending, setPending] = useState(true);
  const [touched, setTouched] = useState(!!initialShare);
  const [estimateOpen, setEstimateOpen] = useState(!!initialShare);
  const [shared, setShared] = useState<SharedInfo | null>(initialShare ? { total: initialShare.total, priceVersion: initialShare.priceVersion } : null);
  const seq = useRef(0);
  const [priceTick, setPriceTick] = useState(0);
  const [changed, setChanged] = useState<{ keys: string[]; at: number }>({ keys: [], at: 0 });
  const markChanged = (from: CalcParams, to: CalcParams) => {
    const keys = (['area', 'house', 'rooms', 'bathrooms', 'type', 'level'] as const).filter((k) => from[k] !== to[k]) as string[];
    if (from.options.slice().sort().join() !== to.options.slice().sort().join()) keys.push('options');
    setChanged({ keys, at: Date.now() });
  };

  // цены поменялись в админке (в т.ч. в соседней вкладке) — пересчитываем
  useEffect(() => subscribe((k) => { if (k === 'settings') setPriceTick((t) => t + 1); }), []);

  useEffect(() => {
    const id = ++seq.current;
    setPending(true);
    api.estimates.calculate(params).then((e) => {
      if (id !== seq.current) return;
      setEstimate(e);
      setPending(false);
    }, () => { if (id === seq.current) setPending(false); });
  }, [params, priceTick]);

  // черновик расчёта — только после действий пользователя
  useEffect(() => {
    if (!touched) return;
    const t = window.setTimeout(() => api.drafts.save(params, origin), 400);
    return () => window.clearTimeout(t);
  }, [params, origin, touched]);

  const set = useCallback((patch: Partial<CalcParams>, o?: CalcOrigin) => {
    setParams((p) => {
      const next = { ...p, ...patch };
      // типовая планировка остаётся, только пока совпадают дом и число комнат
      if (patch.house && patch.house !== p.house) next.planId = undefined;
      if (patch.rooms && patch.rooms !== p.rooms) next.planId = undefined;
      return next;
    });
    if (o) setOrigin(o);
    setTouched(true);
  }, []);

  const applyPlan = useCallback((plan: FloorPlan) => {
    setParams((p) => { const next = { ...p, house: plan.house, rooms: plan.rooms, bathrooms: plan.bathrooms, area: plan.area, planId: plan.id.replace(/-scaled$/, '') }; markChanged(p, next); return next; });
    setOrigin('house_picker');
    setTouched(true);
  }, []);

  const applyProject = useCallback((pr: Project) => {
    setParams((p) => { const next = { area: pr.area, house: pr.house, rooms: pr.rooms, bathrooms: pr.bathrooms, type: pr.type, level: pr.level, options: pr.options }; markChanged(p, next); return next; });
    setOrigin('map');
    setTouched(true);
  }, []);

  const restore = useCallback((p: CalcParams, o: CalcOrigin) => { setParams((cur) => { markChanged(cur, p); return p; }); setOrigin(o); setTouched(true); }, []);

  const plan = useMemo(() => api.plans.forParams(params), [params.house, params.rooms, params.bathrooms, params.area, params.planId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: CalcCtx = {
    params, origin, estimate, pending, plan, touched, estimateOpen, shared, changed,
    set, applyPlan, applyProject, restore,
    openEstimate: (open = true) => setEstimateOpen(open),
    dismissShared: () => setShared(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCalc() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCalc вне CalcProvider');
  return c;
}

export const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};
