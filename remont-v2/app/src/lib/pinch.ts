import { useCallback, useEffect, useRef, useState } from 'react';

/* Масштаб двумя пальцами для чертежа на телефоне. Только transform.
   Одним пальцем страница скроллится как обычно; после приближения одним пальцем двигаем чертёж. */

export function usePinchZoom(max = 3) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const st = useRef({ s: 1, x: 0, y: 0 });
  const [zoomed, setZoomed] = useState(false);

  const apply = (anim = false) => {
    const el = inner.current;
    if (!el) return;
    const { s, x, y } = st.current;
    el.style.transition = anim ? 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
  };
  const clampPan = () => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const { s } = st.current;
    const minX = box.width * (1 - s); const minY = box.height * (1 - s);
    st.current.x = Math.min(0, Math.max(minX, st.current.x));
    st.current.y = Math.min(0, Math.max(minY, st.current.y));
  };
  const reset = useCallback(() => { st.current = { s: 1, x: 0, y: 0 }; apply(true); setZoomed(false); }, []);
  /** Кнопки «+» / «−»: шаг масштаба вокруг центра рамки. */
  const step = useCallback((dir: 1 | -1) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const s0 = st.current.s;
    const s = Math.min(max, Math.max(1, s0 * (dir > 0 ? 1.5 : 1 / 1.5)));
    const cx = box.width / 2; const cy = box.height / 2; const k = s / s0;
    st.current = { s, x: cx - (cx - st.current.x) * k, y: cy - (cy - st.current.y) * k };
    clampPan(); apply(true); setZoomed(s > 1.01);
    if (s <= 1.01) reset();
  }, [max, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { d: number; s: number; mx: number; my: number; x: number; y: number } | null = null;
    let pan: { px: number; py: number; x: number; y: number } | null = null;
    let lastTap = 0;
    const local = (t: Touch) => { const b = el.getBoundingClientRect(); return [t.clientX - b.left, t.clientY - b.top]; };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [ax, ay] = local(e.touches[0]); const [bx, by] = local(e.touches[1]);
        start = { d: Math.hypot(ax - bx, ay - by), s: st.current.s, mx: (ax + bx) / 2, my: (ay + by) / 2, x: st.current.x, y: st.current.y };
        pan = null;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTap < 300 && st.current.s > 1) { reset(); lastTap = 0; return; }
        lastTap = now;
        if (st.current.s > 1) { const [px, py] = local(e.touches[0]); pan = { px, py, x: st.current.x, y: st.current.y }; }
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && start) {
        e.preventDefault();
        const [ax, ay] = local(e.touches[0]); const [bx, by] = local(e.touches[1]);
        const s = Math.min(max, Math.max(1, start.s * (Math.hypot(ax - bx, ay - by) / start.d)));
        // точка между пальцами остаётся на месте
        const k = s / start.s;
        st.current = { s, x: start.mx - (start.mx - start.x) * k, y: start.my - (start.my - start.y) * k };
        clampPan(); apply();
      } else if (e.touches.length === 1 && pan && st.current.s > 1) {
        e.preventDefault();
        const [px, py] = local(e.touches[0]);
        st.current.x = pan.x + (px - pan.px); st.current.y = pan.y + (py - pan.py);
        clampPan(); apply();
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
      if (e.touches.length === 0) pan = null;
      if (st.current.s < 1.05) reset(); else setZoomed(true);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [max, reset]);

  return { ref, inner, zoomed, reset, step };
}
