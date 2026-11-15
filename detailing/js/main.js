import { paintAfter, paintBefore, sizeCanvas } from './ba.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const qs = new URLSearchParams(location.search);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mobile = coarse || innerWidth < 900;
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;

if (!gsap || !ScrollTrigger) { root.classList.remove('js'); }
else gsap.registerPlugin(ScrollTrigger);

/* ── способность устройства к 3D */
function canGL() {
  if (qs.has('static')) return false;
  if (qs.has('gl')) return true;
  if (reduce) return false;
  if (navigator.connection && navigator.connection.saveData) return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores < 4 || mem < 3) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
const useGL = canGL();
if (!useGL) root.classList.add('no-gl');

/* ── Lenis + ScrollTrigger (на тач-устройствах скролл нативный) */
let lenis = null;
if (!reduce && window.Lenis && gsap) {
  lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToHash(hash) {
  const el = hash === '#top' ? document.body : $(hash);
  if (!el) return;
  const off = -(parseInt(getComputedStyle(root).getPropertyValue('--header')) || 64) - 8;
  if (lenis) lenis.scrollTo(el, { offset: off, duration: 1.4 });
  else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const h = a.getAttribute('href');
  if (h.length < 2) return;
  e.preventDefault();
  closeMenu();
  scrollToHash(h);
}));

/* ── меню */
const burger = $('.burger'), menu = $('.menu');
function closeMenu() {
  if (!menu.classList.contains('open')) return;
  menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true'); document.body.classList.remove('menu-open');
}
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('open');
  menu.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open)); document.body.classList.toggle('menu-open', open);
});
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

/* ── набор цифр как на приборе */
function typeIn(el, dur = 800) {
  const final = el.dataset.v || el.textContent;
  el.dataset.v = final;
  if (reduce) { el.textContent = final; return; }
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const n = Math.floor(final.length * k);
    let s = '';
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      s += i < n || !/\d/.test(ch) ? ch : String((Math.random() * 10) | 0);
    }
    el.textContent = s;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── HERO */
let hero = null;
const heroHost = $('[data-gl="hero"]');
let introDone = false;
function heroIntro() {
  if (!gsap || reduce) { introDone = true; hero && hero.showTags(0); return; }
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero__title .ln>span', { y: 0, duration: 1.3, stagger: 0.12 }, 0.1)
    .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.55)
    .fromTo('.hero__media', { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' }, 0)
    .add(() => { introDone = true; hero && hero.showTags(0); }, 1.1);
}
async function bootHero() {
  if (!useGL) return;
  try {
    const m = await import('./gl-hero.js');
    hero = m.initHero({ host: heroHost, mobile, onWeak: () => { root.classList.add('no-gl'); hero = null; $$('.tag').forEach(t => t.classList.add('on')); } });
  } catch (err) { console.warn('[glyanets] 3D отключено', err); root.classList.add('no-gl'); }
}

/* ── СЕЧЕНИЕ */
let layersGL = null;
const stage = $('[data-gl="layers"]');
const listItems = $$('.layers__list li');
const svcItems = $$('.layers__svc li');
const pct = $('.layers__pct');
function applyPhase(p) {
  const e = Math.min(1, Math.max(0, (p - 0.02) / 0.34));
  const idx = p < 0.38 ? Math.min(3, Math.floor(e * 4.2)) : -1;
  listItems.forEach((li, i) => li.classList.toggle('on', p < 0.38 ? i <= idx && e > 0.05 : i === 0));
  const ph = p < 0.38 ? -1 : p < 0.56 ? 0 : p < 0.72 ? 1 : 2;
  svcItems.forEach((li, i) => { li.classList.toggle('on', i === ph); li.classList.toggle('done', ph > i); });
  pct.textContent = String(Math.round(p * 100)).padStart(3, '0');
}
async function bootLayers() {
  if (useGL) {
    try {
      const m = await import('./gl-layers.js');
      layersGL = m.initLayers({ host: stage, mobile });
      if (qs.has('gl')) window.__layers = layersGL; // хук для генерации статичной картинки
    } catch (err) { console.warn('[glyanets] сечение без 3D', err); root.classList.add('no-gl'); }
  }
  if (!gsap) return;
  ScrollTrigger.create({
    trigger: stage, start: 'top 95%', end: 'center 30%', scrub: true,
    onUpdate: s => { layersGL && layersGL.setProgress(s.progress); applyPhase(s.progress); },
  });
  if (reduce) { layersGL && layersGL.setProgress(0.8); applyPhase(0.8); }
}

/* ── появления */
function reveals() {
  if (!gsap) return;
  if (reduce) return;
  $$('.sec .display .ln>span').forEach(el => {
    gsap.to(el, { y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el.closest('.display'), start: 'top 88%', once: true } });
  });
  $$('[data-reveal]').forEach(el => {
    gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  // таблица: строки по очереди, цифры набираются
  ScrollTrigger.create({
    trigger: '.table', start: 'top 80%', once: true,
    onEnter: () => {
      gsap.from('.table__row, .table__group', { opacity: 0, y: 18, duration: 0.8, stagger: 0.08, ease: 'expo.out' });
      $$('.table [data-type]').forEach((el, i) => setTimeout(() => typeIn(el, 700), 200 + i * 70));
    },
  });
  // линии-разделители секций прорисовываются
  $$('.sec').forEach(sec => {
    gsap.fromTo(sec, { '--rule': 0 }, { '--rule': 1, duration: 1.4, ease: 'expo.inOut', scrollTrigger: { trigger: sec, start: 'top 85%', once: true } });
  });
  // протокол: линия прогресса
  const vertical = innerWidth < 900;
  gsap.to('.steps__line i', {
    [vertical ? 'scaleY' : 'scaleX']: 1, ease: 'none',
    scrollTrigger: { trigger: '.steps', start: vertical ? 'top 70%' : 'top 75%', end: vertical ? 'bottom 60%' : 'top 30%', scrub: true,
      onUpdate: s => $$('.step').forEach((st, i) => st.classList.toggle('on', s.progress >= i / 4 + 0.02)) },
  });
  // уход: иконки рисуются
  $$('.care__list li').forEach((li, i) => { li.style.transitionDelay = `${i * 60}ms`; });
  // параллакс (только десктоп — на телефоне экономим кадры)
  if (!mobile) {
    gsap.to('.hero__in', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.report--b', { y: -70, ease: 'none', scrollTrigger: { trigger: '.reports', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.to('.report--c', { y: -30, ease: 'none', scrollTrigger: { trigger: '.reports', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.footer__giant', { xPercent: 6 }, { xPercent: -4, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    gsap.to('.ba__read', { y: -40, ease: 'none', scrollTrigger: { trigger: '.ba', start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  // чертёжная сетка иногда проявляется на стыке секций
  const bp = $('.blueprint');
  $$('.sec').forEach((sec, i) => {
    if (i % 2) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 60%', onEnter: () => gsap.fromTo(bp, { opacity: 0 }, { opacity: 0.55, duration: 0.5, yoyo: true, repeat: 1, repeatDelay: 0.5, ease: 'power2.inOut', overwrite: true }) });
  });
}

/* ── ДО/ПОСЛЕ */
function beforeAfter() {
  const frame = $('.ba__frame');
  const cA = $('.ba__after'), cB = $('.ba__before');
  const gu = $('.ba__gu'), info = $('.ba__info');
  let painted = false;
  const paint = () => { sizeCanvas(cA, frame); sizeCanvas(cB, frame); paintAfter(cA); paintBefore(cB); painted = true; };
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { paint(); o.disconnect(); } }, { rootMargin: '400px' }).observe(frame);
  let rw = 0;
  new ResizeObserver(() => { const w = frame.clientWidth; if (painted && Math.abs(w - rw) > 40) { rw = w; paint(); } else rw = w; }).observe(frame);

  let p = 0.5, shown = -1;
  const set = v => {
    p = Math.min(1, Math.max(0, v));
    frame.style.setProperty('--p', p.toFixed(4));
    const g = Math.round(92 - 51 * p);
    if (g !== shown) {
      shown = g; gu.textContent = g;
      info.style.setProperty('--gu', g);
      frame.setAttribute('aria-valuenow', g); frame.setAttribute('aria-valuetext', `${g} GU`);
    }
  };
  set(0.5);
  let drag = false, sx = 0, sy = 0, decided = false, horiz = false;
  const pos = e => { const r = frame.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  frame.addEventListener('pointerdown', e => {
    drag = true; decided = e.pointerType === 'mouse'; horiz = decided; sx = e.clientX; sy = e.clientY;
    if (horiz) { frame.setPointerCapture(e.pointerId); frame.classList.add('drag'); set(pos(e)); }
    intro && intro.kill();
  });
  frame.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!decided) {
      const dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
      if (dx + dy < 6) return;
      decided = true; horiz = dx > dy;
      if (horiz) { frame.setPointerCapture(e.pointerId); frame.classList.add('drag'); }
    }
    if (horiz) set(pos(e));
  });
  const end = () => { drag = false; frame.classList.remove('drag'); };
  frame.addEventListener('pointerup', end); frame.addEventListener('pointercancel', end);
  // на тач-экране тянуть пальцем по горизонтали, вертикальный свайп листает страницу
  frame.addEventListener('touchmove', e => { if (horiz && drag) e.preventDefault(); }, { passive: false });
  frame.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { set(p - 0.05); e.preventDefault(); }
    if (e.key === 'ArrowRight') { set(p + 0.05); e.preventDefault(); }
  });
  // подсказка: ручка сама проходит туда-обратно при первом показе
  let intro = null;
  if (gsap && !reduce) {
    const o = { v: 0.5 };
    intro = gsap.timeline({ paused: true })
      .to(o, { v: 0.88, duration: 1.1, ease: 'power3.inOut', onUpdate: () => set(o.v) })
      .to(o, { v: 0.3, duration: 1.4, ease: 'power3.inOut', onUpdate: () => set(o.v) });
    ScrollTrigger.create({ trigger: frame, start: 'top 65%', once: true, onEnter: () => intro.play() });
  }
}

/* ── пакеты (вкладки на телефоне) */
function packs() {
  const grid = $('.spec__grid');
  const cols = $$('.spec__col[data-pack]');
  const tabs = $$('[data-pack-tab]');
  const show = i => {
    tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
    cols.forEach((c, k) => c.classList.toggle('is-on', k === i));
    grid.dataset.active = i;
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  show(1);
  // свайп между пакетами
  let x0 = null;
  grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) < 50) return;
    const cur = +grid.dataset.active;
    show(Math.max(0, Math.min(2, cur + (dx < 0 ? 1 : -1))));
  }, { passive: true });
}

/* ── калькулятор: цены совпадают с таблицей */
const PRICE = { polish: 18000, ceramic: 22000, ppf: 45000, clean: 12000 };
const NAME = { polish: 'Полировка', ceramic: 'Керамика', ppf: 'Плёнка PPF', clean: 'Химчистка' };
const PACKS = [['clean', 'polish'], ['polish', 'ceramic'], ['polish', 'ceramic', 'ppf']];
const PACK_NAME = ['Освежить', 'Восстановить', 'Защитить'];
const CLS_NAME = { '1': 'I', '1.2': 'II', '1.4': 'III', '1.6': 'IV' };
const rub = n => n.toLocaleString('ru-RU').replace(/ | /g, ' ') + ' ₽';
let calcState = { cls: '1', svc: ['polish', 'ceramic'] };
function calc() {
  const form = $('.calc');
  const out = form.querySelector('output');
  const lines = $('.calc__lines');
  let prev = 0;
  const update = () => {
    const k = +form.querySelector('[name=cls]:checked').value;
    const svc = $$('[name=svc]:checked', form).map(i => i.value);
    calcState = { cls: String(k), svc };
    let total = 0;
    lines.innerHTML = svc.map(s => {
      const v = Math.round(PRICE[s] * k / 100) * 100;
      total += v;
      return `<div><span>${NAME[s]}</span><span>${k === 1 ? '' : (PRICE[s] / 1000).toLocaleString('ru-RU') + ' тыс. × ' + String(k).replace('.', ',') + ' = '}${rub(v)}</span></div>`;
    }).join('') || '<div><span>Отметьте услуги</span></div>';
    if (gsap && !reduce) {
      const o = { v: prev };
      gsap.to(o, { v: total, duration: 0.6, ease: 'power3.out', onUpdate: () => { out.textContent = rub(Math.round(o.v / 100) * 100); } });
    } else out.textContent = rub(total);
    prev = total;
  };
  form.addEventListener('change', update);
  update();
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
    const set = PACKS[+b.dataset.pick];
    $$('[name=svc]', form).forEach(i => { i.checked = set.includes(i.value); });
    update();
    scrollToHash('#calc');
    form.animate([{ boxShadow: '0 0 0 0 rgba(216,255,46,0)' }, { boxShadow: '0 0 0 8px rgba(216,255,46,.9)' }, { boxShadow: '0 0 0 0 rgba(216,255,46,0)' }], { duration: 900, easing: 'ease-out' });
  }));
  // «Записаться с этим расчётом» — переносим выбор в форму записи
  $('.calc__go').addEventListener('click', () => {
    const book = $('.book');
    book.cls.value = CLS_NAME[calcState.cls] || '';
    const key = calcState.svc.slice().sort().join();
    const pi = PACKS.findIndex(p => p.slice().sort().join() === key);
    if (pi >= 0) book.svc.value = PACK_NAME[pi];
    else if (calcState.svc.length === 1) book.svc.value = NAME[calcState.svc[0]];
  });
}

/* ── запись (демо, данные никуда не уходят) */
function booking() {
  const form = $('.book');
  const err = $('.book__err');
  const done = $('.book__done');
  const d = new Date(); d.setDate(d.getDate() + 1);
  form.date.min = d.toISOString().slice(0, 10);
  form.tel.addEventListener('input', () => {
    let v = form.tel.value.replace(/\D/g, '');
    if (v.startsWith('8')) v = '7' + v.slice(1);
    if (!v.startsWith('7')) v = '7' + v;
    v = v.slice(0, 11);
    const p = [v.slice(1, 4), v.slice(4, 7), v.slice(7, 9), v.slice(9, 11)];
    form.tel.value = '+7' + (p[0] ? ' ' + p[0] : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    let bad = [];
    $$('.field', form).forEach(f => {
      const i = f.querySelector('select, input');
      const ok = i.name === 'tel' ? i.value.replace(/\D/g, '').length === 11 : !!i.value;
      f.classList.toggle('bad', !ok);
      if (!ok) bad.push(f.querySelector('.field__n').textContent.split('·')[1].trim());
    });
    if (bad.length) { err.textContent = 'Заполните: ' + bad.join(', ').toLowerCase(); return; }
    err.textContent = '';
    const date = new Date(form.date.value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
    $('.book__done-s').innerHTML = `${form.cls.value} класс · ${form.svc.value} · ${date}<br>Данные никуда не отправлены и не сохранены.`;
    done.hidden = false;
    if (gsap && !reduce) gsap.fromTo(done, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'expo.out' });
  });
  $('.book__reset').addEventListener('click', () => { form.reset(); done.hidden = true; });
}

/* ── док снизу на телефоне */
function dock() {
  const el = $('.dock');
  if (!el || !gsap) return;
  let inHero = true, inBook = false;
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 40%', onToggle: s => { inHero = s.isActive; upd(); } });
  ScrollTrigger.create({ trigger: '#booking', start: 'top 85%', end: 'max', onToggle: s => { inBook = s.isActive; upd(); } });
  function upd() { el.classList.toggle('show', !inHero && !inBook); }
}

/* ── курсор и магнитные кнопки (только десктоп) */
function cursor() {
  if (!fine || reduce || !gsap) return;
  root.classList.add('has-cursor');
  const c = $('.cursor'), txt = $('.cursor__c');
  const xTo = gsap.quickTo(c, 'x', { duration: 0.25, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.25, ease: 'power3' });
  let lx = 0, ly = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    xTo(e.clientX); yTo(e.clientY);
    if (Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly) > 6) {
      lx = e.clientX; ly = e.clientY;
      txt.textContent = `X ${String(Math.round(lx)).padStart(4, '0')} · Y ${String(Math.round(ly + scrollY)).padStart(5, '0')}`;
    }
  }, { passive: true });
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('a, button, label, select, input, [role=slider]');
    c.classList.toggle('hot', !!t);
    c.classList.toggle('drag', !!e.target.closest('.ba__frame'));
  });
  document.addEventListener('pointerleave', () => gsap.to(c, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to(c, { opacity: 1, duration: 0.2 }));

  $$('[data-magnetic]').forEach(b => {
    const bx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'elastic.out(1,0.5)' });
    const by = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'elastic.out(1,0.5)' });
    b.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      bx((e.clientX - r.left - r.width / 2) * 0.22);
      by((e.clientY - r.top - r.height / 2) * 0.3);
    });
    b.addEventListener('pointerleave', () => { bx(0); by(0); });
  });
}

/* ── шкала толщиномера в hero: «живое» показание, ведётся курсором */
function ruler() {
  const r = $('.hero__ruler');
  if (!r || mobile || reduce || !gsap) return;
  const em = r.querySelector('em');
  let my = 0, v = 118, shown = 0, on = true;
  addEventListener('pointermove', e => { my = e.clientY / innerHeight - 0.5; }, { passive: true });
  ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onToggle: s => { on = s.isActive; } });
  gsap.ticker.add(t => {
    if (!on) return;
    const target = 118 + Math.sin(t * 0.9) * 2.5 + Math.sin(t * 2.3) * 0.8 - my * 14;
    v += (target - v) * 0.08;
    const top = ((150 - v) / 150 * 100).toFixed(2) + '%';
    r.style.setProperty('--rv', top);
    const n = Math.round(v);
    if (n !== shown) { shown = n; em.textContent = n + ' мкм'; }
  });
}

/* ── запуск */
ruler();
bootHero().then(() => { if (introDone && hero) hero.showTags(0); });
if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(heroIntro); else heroIntro();
bootLayers();
reveals();
beforeAfter();
packs();
calc();
booking();
dock();
cursor();
addEventListener('load', () => gsap && ScrollTrigger.refresh());
