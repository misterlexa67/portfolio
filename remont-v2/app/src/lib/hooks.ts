import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe, ApiError, type StoreKey } from '../api';

/** Загрузка из сервисного слоя + автообновление, когда данные поменялись (в т.ч. из админки в соседней вкладке). */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[], watch: StoreKey[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    fnRef.current().then(
      (v) => { if (id === seq.current) { setData(v); setError(null); setLoading(false); } },
      (e) => { if (id === seq.current) { setError(humanError(e)); setLoading(false); } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (!watch.length) return;
    return subscribe((k) => { if (watch.includes(k)) reload(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, watch.join(',')]);

  return { data, error, loading, reload, setData };
}

export const humanError = (e: unknown) =>
  e instanceof ApiError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.';

export function useMedia(query: string): boolean {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

/** Однократное «вошло в экран». */
export function useInView<T extends Element>(opts: { margin?: string; once?: boolean; threshold?: number } = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (opts.once !== false) io.disconnect(); }
      else if (opts.once === false) setInView(false);
    }, { rootMargin: opts.margin ?? '0px 0px -12% 0px', threshold: opts.threshold ?? 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [opts.margin, opts.once, opts.threshold]);
  return [ref, inView] as const;
}

/** Ключ идемпотентности на одну попытку записи. */
export function useIdempotencyKey() {
  const make = () => `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const [key, setKey] = useState(make);
  return [key, () => setKey(make())] as const;
}
