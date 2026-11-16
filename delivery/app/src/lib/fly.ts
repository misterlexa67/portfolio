// «Полёт» миниатюры блюда в корзину. Только transform и opacity, без блокировки интерфейса.

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function cartTarget(): HTMLElement | null {
  const list = Array.from(document.querySelectorAll<HTMLElement>('[data-cart-target]'));
  return list.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }) ?? null;
}

export function flyToCart(source: HTMLElement | null, src: string): void {
  if (!source || reduced()) { pulseCart(); return; }
  const target = cartTarget();
  if (!target) return;
  const a = source.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const size = Math.min(a.width, a.height, 160);
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  Object.assign(img.style, {
    position: 'fixed', left: `${a.left + a.width / 2 - size / 2}px`, top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`, height: `${size}px`, objectFit: 'contain', zIndex: '90', pointerEvents: 'none',
    willChange: 'transform, opacity',
  } as CSSStyleDeclaration);
  document.body.appendChild(img);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const end = 28 / size;
  const anim = img.animate(
    [
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
      { transform: `translate3d(${dx * 0.55}px, ${dy * 0.35 - 40}px, 0) scale(${0.6})`, opacity: 1, offset: 0.55 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${end})`, opacity: 0.2 },
    ],
    { duration: 560, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
  );
  anim.onfinish = () => { img.remove(); pulseCart(); };
  anim.oncancel = () => img.remove();
}

export function pulseCart(): void {
  const t = cartTarget();
  if (!t || reduced()) return;
  t.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
}
