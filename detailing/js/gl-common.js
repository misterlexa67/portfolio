import * as THREE from 'three';

/* Студийное окружение: длинные софтбоксы + тёплая «бумажная» подсветка снизу.
   Генерируется процедурно, без HDR-файлов. */
export function studioEnv(renderer, { warm = 0.35, dark = 0x050505, minimal = false } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.background = new THREE.Color(dark);
  const geo = new THREE.PlaneGeometry(1, 1);
  const add = (w, h, pos, intensity, color = 0xffffff) => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    m.color.multiplyScalar(intensity);
    const p = new THREE.Mesh(geo, m);
    p.scale.set(w, h, 1);
    p.position.set(...pos);
    p.lookAt(0, 0, 0);
    s.add(p);
  };
  if (minimal) {
    add(22, 1.1, [0, 7, -1.5], 10);        // один длинный софтбокс — один чистый блик
    add(14, 7, [0, 5, -6], 0.55);          // большой тусклый — даёт тональный перелив по кривизне
    add(22, 0.5, [0, 2.2, 7], 3.2);        // нижний стрип — второй блик в тёмной части панели
    add(8, 6, [8, 1, 6], 0.5, 0xF0EDE5);   // слабое тёплое заполнение
  } else {
    add(16, 0.9, [0, 7, -1.5], 9);          // длинная полоса сверху — главный блик
    add(16, 0.35, [0, 6, 2.5], 5);          // вторая, тонкая
    add(0.8, 12, [-8, 1, 1], 3.2);           // боковой стрип
    add(5, 4, [7, 2, 5], 1.4, 0xF0EDE5);     // тёплый софтбокс
  }
  add(30, 6, [0, -7, 0], warm, 0xF0EDE5);  // отражённая «бумага» снизу
  const tex = pmrem.fromScene(s, 0.035).texture;
  pmrem.dispose();
  s.traverse(o => { if (o.material) o.material.dispose(); });
  geo.dispose();
  return tex;
}

function canvasTex(size, draw, { repeat = [1, 1], color = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Нормали металлических частиц эмали */
export function flakeNormal(size = 256, density = 1) {
  return canvasTex(size, (g, n) => {
    g.fillStyle = 'rgb(128,128,255)';
    g.fillRect(0, 0, n, n);
    const count = Math.floor(n * n * 0.22 * density);
    for (let i = 0; i < count; i++) {
      const r = 128 + (Math.random() - 0.5) * 190;
      const gg = 128 + (Math.random() - 0.5) * 190;
      g.fillStyle = `rgb(${r | 0},${gg | 0},235)`;
      const s = Math.random() < 0.85 ? 1 : 2;
      g.fillRect((Math.random() * n) | 0, (Math.random() * n) | 0, s, s);
    }
  });
}

/* Шлифованный металл: тонкие горизонтальные штрихи */
export function brushed(size = 512) {
  return canvasTex(size, (g, n) => {
    g.fillStyle = 'rgb(120,120,120)';
    g.fillRect(0, 0, n, n);
    for (let i = 0; i < n * 3; i++) {
      const y = Math.random() * n;
      const v = 80 + Math.random() * 110;
      g.strokeStyle = `rgba(${v},${v},${v},${0.15 + Math.random() * 0.35})`;
      g.lineWidth = Math.random() < 0.9 ? 0.6 : 1.4;
      const x = Math.random() * n;
      const len = n * (0.3 + Math.random() * 0.9);
      g.beginPath(); g.moveTo(x - len / 2, y); g.lineTo(x + len / 2, y); g.stroke();
      g.beginPath(); g.moveTo(x - len / 2 - n, y); g.lineTo(x + len / 2 - n, y); g.stroke();
      g.beginPath(); g.moveTo(x - len / 2 + n, y); g.lineTo(x + len / 2 + n, y); g.stroke();
    }
  });
}

/* Матовый грунт: мелкая шероховатость в нормалях */
export function matteNormal(size = 256) {
  return canvasTex(size, (g, n) => {
    const img = g.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      img.data[i * 4] = 128 + (Math.random() - 0.5) * 70;
      img.data[i * 4 + 1] = 128 + (Math.random() - 0.5) * 70;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

/* Мягкая контактная тень */
export function shadowTex(size = 256) {
  return canvasTex(size, (g, n) => {
    const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(13,13,12,.55)');
    gr.addColorStop(0.45, 'rgba(13,13,12,.22)');
    gr.addColorStop(1, 'rgba(13,13,12,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, n, n);
  }, { color: true });
}

/* Общий наклон: курсор на десктопе, гироскоп на телефоне */
export const tilt = { x: 0, y: 0, tx: 0, ty: 0, active: false };
let tiltBound = false;
export function bindTilt() {
  if (tiltBound) return;
  tiltBound = true;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tilt.tx = (e.clientX / innerWidth) * 2 - 1;
    tilt.ty = (e.clientY / innerHeight) * 2 - 1;
    tilt.active = true;
  }, { passive: true });
  const onOri = e => {
    if (e.gamma == null) return;
    tilt.tx = Math.max(-1, Math.min(1, e.gamma / 25));
    tilt.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    tilt.active = true;
  };
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    const ask = () => {
      DOE.requestPermission().then(s => { if (s === 'granted') addEventListener('deviceorientation', onOri); }).catch(() => {});
      removeEventListener('touchend', ask);
    };
    addEventListener('touchend', ask, { once: true });
  } else if (DOE) {
    addEventListener('deviceorientation', onOri, { passive: true });
  }
}
export function stepTilt(k = 0.06) {
  tilt.x += (tilt.tx - tilt.x) * k;
  tilt.y += (tilt.ty - tilt.y) * k;
}

/* Рендер только когда элемент на экране и вкладка активна */
export function visibility(el, cb) {
  const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: '120px' });
  io.observe(el);
  return io;
}
