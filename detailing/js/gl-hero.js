import * as THREE from 'three';
import { studioEnv, flakeNormal, bindTilt, stepTilt, tilt, visibility } from './gl-common.js';

/* Форма панели: плавная выпуклая «бровь» крыла с двумя гребнями — по ним бегут блики */
function surfaceZ(x, y) {
  const c = 0.34 * x + 0.035 * x * x;            // изогнутая ось гребня
  const d1 = y - c - 0.15;
  const d2 = y - c + 1.55;
  return 1.25 * Math.exp(-(d1 * d1) / 3.2)
       + 0.5 * Math.exp(-(d2 * d2) / 0.9)
       - 0.02 * x * x;
}

export function initHero({ host, mobile, onWeak }) {
  const canvas = host.querySelector('canvas');
  const tags = [...host.querySelectorAll('.tag')];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d0d0c, 1);

  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer, { warm: 0.5, minimal: true });
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  const [sx, sy] = mobile ? [96, 64] : [220, 150];
  const geo = new THREE.PlaneGeometry(18, 12, sx, sy);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, surfaceZ(p.getX(i), p.getY(i)));
  geo.computeVertexNormals();

  const flakes = flakeNormal(mobile ? 256 : 512, 1);
  flakes.repeat.set(mobile ? 10 : 16, mobile ? 6 : 10);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x111112,
    metalness: 0.75,
    roughness: 0.42,
    normalMap: flakes,
    normalScale: new THREE.Vector2(0.32, 0.32),
    clearcoat: 1,
    clearcoatRoughness: 0.035,
    envMapIntensity: 1.15,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  scene.add(group);
  mesh.rotation.x = -1.02;

  // точки для меток «120 мкм» и «92 GU» — на гребнях поверхности
  const anchors = [new THREE.Vector3(mobile ? -0.4 : 0.9, 0, 0), new THREE.Vector3(mobile ? 1.2 : 2.1, 0, 0)];
  const ridge = (x, off) => 0.34 * x + 0.035 * x * x + off;
  anchors[0].y = ridge(anchors[0].x, 0.15);  anchors[0].z = surfaceZ(anchors[0].x, anchors[0].y);
  anchors[1].y = ridge(anchors[1].x, -1.55); anchors[1].z = surfaceZ(anchors[1].x, anchors[1].y);
  const tmp = new THREE.Vector3();

  let w = 1, h = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // кадрирование: на узком экране ближе и выше
    const narrow = camera.aspect < 0.9;
    camera.fov = narrow ? 30 : 26;
    camera.position.set(narrow ? 0.6 : 0.6, 0.6, 7.6);
    camera.lookAt(narrow ? 0.6 : 0.9, narrow ? 0.75 : 0.55, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);

  bindTilt();

  let visible = true, raf = 0, t0 = performance.now(), last = t0;
  let frames = 0, probeSum = 0, probeN = 0, dead = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    // проба FPS: кадры 25–95, после компиляции шейдеров
    frames++;
    if (frames > 25 && frames <= 95) { probeSum += now - last; probeN++; }
    if (frames === 95 && mobile && probeSum / probeN > 30) { last = now; kill(); onWeak && onWeak(); return; }
    last = now;
    const t = (now - t0) / 1000;
    stepTilt(mobile ? 0.08 : 0.05);

    // блик медленно скользит, курсор/наклон его ведут
    const drift = Math.sin(t * 0.16) * 0.55 + Math.sin(t * 0.07) * 0.25;
    scene.environmentRotation.set(0.12 * tilt.y + 0.05, drift + tilt.x * 0.55, 0);
    group.rotation.y = tilt.x * 0.06;
    group.rotation.x = tilt.y * 0.035;
    mesh.rotation.z = Math.sin(t * 0.11) * 0.015;

    renderer.render(scene, camera);

    // метки привязаны к точкам на поверхности
    group.updateMatrixWorld();
    for (let i = 0; i < tags.length; i++) {
      tmp.copy(anchors[i]).applyMatrix4(mesh.matrixWorld).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w, y = (-tmp.y * 0.5 + 0.5) * h;
      tags[i].style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
    void dt;
  }

  function start() { if (!raf && !dead) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function kill() {
    dead = true; stop();
    geo.dispose(); mat.dispose(); flakes.dispose(); renderer.dispose();
  }
  visibility(host, v => { visible = v; v && !document.hidden ? start() : stop(); });
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : visible && start(); });
  start();

  return {
    showTags(delay = 0) { tags.forEach((el, i) => setTimeout(() => el.classList.add('on'), delay + i * 450)); },
    kill,
  };
}
