import * as THREE from 'three';
import { canvases, textures, foilMaterial, roomEnv, fontsReady, softShadowTexture } from './foil.js';
import { paintCard, CW, CH, TIERS } from './cardface.js';

/* Членская карта клуба в 3D: «выезжает» из латунной прорези, имя тиснится по буквам,
   крутится пальцем/мышью (по горизонтали — вертикальный скролл не блокируется). */
export async function initCard({ host, mobile, onWeak }) {
  const canvas = host.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = roomEnv(renderer); scene.environmentIntensity = .22;
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 50); camera.position.set(0, 0, 6);
  await fontsReady();

  const data = { name: '', tier: 'member', no: '0427', date: '', reveal: 1 };
  let cs = canvases(CW, CH, (ctx, C) => paintCard(ctx, C, data), {}, window.OSB.linen);
  let tx = textures(renderer, cs);
  const front = foilMaterial(tx, { bumpScale: 1.8, iridescence: .35 });
  front.specularIntensity = .35;
  const edge = new THREE.MeshStandardMaterial({ color: '#C9A46A', metalness: 1, roughness: .28 });
  const backC = document.createElement('canvas'); backC.width = 600; backC.height = 378;
  const backT = new THREE.CanvasTexture(backC); backT.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.MeshStandardMaterial({ map: backT, roughness: .8 });
  const geo = new THREE.BoxGeometry(2.5, 2.5 * CH / CW, .035);
  const card = new THREE.Mesh(geo, [edge, edge, edge, edge, front, back]);
  const rig = new THREE.Group(); rig.add(card); scene.add(rig);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: .6 }));
  shadow.position.z = -1.2; scene.add(shadow);
  scene.add(new THREE.AmbientLight('#fff2dc', .3));
  const key = new THREE.DirectionalLight('#fff0d6', 1); key.position.set(-2, 3, 4); scene.add(key);
  const spot = new THREE.PointLight('#ffeacc', 10, 10, 1.6); spot.position.set(1, 1, 2.4); scene.add(spot);

  function paintBack() {
    const T = TIERS[data.tier], g = backC.getContext('2d');
    g.fillStyle = T.base; g.fillRect(0, 0, 600, 378);
    g.strokeStyle = T.foil; g.lineWidth = 2; g.strokeRect(20, 20, 560, 338);
    g.fillStyle = T.foil; g.textAlign = 'center'; g.font = '600 120px "Cormorant Garamond"'; g.fillText('О', 300, 230);
    g.font = '500 13px "Jost"'; g.fillText('ПРЕДЪЯВИТЕЛЬ — ЧЛЕН КЛУБА «ОСОБНЯК» · ДЕМО', 300, 320);
    backT.needsUpdate = true;
  }
  function repaint() {
    const roles = { map: 'map', metal: 'metal', rough: 'rough', bump: 'bump' };
    for (const r in roles) {
      const c = cs[r], ctx = c.getContext('2d');
      const C = r === 'map' ? { role: 'map', pattern: window.OSB.linen }
        : r === 'metal' ? { role: r, base: '#000', foil: '#fff', ink: '#000' }
          : r === 'rough' ? { role: r, base: '#d8d8d8', foil: '#4a4a4a', ink: '#c8c8c8' }
            : { role: r, base: '#808080', foil: '#f2f2f2', ink: '#5a5a5a', blur: 2, pattern: window.OSB.linen };
      ctx.clearRect(0, 0, CW, CH);
      paintCard(ctx, C, data);
    }
    tx.map.needsUpdate = tx.metal.needsUpdate = tx.rough.needsUpdate = tx.bump.needsUpdate = true;
  }

  function layout() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(14)) * 6, vw = vh * camera.aspect;
    rig.scale.setScalar(Math.min(1.15, vw / 3));
  }
  layout(); addEventListener('resize', layout);

  // вращение
  let rotY = -.35, rotX = .12, vel = 0, drag = false, lx = 0, ly = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; vel = 0; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    vel = dx * .01; rotY += vel; rotX = Math.max(-.5, Math.min(.5, rotX + dy * .004));
  });
  const end = () => { drag = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  let visible = false, rise = 1, frames = 0, probe = 0, last = performance.now(), dead = false;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (dead || !visible) { last = performance.now(); return; }
    const now = performance.now(), dt = now - last; last = now;
    frames++; if (frames > 20 && frames <= 100) probe += dt;
    if (frames === 100 && probe / 80 > 36) { dead = true; renderer.setAnimationLoop(null); onWeak && onWeak(); return; }
    const t = clock.getElapsedTime();
    if (!drag) { vel *= .94; rotY += vel; rotY += (Math.sin(t * .4) * .25 - rotY) * .01 * (Math.abs(vel) < .002 ? 1 : 0); rotX += (.1 - rotX) * .03; }
    card.rotation.y = rotY; card.rotation.x = rotX;
    card.position.y = -(1 - easeOut(rise)) * 1.9 + Math.sin(t * .8) * .03;
    shadow.position.set(.15 - rotY * .2, -.18 + card.position.y * .6, -1.2);
    shadow.material.opacity = .6 * easeOut(rise);
    renderer.render(scene, camera);
  });
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  async function print(next) {
    Object.assign(data, next);
    paintBack();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { data.reveal = 1; rise = 1; repaint(); return; }
    data.reveal = 0; repaint(); rise = 0; rotY = -.2; vel = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const k = (performance.now() - t0) / 2200;
        rise = Math.min(1, k / .45);
        const r = Math.max(0, Math.min(1, (k - .4) / .55));
        const len = Math.max(1, [...(data.name || 'Ваше имя')].length);
        const q = Math.round(r * len * 2) / (len * 2);
        if (q !== data.reveal) { data.reveal = q; repaint(); }
        if (k < 1) requestAnimationFrame(step); else { rise = 1; data.reveal = 1; repaint(); vel = .06; res(); }
      };
      requestAnimationFrame(step);
    });
  }
  function shot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); }
  return { print, shot, data };
}
