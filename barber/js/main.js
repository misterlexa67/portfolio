import { createBust, describeCut } from './bust.js';
import { paintCard, CW, CH } from './cardface.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const qs = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const mobile = coarse || innerWidth < 900;
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rub = n => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ── может ли устройство тянуть 3D */
function canGL() {
  if (qs.has('static')) return false;
  if (qs.has('gl')) return true;
  if (navigator.connection && navigator.connection.saveData) return false;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (cores < 4 || mem < 3) return false;
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
const useGL = canGL();
if (!useGL) root.classList.add('no-gl');

/* ── вход: двери убираем из DOM после анимации */
const entry = $('.entry');
if (entry) {
  if (root.classList.contains('entered')) entry.remove();
  else setTimeout(() => entry.remove(), 1700);
}

/* ── Lenis + ScrollTrigger (на тач-устройствах скролл нативный) */
let lenis = null;
if (!reduce && window.Lenis && gsap) {
  lenis = new window.Lenis({ lerp: .1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToHash(h) {
  const el = h === '#top' ? document.body : $(h);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: h === '#top' ? 0 : -10, duration: 1.5 });
  else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const h = a.getAttribute('href');
  if (h.length < 2) return;
  e.preventDefault(); closeMenu(); scrollToHash(h);
});

/* ── меню на телефоне */
const burger = $('.burger'), mnav = $('.mnav');
function closeMenu() {
  if (!mnav.classList.contains('open')) return;
  mnav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); mnav.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('menu-open'); lenis && lenis.start();
}
burger.addEventListener('click', () => {
  const open = !mnav.classList.contains('open');
  mnav.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); mnav.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('menu-open', open);
});
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

/* ── шапка и нижняя кнопка */
const hdr = $('.hdr'), sticky = $('.sticky-cta');
let lastY = 0;
const offZones = new Set();
function onScroll() {
  const y = scrollY;
  hdr.classList.toggle('scrolled', y > 40);
  hdr.classList.toggle('hidden', y > 500 && y > lastY + 2 && !document.body.classList.contains('menu-open'));
  if (y < lastY - 2) hdr.classList.remove('hidden');
  lastY = y;
}
addEventListener('scroll', onScroll, { passive: true });
new IntersectionObserver(es => es.forEach(e => { e.isIntersecting ? offZones.add(e.target) : offZones.delete(e.target); sticky.classList.toggle('off', offZones.size > 0); }), { rootMargin: '0px 0px -20% 0px' })
  .observe($('#rsvp'));
new IntersectionObserver(es => es.forEach(e => { e.isIntersecting ? offZones.add(e.target) : offZones.delete(e.target); sticky.classList.toggle('off', offZones.size > 0); }), { rootMargin: '0px 0px -35% 0px' }).observe($('#top'));
new IntersectionObserver(es => es.forEach(e => { e.isIntersecting ? offZones.add(e.target) : offZones.delete(e.target); sticky.classList.toggle('off', offZones.size > 0); }))
  .observe($('.foot'));

/* ── ввод: курсор, касание или наклон телефона */
const INPUT = { x: 0, y: 0, tx: 0, ty: 0, tilt: false };
addEventListener('pointermove', e => {
  if (INPUT.tilt) return;
  INPUT.tx = e.clientX / innerWidth * 2 - 1; INPUT.ty = e.clientY / innerHeight * 2 - 1;
}, { passive: true });
// без разрешения на наклон всё работает от пальца: ведёшь по экрану — фольга и слои откликаются
addEventListener('touchmove', e => {
  if (INPUT.tilt || !e.touches[0]) return;
  INPUT.tx = e.touches[0].clientX / innerWidth * 2 - 1; INPUT.ty = e.touches[0].clientY / innerHeight * 2 - 1;
}, { passive: true });
function onTilt(e) {
  if (e.gamma == null) return;
  INPUT.tilt = true;
  INPUT.tx = clamp(e.gamma / 25, -1, 1); INPUT.ty = clamp((e.beta - 45) / 25, -1, 1);
}
(function tiltSetup() {
  if (!window.DeviceOrientationEvent || !coarse || reduce) return;
  const btn = $('.tilt-btn');
  if (typeof DeviceOrientationEvent.requestPermission !== 'function') { addEventListener('deviceorientation', onTilt, { passive: true }); return; }
  // iOS: наклон только по явному разрешению — аккуратная кнопка в hero
  let granted = false;
  try { granted = localStorage.getItem('osb-tilt') === 'granted'; } catch (e) {}
  const enable = () => DeviceOrientationEvent.requestPermission().then(s => {
    btn.hidden = true;
    if (s === 'granted') { addEventListener('deviceorientation', onTilt, { passive: true }); try { localStorage.setItem('osb-tilt', 'granted'); } catch (e) {} }
  }).catch(() => { btn.hidden = false; });
  if (granted) { addEventListener('touchend', enable, { once: true }); return; }
  btn.hidden = false;
  btn.addEventListener('click', enable);
})();

/* ── облегчённый режим: включается сам, если при скролле меньше 40 fps */
const LITE = { on: false, hooks: [] };
function goLite(reason) {
  if (LITE.on) return; LITE.on = true; root.classList.add('lite');
  LITE.hooks.forEach(f => { try { f(); } catch (e) {} });
  console.info('[osobnyak] облегчённый режим:', reason);
}
if (qs.has('lite')) setTimeout(() => goLite('параметр'), 0);
(function fpsWatch() {
  if (reduce) return;
  let scrolling = 0, frames = 0, t0 = 0, bad = 0;
  addEventListener('scroll', () => { scrolling = performance.now(); }, { passive: true });
  (function f(now) {
    if (LITE.on) return;
    if (now - scrolling < 150) {
      if (!t0) { t0 = now; frames = 0; }
      frames++;
      if (now - t0 > 1500) { const fps = frames * 1000 / (now - t0); bad = fps < 40 ? bad + 1 : 0; t0 = 0; if (bad >= 2) goLite('fps ' + Math.round(fps)); }
    } else t0 = 0;
    requestAnimationFrame(f);
  })(performance.now());
})();

/* ── фольга на латунных заголовках и бархат hero — только когда hero виден и что-то сдвинулось */
const brassEls = $$('.brass-text'), heroEl = $('.hero');
let heroVis = true;
new IntersectionObserver(es => { heroVis = es[0].isIntersecting; }).observe(heroEl);
let lastFx = -1;
(function tick() {
  INPUT.x += (INPUT.tx - INPUT.x) * .08; INPUT.y += (INPUT.ty - INPUT.y) * .08;
  if (heroVis && Math.abs(INPUT.x - lastFx) > .004) {
    lastFx = INPUT.x;
    const fx = (50 + INPUT.x * 42).toFixed(1) + '%';
    brassEls.forEach(el => el.style.setProperty('--fx', fx));
    if (!mobile) { heroEl.style.setProperty('--sx', (50 + INPUT.x * 22).toFixed(1) + '%'); heroEl.style.setProperty('--sy', (40 + INPUT.y * 16).toFixed(1) + '%'); }
  }
  requestAnimationFrame(tick);
})();

/* ── перо-курсор с исчезающим следом чернил */
if (fine && !reduce) {
  root.classList.add('pen-on');
  const pen = $('.pen'), cv = $('.ink-trail'), ctx = cv.getContext('2d');
  let dpr = Math.min(devicePixelRatio, 2), pts = [], px = -100, py = -100, inkCol = '217,190,136', running = false;
  const size = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  let pending = false;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX; py = e.clientY;
    pts.push({ x: px, y: py, t: performance.now() });
    if (pts.length > 60) pts.shift();
    if (!pending) {
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        pen.style.transform = `translate3d(${px}px,${py}px,0)`;
        const el = document.elementFromPoint(px, py);
        const sec = el && el.closest('[data-ink]');
        inkCol = sec && sec.dataset.ink === 'dark' ? '15,42,34' : '217,190,136';
        pen.classList.toggle('hot', !!(el && el.closest('a,button,input,label,.mcard,.frame,canvas,select')));
        if (!running) { running = true; requestAnimationFrame(draw); }
      });
    }
  }, { passive: true });
  document.addEventListener('mouseleave', () => pen.classList.add('hide'));
  document.addEventListener('mouseenter', () => pen.classList.remove('hide'));
  function draw() {
    const now = performance.now();
    pts = pts.filter(p => now - p.t < 650);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = 1 - (now - b.t) / 650;
      ctx.strokeStyle = `rgba(${inkCol},${(k * .7).toFixed(3)})`;
      ctx.lineWidth = .6 + k * 1.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (pts.length) requestAnimationFrame(draw); else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }
}

/* ── магнитные кнопки с латунным бликом */
function magnet(b) {
  if (!fine) return;
  b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    b.style.transform = `translate(${dx * .2}px,${dy * .34}px)`;
    b.style.setProperty('--gx', (e.clientX - r.left) + 'px'); b.style.setProperty('--gy', (e.clientY - r.top) + 'px');
  });
  b.addEventListener('pointerleave', () => { b.style.transform = ''; });
}
$$('.btn').forEach(magnet);

/* ── листы: каждая секция ложится на предыдущую (только десктоп; на телефоне во время скролла ничего не пересчитывается) */
if (gsap && !reduce && !mobile) {
  $$('.sheet').forEach(s => {
    ScrollTrigger.create({
      trigger: s, start: 'top bottom', end: 'top 30%', scrub: true,
      onUpdate(self) {
        if (LITE.on) { s.style.transform = ''; return; }
        const p = self.progress, k = 1 - p;
        s.style.transform = p < 1 ? `perspective(2000px) rotateX(${(-k * 4).toFixed(2)}deg)` : '';
        s.style.setProperty('--sh', (k * .9).toFixed(3));
      }
    });
  });
}

/* ── HERO: сначала лёгкая WebP-карточка, 3D подменяет её, когда страница загрузилась */
let heroApi = null;
async function bootHero() {
  const host = $('[data-gl="hero"]');
  if (!useGL || LITE.on) { staticHero(); return; }
  try {
    const m = await import('./gl-hero.js');
    heroApi = await m.initHero({ host, mobile, input: INPUT, delay: 0, onWeak: () => { heroApi = null; root.classList.add('no-gl'); staticHero(); } });
    if (LITE.on && heroApi) { heroApi.kill(); heroApi = null; root.classList.add('no-gl'); staticHero(); }
  } catch (err) { console.warn('[osobnyak] 3D отключено', err); root.classList.add('no-gl'); staticHero(); }
}
let staticOn = false;
function staticHero() {
  if (staticOn) return; staticOn = true;
  const img = $('.hero-static');
  if (reduce) return;
  const base = mobile ? 'translate(50%,-50%)' : 'translateY(-50%)';
  let lx = 9, ly = 9;
  (function loop() {
    if (heroVis && (Math.abs(INPUT.x - lx) > .003 || Math.abs(INPUT.y - ly) > .003)) {
      lx = INPUT.x; ly = INPUT.y;
      img.style.transform = `${base} perspective(900px) rotateY(${(lx * 10).toFixed(2)}deg) rotateX(${(-ly * 7).toFixed(2)}deg)`;
    }
    requestAnimationFrame(loop);
  })();
}
LITE.hooks.push(() => { if (heroApi) { heroApi.kill(); heroApi = null; root.classList.add('no-gl'); staticHero(); } });
// 3D не мешает первому экрану: после load и свободной минуты главного потока
const afterLoad = fn => (document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true })))
  .then(() => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: mobile ? 1500 : 400 }) : setTimeout(r, 200))))
  .then(fn);
afterLoad(bootHero);

/* ── МАНИФЕСТ: слова проявляются, как чернила */
(function () {
  const box = $('[data-ink-words]');
  const words = [];
  const split = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s); words.push(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) split(n);
    });
  };
  split(box);
  if (!gsap || reduce) return;
  const N = words.length, W = 5, last = new Array(N).fill(-1);
  const apply = p => {
    for (let i = 0; i < N; i++) {
      let l = clamp((p * (N + W) - i) / W, 0, 1);
      l = Math.round(l * 25) / 25;
      if (l === last[i]) continue;
      last[i] = l;
      const s = words[i].style;
      s.setProperty('--o', (.28 + .72 * l).toFixed(2));
    }
  };
  apply(0);
  const st = ScrollTrigger.create({ trigger: box, start: 'top 82%', end: 'bottom 45%', scrub: .4, onUpdate: self => { if (!LITE.on) apply(self.progress); } });
  LITE.hooks.push(() => { st.kill(); words.forEach(w => w.style.removeProperty('--o')); });
})();

/* ── ЧЛЕНСТВО: веер карт */
(function () {
  const fan = $('.fan'), cards = $$('.mcard');
  let idx = -1;
  const setActive = i => {
    idx = i;
    cards.forEach((c, k) => c.classList.toggle('active', k === i));
    fan.classList.toggle('has-active', i >= 0);
  };
  cards.forEach((c, i) => {
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
    if (fine) { c.addEventListener('pointerenter', () => setActive(i)); }
    c.addEventListener('click', e => { if (e.target.closest('.mc-btn')) return; if (!fine) setActive(idx === i ? -1 : i); });
    c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(idx === i ? -1 : i); } });
    c.addEventListener('focus', () => setActive(i));
  });
  if (fine) fan.addEventListener('pointerleave', () => setActive(-1));
  // свайп по вееру
  let sx = 0, sy = 0;
  fan.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  fan.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) setActive(((idx < 0 ? 1 : idx) + (dx < 0 ? 1 : -1) + 3) % 3);
  }, { passive: true });
  // фольга от наклона телефона
  if (!fine) (function loop() {
    if (idx >= 0 && INPUT.tilt && !LITE.on) { const c = cards[idx]; c.style.setProperty('--mx', (50 + INPUT.x * 45).toFixed(1) + '%'); c.style.setProperty('--my', (35 + INPUT.y * 30).toFixed(1) + '%'); }
    requestAnimationFrame(loop);
  })();
  $$('.mc-btn').forEach(b => b.addEventListener('click', () => setTier(b.dataset.tier)));
})();

/* ── МЕНЮ: строки вписываются пером */
(function () {
  const rows = $$('.dish');
  const nibSVG = '<svg viewBox="0 0 40 40"><path d="M2 38 L8 24 C10 18 18 10 30 4 C34 2 38 6 36 10 C30 22 22 30 16 32 Z" fill="#b08d57" stroke="#3a2a14" stroke-width=".8"/><path d="M2 38 L14 26" stroke="#3a2a14" stroke-width=".9"/></svg>';
  const INK = '#0F2A22';
  function text(str, fs, cls, parent) {
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 't ' + cls); svg.setAttribute('aria-hidden', 'true');
    parent.appendChild(svg);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('x', 0); t.setAttribute('y', (fs * .84).toFixed(1));
    t.style.fontSize = fs + 'px'; t.textContent = str; svg.appendChild(t);
    const w = t.getComputedTextLength(), chars = [];
    const pos = [...str].map((_, i) => { try { return t.getStartPositionOfChar(i).x; } catch { return 0; } });
    t.remove();
    [...str].forEach((ch, i) => {
      if (ch === ' ') return;
      const c = document.createElementNS(NS, 'text');
      c.setAttribute('x', pos[i].toFixed(2)); c.setAttribute('y', (fs * .84).toFixed(1)); c.style.fontSize = fs + 'px';
      c.textContent = ch; svg.appendChild(c); chars.push({ el: c, x: pos[i] });
    });
    svg.setAttribute('width', Math.ceil(w + 2)); svg.setAttribute('height', Math.ceil(fs * 1.12));
    svg.style.width = Math.ceil(w + 2) + 'px'; svg.style.height = Math.ceil(fs * 1.12) + 'px';
    return { svg, chars, w };
  }
  function build(li, done) {
    li.querySelector('.dish-row')?.remove();
    const fs = innerWidth < 480 ? (innerWidth < 380 ? 21 : 23) : Math.round(clamp(innerWidth * .028, 26, 44));
    const row = document.createElement('div'); row.className = 'dish-row';
    li.prepend(row);
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = `${li.dataset.name} — ${li.dataset.price}`; row.appendChild(sr);
    const name = text(li.dataset.name, fs, 'n', row);
    const lead = document.createElementNS(NS, 'svg'); lead.setAttribute('class', 'lead-dots'); lead.setAttribute('aria-hidden', 'true');
    lead.innerHTML = '<line x1="2" y1="5" x2="100%" y2="5"/>'; row.appendChild(lead);
    const price = text(li.dataset.price, fs, 'p', row);
    const nib = document.createElement('i'); nib.className = 'nib'; nib.innerHTML = nibSVG; row.appendChild(nib);
    const D = fs * 3.4;
    [...name.chars, ...price.chars].forEach(c => {
      c.el.style.strokeDasharray = D; c.el.style.strokeDashoffset = done ? 0 : D; c.el.style.fill = done ? INK : 'transparent';
    });
    lead.style.clipPath = done ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)';
    li._parts = { name, price, lead, nib, D };
    if (done) li.classList.add('done');
  }
  function write(li) {
    const { name, price, lead, nib } = li._parts;
    if (!gsap || reduce) { build(li, true); return; }
    const tl = gsap.timeline({ onComplete: () => li.classList.add('done') });
    const st = .055;
    const pr = price.svg.getBoundingClientRect(), rr = li.querySelector('.dish-row').getBoundingClientRect(), nr = name.svg.getBoundingClientRect();
    tl.set(nib, { opacity: 1, x: 0, y: 0 })
      .to(name.chars.map(c => c.el), { strokeDashoffset: 0, duration: .5, stagger: st, ease: 'power1.inOut' }, 0)
      .to(name.chars.map(c => c.el), { fill: INK, duration: .35, stagger: st }, .3)
      .to(nib, { x: nr.width, duration: name.chars.length * st + .4, ease: 'none' }, 0)
      .to(lead, { clipPath: 'inset(0 0% 0 0)', duration: .55, ease: 'power1.in' })
      .to(nib, { x: pr.left - rr.left, duration: .55, ease: 'power1.in' }, '<')
      .to(price.chars.map(c => c.el), { strokeDashoffset: 0, duration: .45, stagger: st }, '>-0.05')
      .to(price.chars.map(c => c.el), { fill: INK, duration: .3, stagger: st }, '<.25')
      .to(nib, { x: pr.right - rr.left, duration: price.chars.length * st + .35, ease: 'none' }, '<-.25')
      .to(nib, { opacity: 0, y: -14, duration: .3 });
  }
  document.fonts.ready.then(() => {
    rows.forEach(li => build(li, reduce || !gsap));
    if (gsap && !reduce) rows.forEach(li => ScrollTrigger.create({ trigger: li, start: 'top 86%', once: true, onEnter: () => write(li) }));
    let w = innerWidth;
    addEventListener('resize', () => { if (Math.abs(innerWidth - w) < 40) return; w = innerWidth; rows.forEach(li => build(li, li.classList.contains('done'))); });
  });
})();

/* ── запись: общий выбор мастера/услуги */
const MASTERS = ['Любой мастер', 'Аркадий Белозёров', 'Тимур Галеев', 'Лев Корнилов', 'Семён Ярцев'];
const SERVICES = [['Стрижка', 2400], ['Стрижка и борода', 3600], ['Королевское бритьё', 2500], ['Камуфляж седины', 1800], ['Детская стрижка', 1600]];
let bookingNote = '';
function setBooking({ master, service, note } = {}) {
  if (master) { const r = $(`#fMaster input[value="${master}"]`); if (r) r.checked = true; }
  if (service) { const r = $(`#fService input[value="${service}"]`); if (r) r.checked = true; }
  if (note !== undefined) bookingNote = note;
  updateSummary();
}
document.addEventListener('click', e => {
  const m = e.target.closest('[data-book-master]'), s = e.target.closest('[data-book-service]');
  if (m) setBooking({ master: m.dataset.bookMaster });
  if (s) setBooking({ service: s.dataset.bookService });
});

/* ── ПРИМЕРОЧНАЯ */
(function () {
  const bust = createBust($('#tryBust'), { top: .55, fade: .45, beard: 0, tie: 'bow', seed: 2, noMat: true });
  const rT = $('#r-top'), rF = $('#r-fade'), rB = $('#r-beard');
  const word = {
    top: v => v < .3 ? 'короткая' : v < .64 ? 'средняя' : 'длинная',
    fade: v => v < .28 ? 'без фейда' : v < .62 ? 'средний' : 'высокий',
    beard: v => v < .04 ? 'нет' : v < .3 ? 'щетина' : v < .66 ? 'короткая' : 'полная'
  };
  let raf = 0, cut = null;
  function sync() {
    raf = 0;
    const p = { top: rT.value / 100, fade: rF.value / 100, beard: rB.value / 100 };
    [rT, rF, rB].forEach(r => r.style.setProperty('--p', r.value + '%'));
    bust.update(p);
    $('#o-top').textContent = word.top(p.top); $('#o-fade').textContent = word.fade(p.fade); $('#o-beard').textContent = word.beard(p.beard);
    cut = describeCut(p);
    $('#v-name').textContent = cut.name;
    $('#v-extra').textContent = cut.beardTxt || ' ';
    $('#v-master').textContent = cut.master;
    $('#v-time').textContent = cut.time + ' минут';
    $('#v-price').textContent = rub(cut.price);
  }
  [rT, rF, rB].forEach(r => r.addEventListener('input', () => { if (!raf) raf = requestAnimationFrame(sync); }));
  sync();
  $('#v-book').addEventListener('click', () => {
    const p = rB.value / 100;
    setBooking({ master: cut.master, service: p >= .3 ? 'Стрижка и борода' : 'Стрижка', note: cut.name + (cut.beardTxt ? ' ' + cut.beardTxt : '') });
  });
})();

/* ── МАСТЕРА: гравюры в рамах, переворот */
$$('.frame').forEach(f => {
  createBust(f.querySelector('.bust'), { ...JSON.parse(f.dataset.bust), noMat: true });
  const flip = f.querySelector('.frame-flip');
  flip.addEventListener('click', () => {
    const on = !f.classList.contains('flipped');
    f.classList.toggle('flipped', on);
    flip.setAttribute('aria-label', (on ? 'Вернуть портрет: ' : 'Перевернуть: ') + f.dataset.master);
  });
});

/* ── ПОБРЕЙ САМ */
(function () {
  createBust($('#shaveBust'), { top: .5, fade: .55, beard: 0, tie: 'bow', seed: 31, noMat: true });
  const face = $('.shave-face'), cv = $('#foam'), ctx = cv.getContext('2d'), razor = $('.razor');
  const pctEl = $('#foamPct'), bar = $('#foamBar'), done = $('#shaveDone');
  const REGION = [[232, 212], [246, 234], [262, 247], [280, 251], [297, 255], [302, 266], [297, 279], [300, 294], [301, 311], [292, 327], [272, 336], [256, 341], [250, 362], [238, 372], [214, 368], [205, 330], [203, 290], [208, 252], [219, 224]];
  const probe = document.createElement('canvas'); probe.width = 100; probe.height = 115;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const test = document.createElement('canvas').getContext('2d');
  let s = 1, total = 1, finished = false, cw = 0;
  function region() { const p = new Path2D(); REGION.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; }
  function puff(x, y, r) {
    const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .05, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(246,243,236,.85)'); g.addColorStop(1, 'rgba(226,220,207,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function foam() {
    const r = face.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
    cw = r.width;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    s = cv.width / 400;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, 400, 460);
    const reg = region(), rnd = mulberry(7);
    // основа, чуть меньше контура — чтобы край был из «облачков»
    ctx.fillStyle = '#efebe2'; ctx.fill(reg);
    // облачка по краю, выпирают наружу
    for (let i = 0; i < REGION.length; i++) {
      const a = REGION[i], b = REGION[(i + 1) % REGION.length];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6);
      for (let k = 0; k < n; k++) { const t = k / n; puff(a[0] + (b[0] - a[0]) * t + (rnd() - .5) * 4, a[1] + (b[1] - a[1]) * t + (rnd() - .5) * 4, 6 + rnd() * 6); }
    }
    // объём внутри
    let placed = 0;
    for (let i = 0; i < 4000 && placed < 900; i++) {
      const x = 200 + rnd() * 105, y = 205 + rnd() * 172;
      if (!test.isPointInPath(reg, x, y)) continue;
      puff(x, y, 5 + rnd() * 6); placed++;
    }
    // пузырьки
    for (let i = 0; i < 120; i++) {
      const x = 200 + rnd() * 105, y = 205 + rnd() * 172;
      if (!test.isPointInPath(reg, x, y)) continue;
      const rr = .6 + rnd() * 1.8;
      ctx.strokeStyle = 'rgba(150,140,120,.35)'; ctx.lineWidth = .4; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(x - rr * .3, y - rr * .3, rr * .35, 0, Math.PI * 2); ctx.fill();
    }
    total = count() || 1; finished = false; done.hidden = true; meter(1);
  }
  function count() {
    pctx.clearRect(0, 0, 100, 115); pctx.drawImage(cv, 0, 0, 100, 115);
    const d = pctx.getImageData(0, 0, 100, 115).data; let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 60) n++;
    return n;
  }
  function meter(k) { pctEl.textContent = Math.round(k * 100) + '%'; bar.style.setProperty('--k', k.toFixed(3)); }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // звук лезвия (по умолчанию выключен): шум через полосовой фильтр
  let ac = null, gain = null, soundOn = false;
  const sBtn = $('#shaveSound');
  sBtn.addEventListener('click', () => {
    soundOn = !soundOn; sBtn.setAttribute('aria-pressed', String(soundOn));
    sBtn.querySelector('use').setAttribute('href', soundOn ? '#i-sound-on' : '#i-sound-off');
    if (soundOn && !ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ac = new AC();
      const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.4;
      gain = ac.createGain(); gain.gain.value = 0;
      src.connect(bp).connect(gain).connect(ac.destination); src.start();
    }
    if (ac && ac.state === 'suspended') ac.resume();
  });

  let down = false, lx = 0, ly = 0, lastT = 0, checkT = 0;
  const toV = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 400, (e.clientY - r.top) / r.height * 460]; };
  cv.addEventListener('pointerdown', e => { down = true; [lx, ly] = toV(e); cv.setPointerCapture(e.pointerId); face.classList.add('active'); cut(lx, ly, lx + .1, ly + .1); });
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    razor.style.transform = `translate(${e.clientX - r.left - 8}px,${e.clientY - r.top - 46}px)`;
    if (e.pointerType === 'mouse') face.classList.add('active');
    if (!down) return;
    const [x, y] = toV(e);
    cut(lx, ly, x, y);
    const now = performance.now(), sp = Math.hypot(x - lx, y - ly) / Math.max(1, now - lastT);
    lastT = now;
    if (gain && soundOn) gain.gain.setTargetAtTime(Math.min(.22, sp * .12), ac.currentTime, .03);
    lx = x; ly = y;
    if (now - checkT > 180) { checkT = now; check(); }
  });
  const up = () => { down = false; if (gain) gain.gain.setTargetAtTime(0, ac.currentTime, .05); check(); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!down) face.classList.remove('active'); });
  function cut(x0, y0, x1, y1) {
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  function check() {
    if (finished) return;
    const k = count() / total;
    meter(k);
    if (k < .15) {
      finished = true; meter(0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (gsap && !reduce) gsap.to(cv, { opacity: 0, duration: .6, onComplete: () => { ctx.clearRect(0, 0, cv.width, cv.height); cv.style.opacity = 1; } });
      else ctx.clearRect(0, 0, cv.width, cv.height);
      done.hidden = false;
      if (gsap && !reduce) gsap.from(done, { y: 30, opacity: 0, duration: .7, ease: 'power3.out' });
      magnet(done.querySelector('.btn'));
    }
  }
  $('#shaveReset').addEventListener('click', foam);
  document.fonts.ready.then(foam);
  addEventListener('resize', () => { if (Math.abs(face.getBoundingClientRect().width - cw) > 8) foam(); });
})();

/* ── ИНТЕРЬЕР: диорама из вырезанной бумаги, слои расходятся в глубину */
(function () {
  const host = $('.dio');
  const VB = innerWidth < 760 ? '310 0 900 700' : '0 0 1200 700';
  const layers = [];
  function layer(depth, inner, shadow = true) {
    shadow = shadow && !mobile; // на телефоне без SVG-фильтров: их растеризация на DPR 3 дорогая
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', VB); svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    const fid = 'dsh' + depth;
    svg.innerHTML = `<defs><filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${6 + depth * .25}" stdDeviation="${6 + depth * .3}" flood-color="#000" flood-opacity=".5"/></filter></defs><g ${shadow ? `filter="url(#${fid})"` : ''}>${inner}</g>`;
    svg.dataset.depth = depth; host.appendChild(svg); layers.push(svg);
    return svg;
  }
  let wall = `<defs>
      <linearGradient id="dW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d2a21"/><stop offset=".6" stop-color="#143a2e"/><stop offset="1" stop-color="#0f2e24"/></linearGradient>
      <linearGradient id="dOak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a3324"/><stop offset="1" stop-color="#2e1f15"/></linearGradient>
      <linearGradient id="dFr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9d6a6"/><stop offset=".4" stop-color="#b08d57"/><stop offset=".7" stop-color="#6f5430"/><stop offset="1" stop-color="#c9a46a"/></linearGradient>
      <linearGradient id="dSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a5a48"/><stop offset="1" stop-color="#173f31"/></linearGradient>
    </defs>
    <rect x="-200" y="-100" width="1600" height="900" fill="url(#dW)"/>`;
  for (let i = -1; i < 8; i++) {
    const x = i * 176 + 20;
    wall += `<rect x="${x}" y="70" width="146" height="300" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="2"/><rect x="${x + 2}" y="72" width="146" height="300" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>`;
  }
  wall += `<rect x="-200" y="420" width="1600" height="400" fill="url(#dOak)"/>
    <rect x="-200" y="410" width="1600" height="16" fill="#5a3f2b"/><rect x="-200" y="410" width="1600" height="2" fill="#c9a46a" opacity=".55"/><rect x="-200" y="424" width="1600" height="3" fill="#1c130c"/>`;
  for (let i = -1; i < 8; i++) {
    const x = i * 176 + 20;
    wall += `<rect x="${x}" y="456" width="146" height="190" fill="#3a2819" stroke="#1c130c" stroke-width="2"/><rect x="${x + 6}" y="462" width="134" height="178" fill="none" stroke="rgba(255,220,170,.08)" stroke-width="1.5"/>`;
  }
  wall += `<g transform="translate(588 22) scale(.8 .62)"><rect width="230" height="200" fill="url(#dFr)"/><rect x="12" y="12" width="206" height="176" fill="url(#dSky)"/>
    <circle cx="160" cy="62" r="16" fill="#efe6d2" opacity=".85"/>
    <path d="M12 140 C60 110 90 118 130 132 C160 112 196 106 218 118 V188 H12Z" fill="#0f2e24"/>
    <path d="M12 160 C70 140 120 150 218 146 V188 H12Z" fill="#0a221a"/></g>`;
  layer(4, wall, false);
  const lamp = `<defs>
      <radialGradient id="dGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd99a" stop-opacity=".55"/><stop offset=".35" stop-color="#e2a95c" stop-opacity=".2"/><stop offset="1" stop-color="#b08d57" stop-opacity="0"/></radialGradient>
      <linearGradient id="dCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd99a" stop-opacity=".26"/><stop offset="1" stop-color="#ffd99a" stop-opacity="0"/></linearGradient>
      <linearGradient id="dShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9b47a"/><stop offset="1" stop-color="#f4dba6"/></linearGradient>
      <linearGradient id="dPole" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f5430"/><stop offset=".5" stop-color="#e9d6a6"/><stop offset="1" stop-color="#6f5430"/></linearGradient>
      <linearGradient id="dGlass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3412"/><stop offset=".4" stop-color="#b9772e"/><stop offset="1" stop-color="#4a2a0e"/></linearGradient>
    </defs>
    <ellipse cx="960" cy="652" rx="58" ry="10" fill="#1a120b"/>
    <rect x="955" y="340" width="10" height="312" fill="url(#dPole)"/>
    <path d="M888 346 L1032 346 L1004 246 L916 246 Z" fill="url(#dShade)"/>
    <path d="M888 346 L1032 346" stroke="#8a6a3a" stroke-width="3"/>
    <g transform="translate(400 0)">
      <ellipse cx="0" cy="520" rx="86" ry="15" fill="#2a1a10"/><rect x="-6" y="520" width="12" height="120" fill="#24170e"/><path d="M0 630 L-50 660 M0 630 L50 660" stroke="#24170e" stroke-width="9" stroke-linecap="round"/>
      <path d="M-30 518 C-44 486 -38 462 -18 454 L-18 432 L-2 432 L-2 454 C18 462 24 486 10 518 Z" fill="url(#dGlass)" opacity=".92"/>
      <path d="M-26 500 C-34 484 -30 470 -18 466" stroke="#fff" stroke-opacity=".35" stroke-width="2" fill="none"/>
      <ellipse cx="-10" cy="428" rx="9" ry="7" fill="#c9a46a"/>
      <path d="M26 494 L30 518 H50 L54 494 Z" fill="#c98a3c" opacity=".7"/><path d="M26 494 L30 518 H50 L54 494" fill="none" stroke="#f1dfb2" stroke-opacity=".5"/>
    </g>`;
  const lightSvg = layer(12, `<defs><radialGradient id="dGlowL" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd99a" stop-opacity=".55"/><stop offset=".35" stop-color="#e2a95c" stop-opacity=".2"/><stop offset="1" stop-color="#b08d57" stop-opacity="0"/></radialGradient><linearGradient id="dConeL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd99a" stop-opacity=".26"/><stop offset="1" stop-color="#ffd99a" stop-opacity="0"/></linearGradient></defs><circle cx="960" cy="330" r="360" fill="url(#dGlowL)"/><path d="M896 344 L1024 344 L1160 700 L760 700 Z" fill="url(#dConeL)"/>`, false);
  lightSvg.classList.add('d-light');
  layer(12, lamp);

  let chair = `<defs>
      <linearGradient id="dLeather" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a2e1c"/><stop offset=".5" stop-color="#3b1d12"/><stop offset="1" stop-color="#22110a"/></linearGradient>
      <radialGradient id="dLit" cx="75%" cy="20%" r="70%"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".28"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
    </defs>
    <path d="M560 470 L560 300 C560 244 604 224 680 224 C756 224 800 244 800 300 L800 470 Z" fill="url(#dLeather)"/>
    <path d="M512 610 L512 420 C512 390 534 374 560 374 C588 374 608 392 608 420 L608 610 Z" fill="url(#dLeather)"/>
    <path d="M752 610 L752 420 C752 392 772 374 800 374 C826 374 848 390 848 420 L848 610 Z" fill="url(#dLeather)"/>
    <ellipse cx="560" cy="410" rx="46" ry="32" fill="#4a2618"/><ellipse cx="800" cy="410" rx="46" ry="32" fill="#4a2618"/>
    <path d="M596 468 H764 C774 468 780 476 780 488 V514 H580 V488 C580 476 586 468 596 468 Z" fill="#4a2618"/>
    <rect x="508" y="512" width="344" height="96" fill="url(#dLeather)"/>
    <rect x="520" y="618" width="22" height="24" fill="#1a0f08"/><rect x="818" y="618" width="22" height="24" fill="#1a0f08"/>
    <path d="M560 470 L560 300 C560 244 604 224 680 224 C756 224 800 244 800 300 L800 470 Z" fill="url(#dLit)"/>`;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
    const x = 588 + c * 36 + (r % 2 ? 18 : 0), y = 266 + r * 38; if (x > 782) continue;
    chair += `<circle cx="${x}" cy="${y}" r="3" fill="#1c0d07"/><circle cx="${x - .8}" cy="${y - .8}" r="1.1" fill="#c48b5c" opacity=".55"/>`;
    if (r < 4) chair += `<path d="M${x} ${y} L${x + 18} ${y + 38} M${x} ${y} L${x - 18} ${y + 38}" stroke="#1c0d07" stroke-opacity=".5" stroke-width="1.2"/>`;
  }
  for (let x = 516; x <= 846; x += 10) chair += `<circle cx="${x}" cy="520" r="2" fill="#d9be88"/><circle cx="${x}" cy="600" r="2" fill="#d9be88"/>`;
  layer(22, chair);
  const front = `<defs>
      <linearGradient id="dDrape" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#071a14"/><stop offset=".45" stop-color="#14402f"/><stop offset=".6" stop-color="#0d3024"/><stop offset="1" stop-color="#071a14"/></linearGradient>
      <linearGradient id="dRug" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173f31"/><stop offset="1" stop-color="#0a2219"/></linearGradient>
    </defs>
    <path d="M200 720 L340 664 L1010 664 L1170 720 Z" fill="url(#dRug)"/><path d="M250 714 L356 670 L994 670 L1112 714" fill="none" stroke="#c9a46a" stroke-opacity=".6" stroke-width="2"/>
    <path d="M-100 -50 H120 C104 120 138 260 112 420 C102 520 128 620 108 760 H-100 Z" fill="url(#dDrape)"/>
    <path d="M1300 -50 H1100 C1118 130 1086 270 1110 420 C1122 520 1094 620 1114 760 H1300 Z" fill="url(#dDrape)"/>
    <rect x="96" y="380" width="30" height="10" rx="5" fill="#c9a46a"/><rect x="1094" y="380" width="30" height="10" rx="5" fill="#c9a46a"/>`;
  layer(38, front);

  const light = host.querySelector('.d-light');
  let vis = false;
  new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(host);
  const lowPower = () => !useGL || reduce || LITE.on;
  // мерцание = только opacity целого слоя (композитор, без перерисовки); на телефоне реже
  (function f() { if (!lowPower()) { if (vis) light.style.opacity = (.84 + Math.random() * .16 + (Math.random() < .04 ? -.3 : 0)).toFixed(2); } else light.style.opacity = 1; setTimeout(f, mobile ? 260 + Math.random() * 300 : 90 + Math.random() * 140); })();
  let plx = 9, ply = 9;
  (function loop() {
    if (vis && !lowPower() && (Math.abs(INPUT.x - plx) > .002 || Math.abs(INPUT.y - ply) > .002)) plx = INPUT.x, ply = INPUT.y, layers.forEach(l => { const d = +l.dataset.depth * (mobile ? .8 : 1); l.style.transform = `translate3d(${(-INPUT.x * d).toFixed(2)}px,${(-INPUT.y * d * .5).toFixed(2)}px,0)`; });
    requestAnimationFrame(loop);
  })();
  if (gsap && !reduce) gsap.from(layers.slice(1), { y: (i) => 40 + i * 30, opacity: 0, duration: 1.4, ease: 'power3.out', stagger: .12, scrollTrigger: { trigger: host, start: 'top 70%', once: true } });
})();

/* ── ЧЛЕНСКАЯ КАРТА */
const today = new Date();
const CARD = { name: '', tier: 'member', no: String(1000 + Math.floor(Math.random() * 8999)), date: today.toLocaleDateString('ru-RU'), reveal: 1 };
let cardApi = null, printedOnce = false;
const cardStage = $('[data-gl="card"]'), flatCv = $('.card-flat canvas'), saveBtn = $('#cardSave');
function setTier(t) { const r = $(`.tiers input[value="${t}"]`); if (r) { r.checked = true; CARD.tier = t; if (printedOnce) printCard(); } }
function paintFlat() {
  flatCv.width = CW; flatCv.height = CH;
  paintCard(flatCv.getContext('2d'), { role: 'map', pattern: window.OSB.linen }, CARD);
}
async function printCard() {
  const name = $('#cardName').value.trim();
  CARD.name = name; CARD.tier = $('.tiers input:checked').value;
  printedOnce = true;
  if (cardApi) await cardApi.print({ ...CARD });
  else {
    if (reduce || !gsap) { CARD.reveal = 1; paintFlat(); }
    else { const o = { r: 0 }; gsap.to(o, { r: 1, duration: 1.4, ease: 'none', onUpdate: () => { CARD.reveal = o.r; paintFlat(); } }); }
  }
  saveBtn.disabled = !name;
}
$('#cardForm').addEventListener('submit', e => { e.preventDefault(); if (!$('#cardName').value.trim()) { $('#cardName').focus(); return; } printCard(); });
$$('.tiers input').forEach(r => r.addEventListener('change', () => { CARD.tier = r.value; if (printedOnce) printCard(); }));
saveBtn.addEventListener('click', () => {
  const out = document.createElement('canvas'); out.width = 1600; out.height = 1100;
  const g = out.getContext('2d');
  const bg = g.createRadialGradient(800, 450, 100, 800, 550, 1000); bg.addColorStop(0, '#1d4c3d'); bg.addColorStop(1, '#081a15');
  g.fillStyle = bg; g.fillRect(0, 0, 1600, 1100);
  const face = document.createElement('canvas'); face.width = CW; face.height = CH;
  paintCard(face.getContext('2d'), { role: 'map', pattern: window.OSB.linen }, { ...CARD, reveal: 1 });
  g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 60; g.shadowOffsetY = 30;
  g.beginPath(); g.roundRect ? g.roundRect(200, 172, CW, CH, 22) : g.rect(200, 172, CW, CH); g.fillStyle = '#000'; g.fill(); g.restore();
  g.save(); g.beginPath(); g.roundRect ? g.roundRect(200, 172, CW, CH, 22) : g.rect(200, 172, CW, CH); g.clip(); g.drawImage(face, 200, 172); g.restore();
  g.fillStyle = 'rgba(239,230,210,.5)'; g.font = '500 20px Jost'; g.textAlign = 'center'; g.fillText('ДЕМО-КОНЦЕПТ · БИЗНЕС ВЫМЫШЛЕННЫЙ', 800, 1040);
  const a = document.createElement('a'); a.download = 'osobnyak-karta.png'; a.href = out.toDataURL('image/png'); a.click();
});
// плоская карта (для слабых устройств): крутится пальцем
(function () {
  let ry = -12, rx = 6, d = false, lx = 0;
  flatCv.addEventListener('pointerdown', e => { d = true; lx = e.clientX; });
  addEventListener('pointerup', () => { d = false; });
  flatCv.addEventListener('pointermove', e => { if (!d) return; ry = clamp(ry + (e.clientX - lx) * .4, -40, 40); lx = e.clientX; flatCv.style.setProperty('--ry', ry + 'deg'); });
})();
async function bootCard() {
  await window.OSB.ready;
  CARD.reveal = 1; paintFlat();
  if (!useGL || LITE.on) { cardStage.classList.add('flat'); return; }
  try {
    const m = await import('./gl-card.js');
    cardApi = await m.initCard({ host: cardStage, mobile, onWeak: () => { cardApi = null; cardStage.classList.add('flat'); paintFlat(); } });
    LITE.hooks.push(() => { if (cardApi) { cardApi.kill(); cardApi = null; cardStage.classList.add('flat'); paintFlat(); } });
  } catch (err) { console.warn('[osobnyak] карта без 3D', err); cardStage.classList.add('flat'); }
}
// 3D-карту готовим заранее, кусками в свободное время (секцией раньше), а «печатаем», когда карта уже на экране
let cardBoot = null;
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); cardBoot = bootCard(); } }, { rootMargin: '0px 0px 120% 0px' }).observe(cardStage);
new IntersectionObserver((es, o) => { if (es[0].isIntersecting && es[0].intersectionRatio > .5) { o.disconnect(); (cardBoot || (cardBoot = bootCard())).then(() => { if (cardApi && !printedOnce) cardApi.print({ ...CARD }); }); } }, { threshold: [0, .5, .8] }).observe(cardStage);

/* ── ЗАПИСЬ: RSVP-карточка, конверт и сургуч */
(function () {
  const form = $('#rsvpForm');
  const opt = (name, value, html, checked) => `<label class="opt"><input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}><span>${html}</span></label>`;
  $('#fMaster').innerHTML = MASTERS.map((m, i) => opt('master', m, m, i === 0)).join('');
  $('#fService').innerHTML = SERVICES.map(([n, p]) => opt('service', n, `${n}<small>${rub(p)}</small>`)).join('');
  const days = [], wd = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  for (let i = 1; i <= 7; i++) { const d = new Date(today); d.setDate(d.getDate() + i); days.push(d); }
  $('#fDay').innerHTML = days.map((d, i) => opt('day', d.toISOString().slice(0, 10), `${wd[d.getDay()]}<small>${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small>`)).join('');
  const times = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  function renderTimes() {
    const day = (form.day && form.day.value) || '';
    const seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0);
    const cur = form.time && form.time.value;
    $('#fTime').innerHTML = times.map((t, i) => {
      const busy = day && ((seed * 31 + i * 17) % 7 === 0 || (seed + i * 13) % 6 === 0);
      return `<label class="opt"><input type="radio" name="time" value="${t}"${busy ? ' disabled' : ''}${!busy && cur === t ? ' checked' : ''}><span>${t}</span></label>`;
    }).join('');
  }
  renderTimes();
  form.addEventListener('change', e => { if (e.target.name === 'day') renderTimes(); updateSummary(); });

  // имя «пишется» чернилами
  const name = $('#fName'), out = $('.ink-out');
  let prev = '';
  name.addEventListener('input', () => {
    const v = name.value; let k = 0;
    while (k < v.length && k < prev.length && v[k] === prev[k]) k++;
    out.innerHTML = '';
    [...v].forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; if (i < k) s.style.animation = 'none'; out.appendChild(s); });
    prev = v; updateSummary();
  });
  // телефон: маска
  const ph = $('#fPhone');
  ph.addEventListener('input', () => {
    let d = ph.value.replace(/\D/g, ''); if (d.startsWith('8')) d = '7' + d.slice(1); if (!d.startsWith('7')) d = '7' + d; d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    ph.value = '+7' + (p[0] ? ` (${p[0]}` : '') + (p[0].length === 3 ? ')' : '') + (p[1] ? ` ${p[1]}` : '') + (p[2] ? `-${p[2]}` : '') + (p[3] ? `-${p[3]}` : '');
  });

  // конверт
  const stage = $('.rsvp-stage'), env = $('.envelope'), flap = $('.env-flap'), wax = $('.wax'), doneBox = $('#rsvpDone');
  const blob = []; for (let i = 0; i < 52; i++) { const a = i / 52 * Math.PI * 2, r = 72 + Math.sin(a * 3 + 1) * 2.6 + Math.sin(a * 7) * 1.6 + Math.sin(a * 13 + 2) * 1 + (i % 6 === 0 ? 3 : 0); blob.push((80 + Math.cos(a) * r).toFixed(1) + ' ' + (80 + Math.sin(a) * r).toFixed(1)); }
  $('.wax-blob').setAttribute('d', 'M' + blob.join(' L') + 'Z');
  const envCard = document.createElement('div'); envCard.className = 'env-card';
  envCard.style.cssText = 'position:absolute;left:5%;right:5%;top:6%;height:86%;z-index:2;background:var(--linen) 0 0/256px,var(--paper);outline:1px solid rgba(176,141,87,.8);outline-offset:-8px;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-style:italic;font-size:clamp(18px,2.4vw,30px);color:var(--emerald);opacity:0';
  env.insertBefore(envCard, $('.env-front', env));

  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#rcErr');
    const miss = [];
    if (!form.service.value) miss.push('услугу');
    if (!form.day.value) miss.push('день');
    if (!form.time.value) miss.push('час');
    if (name.value.trim().length < 2) miss.push('имя');
    if (miss.length) { err.textContent = 'Осталось указать: ' + miss.join(', ') + '.'; return; }
    err.textContent = '';
    envCard.textContent = 'R.S.V.P. · ' + name.value.trim();
    const d = new Date(form.day.value);
    $('#rdSub').textContent = `${name.value.trim()}, вас ждали бы ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${form.time.value}: ${form.service.value.toLowerCase()}, мастер — ${form.master.value === 'Любой мастер' ? 'любой свободный' : form.master.value}. Данные никуда не отправлены.`;
    seal();
  });
  function seal() {
    stage.classList.add('sent');
    if (!gsap || reduce) {
      form.style.display = 'none'; env.style.opacity = 1; envCard.style.opacity = 1; gsap && gsap.set(flap, { rotationX: 0, zIndex: 5 });
      flap.style.transform = 'rotateX(0deg)'; flap.style.zIndex = 5; wax.style.opacity = 1; doneBox.hidden = false; return;
    }
    const fr = form.getBoundingClientRect(), er = env.getBoundingClientRect();
    const sc = (er.width * .9) / fr.width;
    const dy = (er.top + er.height * .05) - fr.top - (fr.height * (1 - sc)) / 2 - er.height * .55;
    const tl = gsap.timeline();
    tl.set(env, { opacity: 0, y: 40 })
      .set(flap, { rotationX: 180, zIndex: 1 })
      .set(wax, { opacity: 0, scale: 2.4, rotation: -25 })
      .to(form, { scale: sc, y: dy, duration: .9, ease: 'power3.inOut' }, 0)
      .to(env, { opacity: 1, y: 0, duration: .6, ease: 'power2.out' }, .35)
      .set(envCard, { opacity: 1, yPercent: -62 }, .9)
      .to(form, { opacity: 0, duration: .15 }, .9)
      .set(form, { display: 'none' })
      .to(envCard, { yPercent: 0, duration: .7, ease: 'power2.in' })
      .to(flap, { rotationX: 0, duration: .7, ease: 'power2.inOut' }, '+=.05')
      .set(flap, { zIndex: 5 }, '-=.35')
      .to(wax, { opacity: 1, scale: 1, rotation: -8, duration: .45, ease: 'power4.in' })
      .to(env, { y: 6, duration: .08, yoyo: true, repeat: 1 })
      .add(() => { doneBox.hidden = false; gsap.from(doneBox, { opacity: 0, y: 20, duration: .6 }); });
  }
  $('#rsvpAgain').addEventListener('click', () => {
    stage.classList.remove('sent'); doneBox.hidden = true;
    gsap && gsap.set([form, env, envCard, flap, wax], { clearProps: 'all' });
    form.style.display = ''; env.style.opacity = 0; envCard.style.opacity = 0;
    form.reset(); out.innerHTML = ''; prev = ''; bookingNote = ''; renderTimes(); updateSummary();
    if (gsap && !reduce) gsap.from(form, { opacity: 0, y: 30, duration: .6 });
  });
})();
function updateSummary() {
  const f = $('#rsvpForm'), parts = [];
  if (!f) return;
  const m = f.master && f.master.value, s = f.service && f.service.value, d = f.day && f.day.value, t = f.time && f.time.value;
  if (s) parts.push(s.toLowerCase());
  if (m) parts.push(m === 'Любой мастер' ? 'любой мастер' : 'мастер ' + m);
  if (d) parts.push(new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) + (t ? ', ' + t : ''));
  let txt = parts.length ? parts.join(' · ') : 'Выберите мастера, услугу, день и час.';
  if (bookingNote) txt += ` · пожелание: ${bookingNote.toLowerCase()}`;
  $('#rcSummary').textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
}

/* ── ОТЗЫВЫ: записки можно передвигать (на десктопе) */
if (fine) $$('.note').forEach(n => {
  let sx, sy, ox, oy, on = false;
  n.addEventListener('pointerdown', e => {
    on = true; n.setPointerCapture(e.pointerId); n.classList.add('dragging');
    sx = e.clientX; sy = e.clientY; ox = n.offsetLeft; oy = n.offsetTop;
    $$('.note').forEach(o => o.style.zIndex = ''); n.style.zIndex = 10;
    lenis && lenis.stop();
  });
  n.addEventListener('pointermove', e => {
    if (!on) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    n.style.left = ox + dx + 'px'; n.style.top = oy + dy + 'px';
    n.style.transform = `rotate(calc(var(--r) + ${clamp(dx * .02, -6, 6).toFixed(1)}deg)) scale(1.04)`;
  });
  const end = () => { if (!on) return; on = false; n.classList.remove('dragging'); n.style.transform = ''; lenis && lenis.start(); };
  n.addEventListener('pointerup', end); n.addEventListener('pointercancel', end);
});

/* ── точки под каруселями (телефон) */
['.fan', '.gallery', '.board'].forEach(sel => {
  const box = $(sel); if (!box) return;
  const items = [...box.children].filter(c => !c.classList.contains('dots'));
  const dots = document.createElement('div'); dots.className = 'dots'; dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = items.map(() => '<i></i>').join('');
  box.after(dots);
  const upd = () => {
    const c = box.scrollLeft + box.clientWidth / 2; let best = 0, bd = 1e9;
    items.forEach((it, i) => { const d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - c); if (d < bd) { bd = d; best = i; } });
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === best));
  };
  box.addEventListener('scroll', upd, { passive: true }); upd();
});

/* ── появление заголовков секций */
if (gsap && !reduce) {
  $$('.sheet .h-display').forEach(h => gsap.from(h, { y: 60, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 88%', once: true } }));
}
addEventListener('load', () => ScrollTrigger && ScrollTrigger.refresh());
