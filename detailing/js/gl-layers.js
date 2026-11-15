import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioEnv, flakeNormal, brushed, matteNormal, shadowTex, bindTilt, stepTilt, tilt, visibility } from './gl-common.js';

const LIME = 0xD8FF2E;
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* Слои сверху вниз. h — визуальная толщина (масштаб условный) */
const LAYERS = [
  { key: 'clear',  name: 'Прозрачный лак', val: '40–60 мкм', h: 0.30 },
  { key: 'enamel', name: 'Базовая эмаль',  val: '15–25 мкм', h: 0.17 },
  { key: 'primer', name: 'Грунт',          val: '20–30 мкм', h: 0.19 },
  { key: 'panel',  name: 'Кузовная панель', val: '0,7–0,9 мм', h: 0.34 },
];

export function initLayers({ host, mobile, onPhase }) {
  const canvas = host.querySelector('canvas');
  const svg = host.querySelector('.callouts__lines');
  const callBox = host.querySelector('.callouts');
  const W = 3.4, D = 2.3;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer, { warm: 1.4, dark: 0xa8a49b });
  scene.environmentIntensity = 0.95;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-3, 6, 4);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d4c7, 0.5));

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);

  // ── материалы: стекло, металлик, мат, шлифовка
  const flakes = flakeNormal(512, 1.2); flakes.repeat.set(5, 3.5);
  const brush = brushed(512); brush.repeat.set(1.5, 3);
  const matte = matteNormal(256); matte.repeat.set(4, 3);

  // стекло: прозрачный слой с бликом (без transmission — дешевле и без артефактов на прозрачном холсте)
  const clearMat = new THREE.MeshPhysicalMaterial({ color: 0xe9f0ee, metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.01, ior: 1.5, transparent: true, opacity: 0.34, depthWrite: false, envMapIntensity: 2.2, specularIntensity: 1, side: THREE.DoubleSide });
  const enamelMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3b3f, metalness: 0.9, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.2, normalMap: flakes, normalScale: new THREE.Vector2(0.75, 0.75), envMapIntensity: 1.2 });
  const primerMat = new THREE.MeshStandardMaterial({ color: 0xbdb8ac, metalness: 0, roughness: 0.96, normalMap: matte, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.6 });
  const panelMat = new THREE.MeshPhysicalMaterial({ color: 0xd2d2d0, metalness: 1, roughness: 0.26, roughnessMap: brush, anisotropy: mobile ? 0 : 0.85, anisotropyRotation: 0, envMapIntensity: 1.25 });
  const mats = [clearMat, enamelMat, primerMat, panelMat];

  const root = new THREE.Group();
  scene.add(root);
  const slab = new THREE.Group();
  root.add(slab);

  const seg = mobile ? 2 : 4;
  const meshes = LAYERS.map((L, i) => {
    const g = new RoundedBoxGeometry(W, L.h, D, seg, Math.min(0.045, L.h * 0.3));
    const m = new THREE.Mesh(g, mats[i]);
    slab.add(m);
    return m;
  });
  // базовые позиции (сжатая плита), снизу вверх
  const base = []; let y = 0;
  for (let i = LAYERS.length - 1; i >= 0; i--) { base[i] = y + LAYERS[i].h / 2; y += LAYERS[i].h; }
  const totalH = y;

  // ── зоны действия услуг
  const limeBasic = (o = 0) => new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: o, depthWrite: false, toneMapped: false });
  // A: полировка — срез внутри лака + сканирующая линия
  const polish = new THREE.Mesh(new THREE.BoxGeometry(W * 0.985, 0.05, D * 0.985), limeBasic());
  const scan = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, D * 1.02), limeBasic());
  meshes[0].add(polish, scan);
  polish.position.y = LAYERS[0].h / 2 - 0.045;
  // B: керамика — тонкая плёнка поверх лака
  const ceramicMat = new THREE.MeshPhysicalMaterial({ color: LIME, metalness: 0, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false, emissive: LIME, emissiveIntensity: 0.25 });
  const ceramic = new THREE.Mesh(new RoundedBoxGeometry(W, 0.03, D, 2, 0.012), ceramicMat);
  meshes[0].add(ceramic);
  ceramic.position.y = LAYERS[0].h / 2 + 0.018;
  // C: плёнка PPF — новый прозрачный слой, опускается сверху
  const ppfMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 1.5 });
  const ppfGeo = new RoundedBoxGeometry(W * 1.01, 0.13, D * 1.01, 2, 0.03);
  const ppf = new THREE.Mesh(ppfGeo, ppfMat);
  const ppfEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W * 1.01, 0.13, D * 1.01)), new THREE.LineBasicMaterial({ color: 0x0d0d0c, transparent: true, opacity: 0 }));
  ppf.add(ppfEdges);
  slab.add(ppf);

  // контактная тень
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, D * 1.9), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.002;
  root.add(shadow);

  slab.position.y = -totalH / 2;
  shadow.position.y = -totalH / 2 - 0.01;
  root.rotation.y = -0.62;

  // ── выноски (только десктоп)
  const NS = 'http://www.w3.org/2000/svg';
  const lines = [], dots = [], labels = [];
  const useCallouts = !mobile && getComputedStyle(callBox).display !== 'none';
  if (useCallouts) {
    LAYERS.forEach(L => {
      const ln = document.createElementNS(NS, 'line'); svg.appendChild(ln); lines.push(ln);
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '3'); svg.appendChild(c); dots.push(c);
      const d = document.createElement('div'); d.className = 'callout';
      d.innerHTML = `${L.name}<b data-v="${L.val}">${L.val}</b>`;
      callBox.appendChild(d); labels.push(d);
    });
  }
  const anchor = new THREE.Vector3(), tmp = new THREE.Vector3();

  let w = 1, h = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = camera.aspect < 1;
    camera.fov = narrow ? 30 : 24;
    const dist = narrow ? 10.8 : 11.5;
    camera.position.set(0, dist * 0.5, dist * 0.87);
    camera.lookAt(narrow ? 0 : 0.35, narrow ? 0.15 : 0.25, 0);
    // на десктопе плита левее, чтобы справа поместились выноски
    root.position.x = narrow ? 0 : 0.2;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);
  bindTilt();

  // прогресс от ScrollTrigger (scrub), здесь сглаживаем
  let target = 0, prog = 0, phase = -2, explodedOn = false;
  const setProgress = v => { target = v; if (!raf) start(); };

  let raf = 0, visible = false, last = performance.now(), idle = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    prog += (target - prog) * Math.min(1, dt * 7);
    stepTilt(mobile ? 0.08 : 0.05);

    // 0.00–0.36 разбор слоёв; 0.40–0.56 полировка; 0.56–0.72 керамика; 0.72–0.9 плёнка
    const e = smooth(0.02, 0.36, prog);
    const gap = mobile ? 0.46 : 0.52;
    for (let i = 0; i < meshes.length; i++) {
      const lift = (LAYERS.length - 1 - i) * gap * e;
      meshes[i].position.y = base[i] + lift;
      // параллакс: верхние слои сильнее уходят за наклоном
      meshes[i].position.x = tilt.x * 0.06 * (LAYERS.length - i) * e;
      meshes[i].position.z = tilt.y * 0.04 * (LAYERS.length - i) * e;
    }
    const topY = meshes[0].position.y + LAYERS[0].h / 2;

    const aP = smooth(0.38, 0.44, prog) * (1 - smooth(0.54, 0.6, prog));
    const aC = smooth(0.55, 0.62, prog);
    const aF = smooth(0.71, 0.86, prog);

    polish.material.opacity = 0.42 * aP;
    scan.material.opacity = aP;
    scan.position.x = Math.sin(t * 1.6) * W * 0.47;
    ceramicMat.opacity = aC * (prog > 0.72 ? 0.5 : 0.75);
    ceramic.scale.set(1, 1, 0.2 + 0.8 * smooth(0.55, 0.64, prog));
    ppfMat.opacity = 0.32 * aF;
    ppfEdges.material.opacity = 0.7 * aF;
    ppf.position.y = topY + 0.08 + 0.07 + (1 - aF) * 1.6;

    // общий поворот: медленный дрейф + курсор/гироскоп + немного от скролла
    root.rotation.y = -0.62 + tilt.x * 0.22 + Math.sin(t * 0.25) * 0.03 + (prog - 0.4) * 0.25;
    root.rotation.x = tilt.y * 0.08;
    shadow.material.opacity = 1 - e * 0.45;
    shadow.scale.setScalar(1 + e * 0.15);

    renderer.render(scene, camera);

    // фазы — наружу (подсветка текста)
    const ph = prog < 0.38 ? (e > 0.6 ? -1 : -2) : prog < 0.56 ? 0 : prog < 0.72 ? 1 : 2;
    if (ph !== phase) { phase = ph; onPhase && onPhase(ph, e); }
    const on = e > 0.3;
    if (useCallouts) {
      root.updateMatrixWorld();
      const right = w - 4;
      for (let i = 0; i < meshes.length; i++) {
        anchor.set(W / 2, 0, D / 2 - 0.02);
        tmp.copy(anchor).applyMatrix4(meshes[i].matrixWorld).project(camera);
        const ax = (tmp.x * 0.5 + 0.5) * w, ay = (-tmp.y * 0.5 + 0.5) * h;
        const lx = right - 190;
        const k = on ? smooth(0.3 + i * 0.08, 0.55 + i * 0.08, e) : 0;
        const ex = ax + (lx - 10 - ax) * k;
        lines[i].setAttribute('x1', ax.toFixed(1)); lines[i].setAttribute('y1', ay.toFixed(1));
        lines[i].setAttribute('x2', ex.toFixed(1)); lines[i].setAttribute('y2', ay.toFixed(1));
        lines[i].style.opacity = k > 0.01 ? 1 : 0;
        dots[i].setAttribute('cx', ax.toFixed(1)); dots[i].setAttribute('cy', ay.toFixed(1));
        dots[i].style.opacity = k > 0.01 ? 1 : 0;
        labels[i].style.transform = `translate3d(${lx.toFixed(1)}px,${(ay - 18).toFixed(1)}px,0)`;
        if ((k > 0.95) !== labels[i].classList.contains('on')) {
          labels[i].classList.toggle('on', k > 0.95);
          if (k > 0.95) typeIn(labels[i].querySelector('b'));
        }
      }
    }
    if (on !== explodedOn) explodedOn = on;

    // если прогресс устоялся и курсор неподвижен — можно не крутить кадры зря
    const settled = Math.abs(target - prog) < 0.0005 && Math.abs(tilt.tx - tilt.x) < 0.001 && Math.abs(tilt.ty - tilt.y) < 0.001;
    idle = settled ? idle + 1 : 0;
    if (!visible || (mobile && idle > 90 && aP === 0)) stop();
  }
  function start() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  visibility(host, v => { visible = v; v ? start() : stop(); });
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });
  addEventListener('deviceorientation', () => { if (visible && !raf) start(); }, { passive: true });

  return { setProgress, layers: LAYERS };
}

/* «набор» цифр как на табло */
export function typeIn(el, dur = 700) {
  if (!el) return;
  const final = el.dataset.v || el.textContent;
  el.dataset.v = final;
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
