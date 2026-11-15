/* Силуэт в профиль — техника «бронзированного силуэта»: вырезанная тёмная бумага,
   волосы и борода прописаны тонкой золотой линией. Параметры: top, fade, beard, mus (0/1/2), glasses, flip. */
const NS = 'http://www.w3.org/2000/svg';
let UID = 0;
const lerp = (a, b, t) => a + (b - a) * t;

function bez(p0, p1, p2, p3, n) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return o;
}
function spline(pts, n = 8) {
  const o = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      o.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  o.push(pts[pts.length - 1]);
  return o;
}
function resample(pts, n) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[L.length - 1], o = [];
  let j = 1;
  for (let i = 0; i < n; i++) {
    const d = tot * i / (n - 1);
    while (j < L.length - 1 && L[j] < d) j++;
    const t = (d - L[j - 1]) / ((L[j] - L[j - 1]) || 1);
    o.push([lerp(pts[j - 1][0], pts[j][0], t), lerp(pts[j - 1][1], pts[j][1], t)]);
  }
  return o;
}
const toD = (pts, close) => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + (close ? 'Z' : '');

/* профиль, смотрит вправо; viewBox 0 0 400 460 */
const HEAD = 'M266 128 C279 143 285 162 284 180 C284 188 287 193 289 198 C289 201 287 203 287 205 C293 216 302 228 309 238 C311 242 308 247 301 249 C297 250 294 251 292 254 C291 258 293 261 294 264 C295 268 291 271 288 273 C291 276 293 280 292 284 C291 287 288 289 287 291 C289 296 292 302 291 308 C290 316 285 321 279 323 C268 326 257 328 249 331 C244 338 242 348 245 356 C246 362 240 368 237 374 C235 378 235 381 237 384 C262 390 302 398 338 416 C360 428 374 444 384 466 L16 466 C24 426 62 396 102 380 C120 373 128 362 131 346 C134 326 136 306 138 288 C128 270 116 240 112 206 C106 166 124 120 160 104 C196 88 240 98 266 128 Z';
const SKULL = [
  ...bez([266, 128], [240, 98], [196, 88], [160, 104], 16),
  ...bez([160, 104], [124, 120], [106, 166], [112, 206], 16).slice(1),
  ...bez([112, 206], [116, 240], [128, 270], [138, 288], 10).slice(1)
];
const HAIRLINE = spline([[266, 128], [254, 146], [244, 170], [239, 198], [237, 226], [224, 216], [210, 204], [190, 198], [171, 205], [160, 232], [149, 262], [138, 288]], 6);
const CHEEK = spline([[236, 224], [244, 244], [259, 258], [274, 267], [283, 279], [289, 296], [292, 308]], 6);
const JAW = spline([[214, 232], [208, 268], [222, 302], [249, 331], [268, 326], [281, 322], [292, 308]], 6);

function el(parent, tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.appendChild(e);
  return e;
}
function seeded(seed) { let s = seed * 9973 % 2147483647 || 7; return () => (s = s * 16807 % 2147483647) / 2147483647; }

export function createBust(svg, init = {}) {
  const id = 'sb' + (++UID);
  const ink = init.ink || '#0F2A22', paper = init.paper || '#EFE6D2', gold = init.gold || '#C9A46A';
  svg.setAttribute('viewBox', '0 0 400 460');
  svg.innerHTML = '';
  const defs = el(svg, 'defs');
  defs.innerHTML = `
    <linearGradient id="${id}fg" gradientUnits="userSpaceOnUse" x1="0" y1="140" x2="0" y2="290">
      <stop offset="0" stop-color="#fff"/><stop class="f1" offset=".5" stop-color="#fff"/><stop class="f2" offset=".7" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="${id}fm" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="460"><rect width="400" height="460" fill="url(#${id}fg)"/></mask>
    <filter id="${id}cut" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="1.2" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity=".28"/></filter>`;

  if (!init.noMat) {
    el(svg, 'rect', { width: 400, height: 460, fill: paper });
    el(svg, 'ellipse', { cx: 200, cy: 236, rx: 176, ry: 212, fill: 'none', stroke: ink, 'stroke-width': .8, opacity: .5 });
    el(svg, 'ellipse', { cx: 200, cy: 236, rx: 170, ry: 206, fill: 'none', stroke: ink, 'stroke-width': .4, opacity: .4 });
  }
  const fig = el(svg, 'g');
  if (init.flip) fig.setAttribute('transform', 'translate(400 0) scale(-1 1)');
  const solid = el(fig, 'g', { fill: ink, filter: `url(#${id}cut)` });
  el(solid, 'path', { d: HEAD });
  const hairFill = el(solid, 'path', {});
  const beardFill = el(solid, 'path', {});
  const musFill = el(solid, 'path', {});

  const det = el(fig, 'g', { fill: 'none', stroke: gold, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  // одежда и черты — золотой прописью
  el(det, 'path', { d: 'M126 378 C164 390 210 391 237 385', 'stroke-width': 1.1, opacity: .85 });
  el(det, 'path', { d: 'M237 386 C260 408 276 432 286 466 M223 390 C238 414 246 438 250 466', 'stroke-width': .9, opacity: .6 });
  if ((init.tie || 'bow') === 'bow') el(det, 'path', { d: 'M238 388 L252 381 L252 400 Z M238 388 L226 383 L227 397 Z', fill: gold, stroke: 'none', opacity: .9 });
  else el(det, 'path', { d: 'M236 388 L246 392 L244 430 L234 434 L230 398 Z', 'stroke-width': .9, opacity: .75 });
  el(det, 'path', { d: 'M258 204 C263 202 268 202 272 205', 'stroke-width': 1.1, opacity: .75 });
  el(det, 'path', { d: 'M195 210 C183 205 172 214 174 230 C175 245 182 257 193 260 M190 220 C183 222 182 232 186 240', 'stroke-width': .7, opacity: .35 });
  const hairLines = el(det, 'g', { mask: `url(#${id}fm)` });
  const beardLines = el(det, 'g');
  const musLines = el(det, 'g');
  const glassG = el(det, 'g');

  const state = { top: .5, fade: .4, beard: 0, mus: 0, glasses: false, ...init };
  const rnd = seeded(init.seed || 3);
  const jit = Array.from({ length: 512 }, () => rnd() - .5);
  const f1 = defs.querySelector('.f1'), f2 = defs.querySelector('.f2');

  function hair() {
    const t = state.top, fade = state.fade, n = 72;
    const sk = resample(SKULL, n), hl = resample(HAIRLINE, n);
    const top = sk.map((p, i) => {
      const s = i / (n - 1), a = sk[Math.max(0, i - 1)], b = sk[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      const quiff = 56 * Math.exp(-(((s - .1) / .13) ** 2)) + 18 * Math.exp(-(((s - .34) / .2) ** 2));
      const d = 2.5 + t * quiff + (1 - fade) * 5 * Math.max(0, s - .45);
      const fwd = t * 22 * Math.exp(-((s / .07) ** 2));
      return [p[0] + nx * d + fwd, p[1] + ny * d - fwd * .4];
    });
    hairFill.setAttribute('d', toD([...top, ...hl.slice().reverse()], true));
    let d = '';
    const K = 22;
    for (let k = 1; k < K; k++) {
      const a = Math.pow(k / K, .9);
      const pts = [];
      for (let i = 2; i < n - 2; i++) {
        const p = top[i], q = hl[i], w = Math.sin(i / (n - 1) * Math.PI);
        const j = jit[(k * 11 + i) % 512] * 1.2 * w;
        pts.push([lerp(p[0], q[0], a) + j, lerp(p[1], q[1], a) + j * .5]);
      }
      d += toD(pts) + ' ';
    }
    hairLines.innerHTML = '';
    el(hairLines, 'path', { d, 'stroke-width': t < .22 ? .75 : .55, opacity: .62, 'stroke-dasharray': t < .22 ? '1.4 2.2' : 'none' });
    const hi = .8 - fade * .55;
    f1.setAttribute('offset', Math.max(.02, hi).toFixed(3));
    f2.setAttribute('offset', Math.min(1, hi + .12 + (1 - fade) * .32).toFixed(3));
  }

  function beard() {
    const b = state.beard, n = 64;
    beardLines.innerHTML = '';
    if (b < .04) { beardFill.setAttribute('d', ''); return; }
    const inner = resample(CHEEK, n), jaw = resample(JAW, n);
    const full = b >= .3;
    const outer = jaw.map((p, i) => {
      const s = i / (n - 1);
      let dx = p[0] - 252, dy = p[1] - 248;
      const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const w = full ? b * 40 * (.35 + .9 * s) : 0;
      return [p[0] + dx * w * .8, p[1] + dy * w];
    });
    if (!full) {
      beardFill.setAttribute('d', '');
      const k = (b - .04) / .26;
      let d = '';
      const cnt = 220 + k * 380;
      for (let i = 0; i < cnt; i++) {
        const s = (i * .7548) % 1, u = (i * .5698) % 1;
        const a = inner[Math.floor(s * (n - 1))], c = jaw[Math.floor(s * (n - 1))];
        const x = lerp(a[0], c[0], u), y = lerp(a[1], c[1], u);
        d += `M${x.toFixed(1)} ${y.toFixed(1)} l.35 .7 `;
      }
      el(beardLines, 'path', { d, 'stroke-width': .7, opacity: .3 + k * .45 });
      return;
    }
    beardFill.setAttribute('d', toD([...inner, ...outer.slice().reverse()], true));
    let d = '';
    for (let i = 0; i < 120; i++) {
      const s = i / 119, idx = s * (n - 1), i0 = Math.floor(idx), f = idx - i0, i1 = Math.min(n - 1, i0 + 1);
      const ax = lerp(inner[i0][0], inner[i1][0], f), ay = lerp(inner[i0][1], inner[i1][1], f);
      const cx = lerp(outer[i0][0], outer[i1][0], f), cy = lerp(outer[i0][1], outer[i1][1], f);
      const j = jit[i % 512] * 3;
      d += `M${(ax + 2).toFixed(1)} ${(ay + 2).toFixed(1)} Q${(lerp(ax, cx, .5) + 3 + j).toFixed(1)} ${(lerp(ay, cy, .5) + 2).toFixed(1)} ${(cx - 1 + j * .5).toFixed(1)} ${(cy - 2).toFixed(1)} `;
    }
    el(beardLines, 'path', { d, 'stroke-width': .5, opacity: .55 });
  }

  function mustache() {
    musLines.innerHTML = '';
    const m = state.mus || (state.beard > .45 ? 1 : 0);
    if (!m) { musFill.setAttribute('d', ''); return; }
    musFill.setAttribute('d', m === 2
      ? 'M276 256 C284 251 292 252 297 258 C304 260 310 256 313 249 C317 257 311 269 298 268 C291 270 283 268 276 266 Z'
      : 'M276 256 C284 251 292 253 297 259 C299 266 293 270 286 269 C281 268 278 267 274 266 Z');
    let d = '';
    for (let i = 0; i < 14; i++) { const x = 278 + i * 1.4; d += `M${x.toFixed(1)} 256 l${(1.6 + i * .1).toFixed(1)} 9 `; }
    el(musLines, 'path', { d, 'stroke-width': .5, opacity: .55 });
  }

  function glasses() {
    glassG.innerHTML = '';
    if (!state.glasses) return;
    el(glassG, 'ellipse', { cx: 281, cy: 207, rx: 3.2, ry: 10, 'stroke-width': 1.3 });
    el(glassG, 'path', { d: 'M278 199 L200 207 C196 208 195 211 196 215', 'stroke-width': 1.1 });
  }

  function update(p = {}) { Object.assign(state, p); hair(); beard(); mustache(); glasses(); }
  update();
  return { update, state, svg };
}

export function describeCut({ top, fade, beard }) {
  const T = top < .3 ? 0 : top < .64 ? 1 : 2, F = fade < .28 ? 0 : fade < .62 ? 1 : 2;
  const names = [
    ['Классический полубокс', 'Кроп с мид-фейдом', 'Бокс со скин-фейдом'],
    ['Канадка', 'Канадка с фейдом', 'Зачёс с высоким фейдом'],
    ['Джентльменский зачёс', 'Помпадур', 'Помпадур со скин-фейдом']
  ];
  let beardTxt = '', price = 2400, time = 60;
  if (beard >= .04 && beard < .3) { beardTxt = 'и оформление щетины'; price = 2900; time += 15; }
  else if (beard >= .3 && beard < .66) { beardTxt = 'и короткая борода'; price = 3600; time += 30; }
  else if (beard >= .66) { beardTxt = 'и полная борода'; price = 3600; time += 40; }
  if (F === 2) time += 15;
  let master = 'Семён Ярцев';
  if (beard >= .3) master = 'Лев Корнилов';
  else if (F === 2 || T === 0) master = 'Тимур Галеев';
  else if (T === 2) master = 'Аркадий Белозёров';
  return { name: names[T][F], beardTxt, price, time, master };
}
