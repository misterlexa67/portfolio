import * as THREE from 'three';
import { flakeNormal, bindTilt, stepTilt, tilt, visibility } from './gl-common.js';

/* Фрагмент кузовной панели: крупная выпуклость + чёткое ребро (линия характера).
   Выше ребра поверхность отражает потолочные софтбоксы, ниже — тёмный пол:
   на ребре получается резкая граница света, как на настоящем лаке. */
const lineY = x => 0.26 * x + 0.018 * x * x;          // изогнутая линия ребра
function surfaceZ(x, y) {
  const d = y - lineY(x);
  const s = 0.09;
  const fold = s * Math.log(1 + Math.exp(-d / s));      // излом по ребру — узкий радиус
  return -0.022 * x * x - 0.035 * y * y + 0.5 * fold;
}

/* Окружение для лака: чёткие прямоугольные софтбоксы без размытия */
function lacquerEnv(renderer, mobile) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x030303);
  const geo = new THREE.PlaneGeometry(1, 1);
  const add = (w, h, pos, k, col = 0xffffff, look = [0, 0, 0]) => {
    const m = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    m.color.multiplyScalar(k);
    const p = new THREE.Mesh(geo, m);
    p.scale.set(w, h, 1); p.position.set(...pos); p.lookAt(...look);
    s.add(p);
  };
  // окно с переплётом — его отражение мгновенно считывается как «лак»
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
    add(1.6, 1.0, [-0.2 + i * 1.75, 9.2, -3.6 + j * 1.12], 7, 0xffffff, [-0.2 + i * 1.75, 0, -3.6 + j * 1.12]);
  add(40, 1.1, [0, 9, -1], 9);              // главный потолочный софтбокс
  add(40, 0.22, [0, 8.6, 1.8], 8);          // тонкие стрипы — резкие параллельные линии
  add(40, 0.14, [0, 8.3, 3.4], 6);
  add(40, 0.5, [0, 7.4, -5], 3);
  add(1.2, 14, [-10, 2, 3], 1.4);           // боковой стрип слева
  add(0.5, 14, [10, 2, -2], 1.2);           // узкий стрип справа
  add(40, 12, [0, -9, 0], 0.05, 0xF0EDE5);  // почти чёрный пол
  // кубическая карта высокого разрешения → PMREM того же размера (fromScene даёт только 256)
  const size = mobile ? 512 : 1024;
  const cubeRT = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cam = new THREE.CubeCamera(0.1, 100, cubeRT);
  cam.update(renderer, s);
  const tex = pmrem.fromCubemap(cubeRT.texture).texture;
  cubeRT.dispose(); pmrem.dispose(); geo.dispose();
  s.traverse(o => o.material && o.material.dispose());
  return tex;
}

export function initHero({ host, mobile, onWeak }) {
  const canvas = host.querySelector('canvas');
  const tagBox = host.querySelector('.tags');
  const tags = [...host.querySelectorAll('.tag')];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d0d0c, 1);

  const scene = new THREE.Scene();
  scene.environment = lacquerEnv(renderer, mobile);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  const [sx, sy] = mobile ? [150, 100] : [300, 200];
  const geo = new THREE.PlaneGeometry(14, 9, sx, sy);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, surfaceZ(p.getX(i), p.getY(i)));
  geo.computeVertexNormals();

  const flakes = flakeNormal(mobile ? 256 : 512, 0.9);
  flakes.repeat.set(mobile ? 14 : 22, mobile ? 9 : 14);

  // чёрный металлик под прозрачным лаком: база почти не отражает, лак — зеркало
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x060608, metalness: 0.9, roughness: 0.42,
    normalMap: flakes, normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoat: 1, clearcoatRoughness: 0.015,
    envMapIntensity: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -0.92;
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);

  // курсор — лампа: его блик отражается в лаке
  const lamp = new THREE.PointLight(0xffffff, mobile ? 60 : 90, 0, 2);
  lamp.position.set(0, 1.5, 3.2);
  scene.add(lamp);

  const anchors = [mobile ? -0.6 : 0.6, mobile ? 1.0 : 2.3].map(x => {
    const y = lineY(x) + 0.02;
    return new THREE.Vector3(x, y, surfaceZ(x, y));
  });
  const tmp = new THREE.Vector3();

  let w = 1, h = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = camera.aspect < 0.9;
    camera.fov = narrow ? 32 : 26;
    camera.position.set(narrow ? 0.4 : 0.8, 0.4, narrow ? 7.4 : 7.6);
    camera.lookAt(narrow ? 0.4 : 1.0, narrow ? 0.35 : 0.3, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);
  bindTilt();

  // клик/тап по лаку — метка замера
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const marks = [];
  host.addEventListener('pointerdown', e => {
    if (e.target.closest('a,button')) return;
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(mesh)[0];
    if (!hit) return;
    const local = mesh.worldToLocal(hit.point.clone());
    const v = 108 + Math.round(Math.abs(Math.sin(local.x * 3.1 + local.y * 1.7)) * 24);
    const el = document.createElement('div');
    el.className = 'tag tag--mark';
    el.innerHTML = `<svg class="tag__cross" viewBox="0 0 120 120"><path d="M60 30V90M30 60H90"/><circle cx="60" cy="60" r="14"/></svg><span class="tag__txt mono" data-v="${v} мкм">${v} мкм</span>`;
    tagBox.appendChild(el);
    marks.push({ el, p: local });
    requestAnimationFrame(() => el.classList.add('on'));
    host.dispatchEvent(new CustomEvent('gl-mark', { detail: el.querySelector('.tag__txt') }));
    if (marks.length > 4) { const m = marks.shift(); m.el.classList.add('out'); setTimeout(() => m.el.remove(), 600); }
  });

  let visible = true, raf = 0, t0 = performance.now(), last = t0;
  let frames = 0, probeSum = 0, probeN = 0, dead = false;
  let lastScroll = scrollY, vel = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    frames++;
    if (frames > 25 && frames <= 95) { probeSum += now - last; probeN++; }
    if (frames === 95 && mobile && probeSum / probeN > 30) { last = now; kill(); onWeak && onWeak(); return; }
    last = now;
    const t = (now - t0) / 1000;
    stepTilt(mobile ? 0.08 : 0.06);
    // скорость скролла раскачивает отражение
    const sv = scrollY - lastScroll; lastScroll = scrollY;
    vel += (Math.max(-60, Math.min(60, sv)) * 0.004 - vel) * 0.1;

    const drift = Math.sin(t * 0.15) * 0.22 + Math.sin(t * 0.06) * 0.12;
    scene.environmentRotation.set(0.06 * tilt.y + vel * 0.5, drift + tilt.x * 0.35, 0);
    group.rotation.y = tilt.x * 0.05;
    group.rotation.x = tilt.y * 0.03 + vel * 0.15;
    lamp.position.set(tilt.x * 4.2 + 0.8, -tilt.y * 2.4 + 1.2, 3.2);

    renderer.render(scene, camera);

    group.updateMatrixWorld();
    for (let i = 0; i < tags.length; i++) {
      tmp.copy(anchors[i]).applyMatrix4(mesh.matrixWorld).project(camera);
      tags[i].style.transform = `translate3d(${((tmp.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-tmp.y * 0.5 + 0.5) * h).toFixed(1)}px,0)`;
    }
    for (const m of marks) {
      tmp.copy(m.p).applyMatrix4(mesh.matrixWorld).project(camera);
      m.el.style.transform = `translate3d(${((tmp.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-tmp.y * 0.5 + 0.5) * h).toFixed(1)}px,0)`;
    }
  }

  function start() { if (!raf && !dead) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function kill() { dead = true; stop(); geo.dispose(); mat.dispose(); flakes.dispose(); renderer.dispose(); }
  visibility(host, v => { visible = v; v && !document.hidden ? start() : stop(); });
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : visible && start(); });
  start();

  return {
    showTags(delay = 0) { tags.forEach((el, i) => setTimeout(() => el.classList.add('on'), delay + i * 450)); },
    kill,
  };
}
