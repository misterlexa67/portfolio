/* Эффекты «Глянца»: набор заголовков, инспекционный фонарь, капли на керамике, блик логотипа */

const GLYPHS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ0123456789';

/* Заголовок «набирается»: буквы перебираются и встают на место слева направо */
export function scramble(el, dur = 650) {
  const final = el.dataset.t || el.textContent;
  el.dataset.t = final;
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur);
    const settled = Math.floor(final.length * k * k * (3 - 2 * k) + 0.0001);
    let s = '';
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      s += i < settled || ch === ' ' || ch === '/' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = s;
    if (k < 1) requestAnimationFrame(step); else el.textContent = final;
  };
  requestAnimationFrame(step);
}

/* ── Инспекционный фонарь */
function paintDefects(cv) {
  const g = cv.getContext('2d'), n = cv.width, c = n / 2;
  g.clearRect(0, 0, n, n);
  g.lineCap = 'round';
  // голограммы: концентрические дуги вокруг источника света — так они видны в реальности
  for (let i = 0; i < 900; i++) {
    const r = 20 + Math.pow(Math.random(), 0.7) * (n * 0.46);
    const a = Math.random() * Math.PI * 2;
    const len = (0.05 + Math.random() * 0.3) * (90 / Math.max(90, r)) * 2.4;
    const near = 1 - r / (n * 0.5);
    g.strokeStyle = `rgba(255,255,255,${(0.1 + near * 0.7 * Math.random()).toFixed(3)})`;
    g.lineWidth = 0.8 + Math.random() * 1.1;
    g.beginPath(); g.arc(c, c, r, a, a + len); g.stroke();
  }
  // радужный отлив голограмм
  for (let i = 0; i < 160; i++) {
    const r = 30 + Math.random() * n * 0.4, a = Math.random() * Math.PI * 2;
    const hue = (a / Math.PI * 180 + r) % 360;
    g.strokeStyle = `hsla(${hue | 0},90%,70%,${(0.08 + Math.random() * 0.12).toFixed(3)})`;
    g.lineWidth = 1;
    g.beginPath(); g.arc(c, c, r, a, a + 0.18); g.stroke();
  }
  // случайные риски от щёток
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * n, y = Math.random() * n, ang = Math.random() * Math.PI, L = 20 + Math.random() * 110;
    g.strokeStyle = `rgba(255,255,255,${(0.1 + Math.random() * 0.25).toFixed(3)})`;
    g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
  }
}

export function initTorch({ mobile }) {
  const btn = document.querySelector('.inspect');
  const torch = document.querySelector('.torch');
  const dark = torch.querySelector('.torch__dark');
  const defects = torch.querySelector('.torch__defects');
  const SURF = '[data-gl], .ba__frame, .footer, .sec--dark, .spec__col--hot, .drops';
  let on = false, x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = 0, painted = false;
  if (mobile) { torch.style.setProperty('--r1', '70px'); torch.style.setProperty('--r2', '130px'); torch.style.setProperty('--r3', '200px'); }

  const loop = () => {
    x += (tx - x) * 0.35; y += (ty - y) * 0.35;
    dark.style.transform = `translate3d(${(x).toFixed(1)}px,${(y).toFixed(1)}px,0) translate(-50%,-50%)`;
    defects.style.transform = `translate3d(${(x - 280).toFixed(1)}px,${(y - 280).toFixed(1)}px,0)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const surfaceAt = (cx, cy) => {
    const el = document.elementFromPoint(cx, cy);
    torch.classList.toggle('on-surface', !!(el && el.closest(SURF)));
  };
  let lastCheck = 0;
  const move = (cx, cy) => {
    tx = cx; ty = cy; kick();
    const now = performance.now();
    if (now - lastCheck > 80) { lastCheck = now; surfaceAt(cx, cy); }
  };
  const onPointer = e => { if (on) move(e.clientX, e.clientY); };
  const onTouch = e => { if (on && e.touches[0]) move(e.touches[0].clientX, e.touches[0].clientY); };
  const onScroll = () => { if (on) surfaceAt(tx, ty); };

  function set(v) {
    on = v;
    if (on && !painted) { paintDefects(defects); painted = true; }
    document.body.classList.toggle('inspecting', on);
    btn.setAttribute('aria-pressed', String(on));
    if (on) { kick(); surfaceAt(tx, ty); }
  }
  btn.addEventListener('click', () => set(!on));
  torch.querySelector('.torch__exit').addEventListener('click', () => set(false));
  addEventListener('keydown', e => { if (e.key === 'Escape' && on) set(false); });
  addEventListener('pointermove', onPointer, { passive: true });
  addEventListener('pointerdown', onPointer, { passive: true });
  addEventListener('touchmove', onTouch, { passive: true });
  addEventListener('scroll', onScroll, { passive: true });
  loop();
}

/* ── Капли воды на керамике: собираются в шарики и скатываются */
export function initDrops() {
  const row = document.querySelector('[data-drops]');
  if (!row) return;
  const cv = row.querySelector('.drops canvas');
  const g = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1, drops = [], raf = 0, on = false, t0 = 0, bg = null;

  function size() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(120, r.width); H = Math.max(60, r.height || 150);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // фон — тёмный лак с бликом
    bg = document.createElement('canvas'); bg.width = cv.width; bg.height = cv.height;
    const b = bg.getContext('2d'); b.scale(dpr, dpr);
    const gr = b.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#060606'); gr.addColorStop(0.5, '#161617'); gr.addColorStop(1, '#0a0a0a');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    const hl = b.createLinearGradient(0, H * 0.15, 0, H * 0.45);
    hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.5, 'rgba(255,255,255,.22)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    b.fillStyle = hl; b.fillRect(0, 0, W, H);
  }
  const spawn = (n = 1) => { for (let i = 0; i < n; i++) drops.push({ x: Math.random() * W, y: Math.random() * H * 0.85, r: 1 + Math.random() * 1.6, vx: 0, vy: 0, g: 0.8 + Math.random() * 1.8 }); };

  function drawDrop(d) {
    const { x, y, r } = d;
    g.fillStyle = 'rgba(0,0,0,.45)';                               // тень
    g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.35, r * 1.02, r * 0.92, 0, 0, 7); g.fill();
    const body = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    body.addColorStop(0, 'rgba(255,255,255,.05)'); body.addColorStop(0.7, 'rgba(30,30,32,.55)'); body.addColorStop(1, 'rgba(220,225,230,.55)');
    g.fillStyle = body; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)';                         // каустика снизу
    g.beginPath(); g.ellipse(x + r * 0.15, y + r * 0.45, r * 0.45, r * 0.22, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)';                         // блик
    g.beginPath(); g.arc(x - r * 0.35, y - r * 0.38, Math.max(0.6, r * 0.22), 0, 7); g.fill();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    if (drops.length < 70 && t < 1.2) spawn(3);
    if (t > 1.2 && Math.random() < 0.25) spawn(1);
    // рост и слияние
    for (const d of drops) if (d.r < 6.5 && t < 1.8) d.r += 0.08 * d.g;
    for (let i = 0; i < drops.length; i++) for (let j = i + 1; j < drops.length; j++) {
      const a = drops[i], b = drops[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < (a.r + b.r) * (a.r + b.r) * 0.7) {
        const big = a.r >= b.r ? a : b, small = big === a ? b : a;
        big.x = (big.x * big.r * big.r + small.x * small.r * small.r) / (big.r * big.r + small.r * small.r);
        big.r = Math.sqrt(big.r * big.r + small.r * small.r);
        small.r = 0;
      }
    }
    drops = drops.filter(d => d.r > 0 && d.y < H + 12 && d.x < W + 12);
    // крупные капли скатываются (поверхность наклонена вправо-вниз)
    for (const d of drops) if (d.r > 8.5) { d.vy += 0.05 * d.r * 0.25; d.vx += 0.02 * d.r * 0.25; d.x += d.vx; d.y += d.vy; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(bg, 0, 0, W, H);
    for (const d of drops) drawDrop(d);
    if (!on && t > 0.4) { cancelAnimationFrame(raf); raf = 0; }
  }
  function start() {
    if (on) return;
    on = true; row.classList.add('drops-on');
    requestAnimationFrame(() => { size(); drops = []; t0 = performance.now(); if (!raf) raf = requestAnimationFrame(frame); });
  }
  function stop() { on = false; row.classList.remove('drops-on'); }
  const touch = matchMedia('(hover: none)').matches;
  if (!touch) {
    row.addEventListener('pointerenter', start);
    row.addEventListener('pointerleave', stop);
  }
  if (touch) row.addEventListener('click', () => (on ? stop() : start()));
  row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on ? stop() : start(); } });
}

/* ── Глянцевый логотип: блик бежит за курсором */
export function initShine() {
  const el = document.querySelector('.footer__giant');
  const foot = document.querySelector('.footer');
  if (!el || matchMedia('(hover: none)').matches) return;
  foot.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
  }, { passive: true });
}
