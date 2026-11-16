import { gsap } from 'gsap';

/* Движение: спокойное, 200–600 мс, только transform и opacity. Без pin и scrub. */

export const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Плавное появление блоков с классом .rv — один раз. Подхватывает и блоки,
    которые появились позже (данные из сервисного слоя приходят асинхронно). */
export function initReveals(root: HTMLElement = document.body) {
  const show = (el: Element) => el.classList.add('in');
  if (reduced() || typeof IntersectionObserver === 'undefined') {
    root.querySelectorAll('.rv').forEach(show);
    const mo = new MutationObserver(() => root.querySelectorAll('.rv:not(.in)').forEach(show));
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }
  let batch = 0;
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e) => {
      const el = e.target as HTMLElement;
      el.style.transitionDelay = `${Math.min(batch++, 4) * 70}ms`;
      show(el);
      io.unobserve(el);
    });
    batch = 0;
  }, { rootMargin: '0px 0px -10% 0px' });
  const scan = () => root.querySelectorAll('.rv:not(.in):not([data-rv])').forEach((el) => { el.setAttribute('data-rv', ''); io.observe(el); });
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(root, { childList: true, subtree: true });
  return () => { io.disconnect(); mo.disconnect(); };
}

/** Прорисовка линий плана: каждой линии с pathLength=1 — плавный dashoffset. */
export function drawLines(svg: SVGSVGElement | null, opts: { duration?: number; stagger?: number } = {}) {
  if (!svg) return () => undefined;
  const lines = svg.querySelectorAll<SVGElement>('[data-draw]');
  const fills = svg.querySelectorAll<SVGElement>('[data-fade]');
  if (reduced()) {
    gsap.set(lines, { strokeDashoffset: 0 });
    gsap.set(fills, { opacity: 1 });
    return () => undefined;
  }
  const tl = gsap.timeline();
  tl.fromTo(lines, { strokeDasharray: 1, strokeDashoffset: 1 }, {
    strokeDashoffset: 0, duration: opts.duration ?? 0.6, ease: 'power2.inOut', stagger: opts.stagger ?? 0.035,
  });
  tl.fromTo(fills, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.03 }, '-=0.35');
  return () => { tl.kill(); };
}

/** Прокрутка числа: значение плавно доезжает до нового. */
export function rollNumber(from: number, to: number, onUpdate: (v: number) => void, duration = 0.55) {
  if (reduced() || from === to) { onUpdate(to); return () => undefined; }
  const o = { v: from };
  const tw = gsap.to(o, { v: to, duration, ease: 'power3.out', onUpdate: () => onUpdate(o.v) });
  return () => { tw.kill(); };
}

export { gsap };
