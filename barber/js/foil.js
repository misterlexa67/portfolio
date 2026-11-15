import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/* Набор карт для «бумаги с латунным тиснением»: цвет, металл, шероховатость, рельеф.
   paint(ctx, C, role) рисует один и тот же макет в четырёх «ролях». */
export const ROLES = {
  map: (base, foil, ink) => ({ base, foil, ink, blur: 0 }),
  metal: () => ({ base: '#000', foil: '#fff', ink: '#000', blur: 0 }),
  rough: () => ({ base: '#e6e6e6', foil: '#4a4a4a', ink: '#d0d0d0', blur: 0 }),
  bump: () => ({ base: '#808080', foil: '#f2f2f2', ink: '#585858', blur: 2.4 })
};

export function fontsReady() {
  return Promise.all([
    document.fonts.load('600 100px "Cormorant Garamond"'),
    document.fonts.load('italic 500 100px "Cormorant Garamond"'),
    document.fonts.load('500 30px "Jost"')
  ]).catch(() => {});
}

export function spaced(ctx, str, cx, y, sp) {
  const chars = [...str], ws = chars.map(ch => ctx.measureText(ch).width);
  const tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let x = cx - tot / 2;
  const al = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, x, y); x += ws[i] + sp; });
  ctx.textAlign = al;
}

export function diamond(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
}

export function canvases(W, H, paint, colors, paperPattern) {
  const out = {};
  for (const role of ['map', 'metal', 'rough', 'bump']) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const C = role === 'map' ? ROLES.map(colors.base, colors.foil, colors.ink) : ROLES[role]();
    C.role = role; C.pattern = paperPattern;
    paint(ctx, C);
    out[role] = c;
  }
  return out;
}

export function textures(renderer, cs) {
  const an = renderer.capabilities.getMaxAnisotropy();
  const t = (c, srgb) => { const x = new THREE.CanvasTexture(c); if (srgb) x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = an; return x; };
  return { map: t(cs.map, true), metal: t(cs.metal), rough: t(cs.rough), bump: t(cs.bump) };
}

export function foilMaterial(tx, { bumpScale = 2.2, iridescence = .45, roughness = .95 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    map: tx.map, metalnessMap: tx.metal, metalness: 1, roughnessMap: tx.rough, roughness,
    bumpMap: tx.bump, bumpScale, iridescence, iridescenceMap: tx.metal, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 420]
  });
}

export function roomEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();
  return env;
}

export function softShadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,.85)'); r.addColorStop(.55, 'rgba(0,0,0,.32)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
