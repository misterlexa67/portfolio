/* Особняк — процедурные материалы: бумага, дубовые доски, сукно. Без стоковых картинок.
   Классический скрипт: вертикальный дуб нужен дверям входа до первой отрисовки. */
(function () {
  function makeNoise(seed) {
    const a = [...Array(256).keys()];
    let s = (seed * 9301 + 49297) % 2147483647 || 1;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) p[i] = a[i & 255];
    return (x, y, px = 256, py = 256) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px, y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const h = (X, Y) => p[p[X & 255] + (Y & 255)] / 255;
      const A = h(x0, y0), B = h(x1, y0), C = h(x0, y1), D = h(x1, y1);
      return A + (B - A) * u + (C - A) * v + (A - B - C + D) * u * v;
    };
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  /* Плотная бумага: еле заметные волокна и мягкая неравномерность. Тайл бесшовный. */
  function paper(size, seed, base = [239, 230, 210]) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size), d = img.data, N = makeNoise(seed);
    const P = size / 32;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const m = N(x / 32, y / 32, P, P) * .6 + N(x / 8 + 9, y / 8, P * 4, P * 4) * .4;
      const v = (m - .5) * 7 + (Math.random() - .5) * 3.2;
      const i = (y * size + x) * 4;
      d[i] = base[0] + v; d[i + 1] = base[1] + v; d[i + 2] = base[2] + v * 1.1; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const R = rng(seed * 31);
    g.lineCap = 'round';
    for (let i = 0; i < size * 2.4; i++) {
      const x = R() * size, y = R() * size, len = 3 + R() * 12, a = (R() - .5) * 1.2 + (R() < .5 ? 0 : Math.PI);
      const dark = R() < .55;
      g.strokeStyle = dark ? `rgba(120,95,55,${.05 + R() * .07})` : `rgba(255,252,240,${.12 + R() * .14})`;
      g.lineWidth = .5 + R() * .5;
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const X = x + ox, Y = y + oy;
        if (X < -20 || X > size + 20 || Y < -20 || Y > size + 20) continue;
        g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + Math.cos(a) * len * .5 + (R() - .5) * 2, Y + Math.sin(a) * len * .5 + (R() - .5) * 2, X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
      }
    }
    return c;
  }

  /* Дубовые доски: волокна вдоль доски, мягкие «соборные» кольца, фаска между досками.
     Тайл повторяется без шва: границы досок совпадают с краями тайла. */
  function planks(len, pw, n, horizontal, seed) {
    const W = horizontal ? len : pw * n, H = horizontal ? pw * n : len;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H), d = img.data, N = makeNoise(seed), M = makeNoise(seed + 5);
    const WL = len / 4; // длина волны рисунка вдоль доски — тайл бесшовный
    const tint = Array.from({ length: n }, (_, i) => .9 + ((i * 7919 + seed * 13) % 23) / 23 * .2);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = horizontal ? x : y, v = horizontal ? y : x;
      const k = Math.floor(v / pw), vl = v - k * pw;
      const warp = N(u / WL, k * 3.7, 4, 256) * 1 + N(u / (WL / 4), k * 3.7 + 1.3, 16, 256) * .22;
      const t = vl + (warp - .5) * 46 + Math.sin(u / len * Math.PI * 2 + k) * 8;
      const ring = .5 + .5 * Math.sin(t * .17 + k * 2.1);
      let late = Math.pow(ring, 6);
      const fiber = M(u / (len / 128), v * .9, 128, 256);
      const fine = M(u / (len / 256) + 40, v * 2.2, 256, 256);
      let dark = .35 + late * .38 + (fiber - .5) * .3 + (fine - .5) * .18 + (warp - .6) * .2;
      if (vl < 1.5 || vl > pw - 1.5) dark = .95;
      else if (vl < 3) dark -= .12;
      dark = dark < 0 ? 0 : dark > 1 ? 1 : dark;
      const tt = tint[k];
      const i = (y * W + x) * 4;
      d[i] = (118 + (40 - 118) * dark) * tt; d[i + 1] = (82 + (25 - 82) * dark) * tt; d[i + 2] = (54 + (15 - 54) * dark) * tt; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function felt(size, seed) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const img = g.createImageData(size, size), d = img.data, N = makeNoise(seed);
    const P = size / 8;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const a = N(x / 8, y / 8, P, P);
      const v = (a - .5) * .45 + (Math.random() - .5) * .5;
      const i = (y * size + x) * 4;
      d[i] = 15 + v * 12; d[i + 1] = 42 + v * 18; d[i + 2] = 34 + v * 15; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  const url = c => { try { return c.toDataURL('image/webp', .9); } catch (e) { return c.toDataURL(); } };
  const st = document.documentElement.style;
  const pap = paper(320, 5);
  const oakV = planks(720, 110, 3, false, 3);
  st.setProperty('--paper-tex', `url(${url(pap)})`);
  st.setProperty('--oak-v', `url(${url(oakV)})`);
  window.OSB = { makeNoise, paper: pap, linen: pap, oakV };

  const later = () => {
    const oakH = planks(1280, 128, 5, true, 8), fe = felt(256, 21);
    st.setProperty('--oak-h', `url(${url(oakH)})`);
    st.setProperty('--felt', `url(${url(fe)})`);
    window.OSB.oakH = oakH;
  };
  if (window.requestIdleCallback) requestIdleCallback(later, { timeout: 300 }); else setTimeout(later, 40);
})();
