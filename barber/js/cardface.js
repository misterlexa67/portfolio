/* Лицевая сторона членской карты — общий макет для 3D и для плоской заглушки. */
export const CW = 1200, CH = 756;
export const TIERS = {
  guest: { label: 'ГОСТЬ КЛУБА', base: '#EAE0C8', foil: '#B8925A', ink: '#0F2A22', dark: false },
  member: { label: 'ЧЛЕН КЛУБА', base: '#0c281f', foil: '#C9A46A', ink: '#cfc2a2', dark: true },
  honor: { label: 'ПОЧЁТНЫЙ ЧЛЕН', base: '#0E0E0D', foil: '#C9A46A', ink: '#9c8b66', dark: true }
};

function spaced(ctx, str, x, y, sp, align = 'left') {
  const chars = [...str], ws = chars.map(ch => ctx.measureText(ch).width);
  const tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
  let cx = align === 'center' ? x - tot / 2 : align === 'right' ? x - tot : x;
  const al = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + sp; });
  ctx.textAlign = al;
  return tot;
}
function diamond(ctx, x, y, s) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }

/* C: {role, base, foil, ink, blur, pattern}; d: {name, tier, no, date, reveal} */
export function paintCard(ctx, C, d) {
  const T = TIERS[d.tier] || TIERS.member;
  const role = C.role || 'map';
  const base = role === 'map' ? T.base : C.base, foil = role === 'map' ? T.foil : C.foil, ink = role === 'map' ? T.ink : C.ink;
  ctx.fillStyle = base; ctx.fillRect(0, 0, CW, CH);
  if (role === 'map') {
    if (C.pattern) {
      ctx.save(); ctx.globalAlpha = T.dark ? .07 : 1; ctx.globalCompositeOperation = T.dark ? 'screen' : 'multiply';
      ctx.fillStyle = ctx.createPattern(C.pattern, 'repeat'); ctx.fillRect(0, 0, CW, CH); ctx.restore();
    }
    // гильош справа
    ctx.save(); ctx.strokeStyle = ink; ctx.globalAlpha = T.dark ? .1 : .13; ctx.lineWidth = 1;
    for (let k = 0; k < 34; k++) {
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + .01; a += .02) {
        const r = 150 + k * 3 + Math.sin(a * 12 + k * .3) * 16;
        const x = 960 + Math.cos(a) * r, y = 330 + Math.sin(a) * r * .8;
        a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(CW * .4, CH * .3, 100, CW / 2, CH / 2, 900);
    vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, T.dark ? 'rgba(0,0,0,.45)' : 'rgba(90,60,20,.18)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, CW, CH);
  }
  if (role === 'bump' && C.pattern) { ctx.globalAlpha = .3; ctx.fillStyle = ctx.createPattern(C.pattern, 'repeat'); ctx.fillRect(0, 0, CW, CH); ctx.globalAlpha = 1; }
  if (C.blur) ctx.filter = `blur(${C.blur}px)`;

  // чернила
  ctx.fillStyle = ink;
  ctx.font = '500 24px "Jost"';
  spaced(ctx, 'НИЖНИЙ НОВГОРОД', 96, CH - 92, 7);
  spaced(ctx, 'В КЛУБЕ С ' + d.date, CW - 96, CH - 92, 7, 'right');

  // фольга
  ctx.strokeStyle = foil; ctx.fillStyle = foil;
  ctx.lineWidth = 5; ctx.strokeRect(36, 36, CW - 72, CH - 72);
  ctx.lineWidth = 1.6; ctx.strokeRect(52, 52, CW - 104, CH - 104);
  [[52, 52], [CW - 52, 52], [52, CH - 52], [CW - 52, CH - 52]].forEach(([x, y]) => diamond(ctx, x, y, 16));
  // монограмма
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(176, 190, 78, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(176, 190, 66, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '600 128px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.fillText('О', 176, 233);
  diamond(ctx, 176, 112, 12); diamond(ctx, 176, 268, 12);
  ctx.font = '600 52px "Cormorant Garamond"'; ctx.textAlign = 'left';
  spaced(ctx, 'ОСОБНЯК', 290, 176, 14);
  ctx.font = '500 22px "Jost"';
  spaced(ctx, T.label, 292, 222, 9);
  ctx.font = '500 26px "Jost"';
  spaced(ctx, '№ ' + d.no, CW - 96, 120, 8, 'right');
  ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(96, 560); ctx.lineTo(CW - 96, 560); ctx.stroke();
  diamond(ctx, CW / 2, 560, 12);

  // имя — тиснением, «печатается» по буквам
  const name = (d.name || 'Ваше имя').trim() || 'Ваше имя';
  let size = 112;
  ctx.font = `italic 500 ${size}px "Cormorant Garamond"`;
  while (ctx.measureText(name).width > CW - 200 && size > 48) { size -= 4; ctx.font = `italic 500 ${size}px "Cormorant Garamond"`; }
  const chars = [...name], rev = d.reveal == null ? 1 : d.reveal;
  const shown = rev * chars.length;
  let x = 96;
  chars.forEach((ch, i) => {
    const a = Math.max(0, Math.min(1, shown - i));
    if (a > 0) { ctx.globalAlpha = a; ctx.fillText(ch, x, 500); }
    x += ctx.measureText(ch).width;
  });
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
}
