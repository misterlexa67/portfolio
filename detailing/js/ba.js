/* Процедурные текстуры «до» (паутинка, голограммы, мутность) и «после» (зеркало) */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function streak(g, w, h, pts, width, alpha, blurSteps = 14) {
  for (let i = blurSteps; i >= 1; i--) {
    const k = i / blurSteps;
    g.strokeStyle = `rgba(255,255,255,${(alpha * (1 - k) * 0.22).toFixed(3)})`;
    g.lineWidth = width * (1 + k * 9);
    g.beginPath(); g.moveTo(pts[0] * w, pts[1] * h);
    g.bezierCurveTo(pts[2] * w, pts[3] * h, pts[4] * w, pts[5] * h, pts[6] * w, pts[7] * h);
    g.stroke();
  }
  g.strokeStyle = `rgba(255,255,255,${alpha})`;
  g.lineWidth = width;
  g.beginPath(); g.moveTo(pts[0] * w, pts[1] * h);
  g.bezierCurveTo(pts[2] * w, pts[3] * h, pts[4] * w, pts[5] * h, pts[6] * w, pts[7] * h);
  g.stroke();
}

export function paintAfter(cv) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d');
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#030303'); bg.addColorStop(0.55, '#0c0c0d'); bg.addColorStop(1, '#1a1a1b');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // мягкое отражение неба по краю панели
  const sky = g.createRadialGradient(w * 0.85, h * 1.1, 0, w * 0.85, h * 1.1, w * 0.7);
  sky.addColorStop(0, 'rgba(240,237,229,.26)'); sky.addColorStop(1, 'rgba(240,237,229,0)');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  const m = Math.min(w, h) / 600;
  streak(g, w, h, [-0.05, 0.92, 0.35, 0.55, 0.62, 0.22, 1.05, 0.06], 5 * m, 1);
  streak(g, w, h, [0.1, 1.05, 0.45, 0.78, 0.75, 0.5, 1.08, 0.36], 1.6 * m, 0.8, 10);
  streak(g, w, h, [0.0, 0.3, 0.2, 0.22, 0.35, 0.15, 0.55, 0.0], 1 * m, 0.25, 8);
  // мелкий металлик
  const r = rng(7);
  for (let i = 0; i < w * h * 0.0016; i++) {
    g.fillStyle = `rgba(255,255,255,${(r() * 0.22).toFixed(3)})`;
    g.fillRect(r() * w, r() * h, 1, 1);
  }
}

export function paintBefore(cv) {
  const w = cv.width, h = cv.height, g = cv.getContext('2d');
  const r = rng(42);
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#2a2a2a'); bg.addColorStop(1, '#141414');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // размытый тусклый блик: лак не держит отражение
  const cx = w * 0.62, cy = h * 0.42;
  const hl = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.55);
  hl.addColorStop(0, 'rgba(210,210,205,.42)'); hl.addColorStop(0.4, 'rgba(160,160,155,.16)'); hl.addColorStop(1, 'rgba(120,120,120,0)');
  g.fillStyle = hl; g.fillRect(0, 0, w, h);
  // паутинка: концентрические дуги вокруг источника света
  const diag = Math.hypot(w, h);
  const n = Math.floor(diag * 4.2);
  for (let i = 0; i < n; i++) {
    const rad = Math.pow(r(), 0.8) * diag * 0.75;
    const a = r() * Math.PI * 2;
    const len = (0.04 + r() * 0.22) * (60 / Math.max(60, rad)) * 3;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    const near = Math.max(0, 1 - Math.hypot(px - cx, py - cy) / (diag * 0.55));
    g.strokeStyle = `rgba(255,255,255,${(0.04 + near * near * 0.5 * r()).toFixed(3)})`;
    g.lineWidth = 0.5 + r() * 0.9;
    g.beginPath(); g.arc(cx, cy, rad, a, a + len); g.stroke();
  }
  // хаотичные риски
  for (let i = 0; i < n * 0.12; i++) {
    const x = r() * w, y = r() * h, ang = r() * Math.PI, L = 10 + r() * 90;
    g.strokeStyle = `rgba(255,255,255,${(0.03 + r() * 0.1).toFixed(3)})`;
    g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
  }
  // мутность
  g.fillStyle = 'rgba(190,190,185,.06)'; g.fillRect(0, 0, w, h);
}

export function sizeCanvas(cv, el) {
  const r = el.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.min(2000, Math.round(r.width * dpr));
  cv.height = Math.min(1400, Math.round(r.height * dpr));
}
