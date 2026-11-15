import * as THREE from 'three';
import { fontsReady, spaced, diamond, canvases, textures, foilMaterial, roomEnv, softShadowTexture } from './foil.js';

/* Карточка-приглашение: плотная кремовая бумага, латунная фольга, золочёный обрез. */
const W = 1024, H = 1434;

function paintInvite(ctx, C) {
  // бумага
  ctx.fillStyle = C.base; ctx.fillRect(0, 0, W, H);
  if (C.role === 'map') {
    ctx.fillStyle = ctx.createPattern(C.pattern, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#f1e7d0'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 900);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,60,20,.16)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  if (C.role === 'bump') { ctx.globalAlpha = .35; ctx.fillStyle = ctx.createPattern(C.pattern, 'repeat'); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (C.blur) ctx.filter = `blur(${C.blur}px)`;
  // чернила
  ctx.fillStyle = C.ink; ctx.textAlign = 'center';
  ctx.font = '500 34px "Jost"'; spaced(ctx, 'БАРБЕР-КЛУБ', W / 2, 190, 16);
  ctx.font = 'italic 500 126px "Cormorant Garamond"'; ctx.fillText('Вы приглашены', W / 2, 900);
  ctx.font = '600 58px "Cormorant Garamond"'; ctx.fillText('в закрытый клуб «Особняк»', W / 2, 1060);
  ctx.font = '500 28px "Jost"'; spaced(ctx, 'НИЖНИЙ НОВГОРОД', W / 2, 1170, 12);
  // фольга
  ctx.strokeStyle = C.foil; ctx.fillStyle = C.foil;
  ctx.lineWidth = 7; ctx.strokeRect(46, 46, W - 92, H - 92);
  ctx.lineWidth = 2; ctx.strokeRect(68, 68, W - 136, H - 136);
  [[68, 68], [W - 68, 68], [68, H - 68], [W - 68, H - 68]].forEach(([x, y]) => diamond(ctx, x, y, 22));
  const cx = W / 2, cy = 500;
  ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 176, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 158, 0, Math.PI * 2); ctx.stroke();
  for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
    const a = Math.PI / 2 + side * (.42 + i * .21), r = 214;
    ctx.save(); ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.rotate(a + side * .55);
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 8.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.font = '600 300px "Cormorant Garamond"'; ctx.fillText('О', cx, cy + 100);
  diamond(ctx, cx, cy - 176, 20); diamond(ctx, cx, cy + 176, 20);
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(300, 960); ctx.lineTo(482, 960); ctx.moveTo(542, 960); ctx.lineTo(724, 960); ctx.stroke();
  diamond(ctx, cx, 960, 20);
  ctx.font = '500 32px "Jost"'; spaced(ctx, '№ 0427', cx, H - 150, 10);
  ctx.filter = 'none';
}

export async function initHero({ host, mobile, input, onWeak, delay = 0 }) {
  const canvas = host.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = roomEnv(renderer); scene.environmentIntensity = .55;
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50); camera.position.set(0, 0, 6.2);

  await fontsReady();
  const cs = canvases(W, H, paintInvite, { base: '#EFE6D2', foil: '#C9A46A', ink: '#0a1f18' }, window.OSB.linen);
  const front = foilMaterial(textures(renderer, cs), { iridescence: mobile ? .3 : .45 });

  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 717;
  const bx = bc.getContext('2d');
  bx.fillStyle = bx.createPattern(window.OSB.linen, 'repeat'); bx.fillRect(0, 0, 512, 717);
  bx.strokeStyle = '#B08D57'; bx.lineWidth = 1.5; bx.strokeRect(34, 34, 444, 649);
  bx.fillStyle = '#B08D57'; bx.font = '600 90px "Cormorant Garamond"'; bx.textAlign = 'center'; bx.fillText('О', 256, 390);
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  const back = new THREE.MeshStandardMaterial({ map: bt, roughness: .95 });
  const edge = new THREE.MeshStandardMaterial({ color: '#C9A46A', metalness: 1, roughness: .3 });
  const card = new THREE.Mesh(new THREE.BoxGeometry(1.43, 2, .045), [edge, edge, edge, edge, front, back]);
  const rig = new THREE.Group(); rig.add(card); scene.add(rig);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.1), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false, opacity: .7 }));
  shadow.position.z = -1.4; scene.add(shadow);
  scene.add(new THREE.AmbientLight('#fff2dc', .25));
  const key = new THREE.DirectionalLight('#fff0d6', 1.1); key.position.set(-2, 3, 4); scene.add(key);
  const spot = new THREE.PointLight('#ffeacc', 18, 10, 1.6); scene.add(spot);

  function layout() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const vh = 2 * Math.tan(THREE.MathUtils.degToRad(15)) * 6.2, vw = vh * camera.aspect;
    if (camera.aspect < .85) { rig.scale.setScalar(.72); rig.position.set(0, vh * .17, 0); }
    else { const s = Math.min(1, camera.aspect / 1.2); rig.scale.setScalar(.86 * s + .04); rig.position.set(vw * .29, .16, 0); }
  }
  layout();
  addEventListener('resize', layout);

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let frames = 0, probe = 0, last = performance.now(), dead = false, intro = 0;
  const t0 = performance.now() + delay;

  renderer.setAnimationLoop(() => {
    if (dead || !visible || document.hidden) { last = performance.now(); return; }
    const now = performance.now(), dt = now - last; last = now;
    frames++;
    if (frames > 20 && frames <= 110) probe += dt;
    if (frames === 110 && probe / 90 > 34) { kill(); onWeak && onWeak(); return; }
    const t = clock.getElapsedTime(), mx = input.x, my = input.y, idle = reduce ? 0 : 1;
    intro = Math.min(1, Math.max(0, (now - t0) / 1400));
    const e = 1 - Math.pow(1 - intro, 3);
    card.rotation.y = THREE.MathUtils.lerp(card.rotation.y, mx * .42 + Math.sin(t * .5) * .08 * idle + (1 - e) * -.9, .08);
    card.rotation.x = THREE.MathUtils.lerp(card.rotation.x, my * .28 + Math.cos(t * .4) * .05 * idle, .08);
    card.rotation.z = -.08 + Math.sin(t * .35) * .025 * idle;
    card.position.y = Math.sin(t * .8) * .05 * idle - (1 - e) * .8;
    front.opacity = 1;
    spot.position.set(rig.position.x + mx * 2.6, rig.position.y - my * 2.2, 2.3);
    scene.environmentRotation.y = mx * .9; scene.environmentRotation.x = my * .4;
    shadow.position.x = rig.position.x + .18 - mx * .15; shadow.position.y = rig.position.y - .22 + my * .1;
    shadow.scale.setScalar(rig.scale.x); shadow.material.opacity = .7 * e;
    renderer.render(scene, camera);
  });
  function kill() { dead = true; renderer.setAnimationLoop(null); renderer.dispose(); canvas.style.display = 'none'; }
  /* для генерации статичного кадра-заглушки */
  window.__heroShot = () => { renderer.render(scene, camera); return canvas.toDataURL('image/webp', .9); };
  host.classList.add('gl-on');
  return { kill };
}
