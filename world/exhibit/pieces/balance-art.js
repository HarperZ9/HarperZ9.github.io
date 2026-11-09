// Drawing for The False Balance, in world units (800 high). Real textures from the archive fill the concrete, iron and burlap.
import { byId, apply, mk, rng } from '../media/index.js';
import { cover } from './common.js';
export const P = { x: 400, y: 190 }, ARM = 235;
const SERIF = '"Hanken Grotesk",sans-serif', MONO = '"Conso",ui-monospace,monospace';

export function makePatterns(ctx, img) {
  const tile = (im, n, tint) => { const c = mk(n, n), x = c.getContext('2d'); x.drawImage(im, 0, 0, n, n); if (tint) { x.globalCompositeOperation = 'multiply'; x.fillStyle = tint; x.fillRect(0, 0, n, n); } return ctx.createPattern(c, 'repeat'); };
  const brass = (() => { const c = mk(96, 96), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 96, 96); [['#f7e48f', 0], ['#c9a132', .35], ['#7d5b14', .7], ['#e8c960', 1]].forEach(([s, o]) => g.addColorStop(o, s)); x.fillStyle = g; x.fillRect(0, 0, 96, 96);
    const r = rng(5); for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${r() < .5 ? '255,240,180' : '60,40,5'},${.05 + r() * .08})`; x.fillRect(r() * 96, r() * 96, 24 * r(), 1); } return ctx.createPattern(c, 'repeat'); })();
  return { conc: tile(img.concrete, 256), concL: tile(img.layers, 256), iron: tile(img.rust, 256), burlap: tile(img.hessian, 160, '#d8b27a'), brass, floor: tile(img.concrete, 320, '#8a8a88') };
}

export function rays(ctx, a, b, n, rot, R = 1800) {
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(rot);
  for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + .5) / n * 6.2832; ctx.fillStyle = i % 2 ? a : b; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(a0), R * Math.sin(a0)); ctx.lineTo(R * Math.cos(a1), R * Math.sin(a1)); ctx.fill(); }
  ctx.restore();
}

export function shade(ctx, x, y, w, h, a = .5) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, `rgba(255,255,255,${a * .45})`); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); }
export const slab = (ctx, pat, x, y, w, h, sh = .5) => { ctx.fillStyle = pat; ctx.fillRect(x, y, w, h); shade(ctx, x, y, w, h, sh); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); };

export function stage(ctx, pt, st) {
  // pillar and base
  slab(ctx, pt.conc, 190, 740, 420, 40, .3); slab(ctx, pt.conc, 240, 708, 320, 34, .35); slab(ctx, pt.conc, 290, 680, 220, 30, .4);
  slab(ctx, pt.concL, 350, 200, 100, 482, .65); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; ctx.beginPath(); for (const x of [375, 400, 425]) { ctx.moveTo(x, 215); ctx.lineTo(x, 670); } ctx.stroke();
  slab(ctx, pt.conc, 330, 195, 140, 22, .5); slab(ctx, pt.conc, 340, 217, 120, 14, .4);
  ctx.strokeStyle = pt.brass; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(350, 600); ctx.lineTo(450, 600); ctx.moveTo(350, 620); ctx.lineTo(450, 620); ctx.stroke();
  // dial
  ctx.fillStyle = pt.brass; ctx.beginPath(); ctx.arc(400, 318, 40, 0, 7); ctx.fill(); ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(400, 318, 31, 0, 7); ctx.fill();
  ctx.strokeStyle = '#151515'; for (let a = -50; a <= 50; a += 10) { const r = a * Math.PI / 180; ctx.lineWidth = a === 0 ? 4 : 2; ctx.beginPath(); ctx.moveTo(400 + Math.sin(r) * 24, 318 - Math.cos(r) * 24); ctx.lineTo(400 + Math.sin(r) * 30, 318 - Math.cos(r) * 30); ctx.stroke(); }
  ctx.save(); ctx.translate(400, 318); ctx.rotate(Math.max(-50, Math.min(50, -st.ang * 6)) * Math.PI / 180); ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.moveTo(-2.5, 4); ctx.lineTo(0, -27); ctx.lineTo(2.5, 4); ctx.fill(); ctx.restore();
  ctx.fillStyle = pt.brass; ctx.beginPath(); ctx.arc(400, 318, 4.5, 0, 7); ctx.fill();
  ctx.fillStyle = st.ang === 0 ? '#3ddc7a' : '#3a1a1a'; ctx.strokeStyle = pt.brass; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(400, 378, 8, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#efe6cf'; ctx.font = `700 11px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('T R U E', 400, 407);
  ctx.fillStyle = pt.brass; ctx.fillRect(362, 430, 76, 28); ctx.fillStyle = '#2a1d05'; ctx.font = `700 13px ${SERIF}`; ctx.fillText(st.name, 400, 449);
}

export function beam(ctx, pt, ang) {
  ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(ang * Math.PI / 180); ctx.translate(-P.x, -P.y);
  slab(ctx, pt.conc, 165, 173, 470, 34, .7); ctx.fillStyle = pt.brass; ctx.fillRect(160, 168, 22, 44); ctx.fillRect(618, 168, 22, 44);
  ctx.strokeStyle = pt.brass; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(300, 173); ctx.lineTo(400, 160); ctx.lineTo(500, 173); ctx.stroke(); ctx.restore();
  ctx.fillStyle = pt.brass; ctx.beginPath(); ctx.arc(P.x, P.y, 24, 0, 7); ctx.fill(); ctx.fillStyle = '#2a1d05'; ctx.beginPath(); ctx.arc(P.x, P.y, 14, 0, 7); ctx.fill(); ctx.fillStyle = pt.brass; ctx.beginPath(); ctx.arc(P.x, P.y, 6, 0, 7); ctx.fill();
}

const BOWL = new Path2D('M-100 156Q-96 214 0 232Q96 214 100 156Z');
export function pan(ctx, pt, left, st) {
  ctx.strokeStyle = pt.brass; ctx.lineWidth = 3; ctx.setLineDash([7, 3]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-96, 150); ctx.moveTo(0, 0); ctx.lineTo(96, 150); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = pt.brass; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.fillStyle = '#2a1d05'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
  slab(ctx, pt.conc, -60, 245, 120, 70, .5);
  if (left) {
    ctx.fillStyle = '#1a0a14'; ctx.fillRect(-48, 255, 96, 50);
    if (st.door > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(-48, 255, 96, 50); ctx.clip();
      const h = ctx.createRadialGradient(0, 288, 0, 0, 288, 90 + 12 * Math.sin(st.t * 5)); h.addColorStop(0, 'rgba(255,246,176,1)'); h.addColorStop(.3, 'rgba(255,208,42,.85)'); h.addColorStop(.65, 'rgba(224,23,126,.35)'); h.addColorStop(1, 'rgba(224,23,126,0)');
      ctx.globalAlpha = st.door; ctx.fillStyle = h; ctx.fillRect(-60, 240, 120, 80); ctx.globalAlpha = 1;
      ctx.fillStyle = pt.iron; ctx.strokeStyle = `rgba(255,246,176,${.55 + .45 * st.door * (.8 + .2 * Math.sin(st.t * 7))})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-38, 305); ctx.lineTo(36, 305); ctx.lineTo(36, 274); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
  } else { ctx.fillStyle = pt.brass; ctx.fillRect(-48, 255, 96, 50); ctx.strokeStyle = 'rgba(42,29,5,.5)'; ctx.lineWidth = 2; ctx.strokeRect(-42, 261, 84, 38); }
  ctx.fillStyle = pt.brass; ctx.fillRect(-8, 222, 16, 26); ctx.fillStyle = pt.brass; ctx.fill(BOWL);
  ctx.strokeStyle = 'rgba(42,29,5,.55)'; ctx.lineWidth = 2; ctx.beginPath(); for (const x of [-80, -56, -32, -10, 12, 34, 58, 82]) { ctx.moveTo(0, 232); ctx.lineTo(x, 160); } ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-84, 178); ctx.quadraticCurveTo(0, 226, 84, 178); ctx.moveTo(-66, 195); ctx.quadraticCurveTo(0, 232, 66, 195); ctx.stroke();
  ctx.fillStyle = pt.brass; ctx.fillRect(-108, 148, 216, 10); ctx.fillRect(-116, 144, 16, 18); ctx.fillRect(100, 144, 16, 18);
  if (left) { // brass door over the chamber
    const s = 1 - .93 * st.door; ctx.save(); ctx.translate(-48, 0); ctx.scale(s, 1); ctx.fillStyle = pt.brass; ctx.fillRect(0, 255, 96, 50); ctx.strokeStyle = 'rgba(42,29,5,.5)'; ctx.lineWidth = 2 / s; ctx.strokeRect(6, 261, 84, 38);
    ctx.fillStyle = `rgba(255,246,176,${Math.max(0, st.hint)})`; ctx.fillRect(0, 302, 96, 3); ctx.restore();
  }
}

export function feather(ctx, t) {
  const B = u => { const v = 1 - u; return [v * v * -64 + 2 * v * u * -4 + u * u * 68, v * v * -8 + 2 * v * u * -84 + u * u * -34]; };
  const up = [], dn = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24, [x, y] = B(u), [x2, y2] = B(Math.min(1, u + .02)), [x1, y1] = B(Math.max(0, u - .02)); let tx = x2 - x1, ty = y2 - y1; const m = Math.hypot(tx, ty); tx /= m; ty /= m;
    const len = u < .12 ? 0 : 24 * Math.pow(Math.sin(Math.PI * Math.min(1, (u - .1) / .9)), .7) + 2; up.push([x + ty * len - tx * 6, y - tx * len - ty * 6]); dn.push([x - ty * len - tx * 6, y + tx * len - ty * 6]); }
  ctx.fillStyle = '#f4f1ea'; ctx.strokeStyle = '#151515'; ctx.lineWidth = 2; ctx.beginPath(); up.concat(dn.reverse()).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#9fb4c4'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 3; i <= 23; i++) { const [x, y] = B(i / 24); ctx.moveTo(x, y); ctx.lineTo(...up[Math.min(i, up.length - 1)]); } ctx.stroke();
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 24; i++) { const [x, y] = B(i / 24); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
}
export function heart(ctx) {
  ctx.fillStyle = '#e3262b'; ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; const p = new Path2D('M0 -6C-52 -44 -66 -90 -32 -100C-14 -105 0 -92 0 -80C0 -92 14 -105 32 -100C66 -90 52 -44 0 -6Z'); ctx.fill(p); ctx.stroke(p);
  ctx.strokeStyle = '#ffe93a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-30, -86); ctx.quadraticCurveTo(-44, -70, -36, -52); ctx.stroke();
  ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(0, -58, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe93a'; ctx.beginPath(); ctx.arc(0, -58, 6, 0, 7); ctx.fill();
}
export function sack(ctx, pt) {
  const p = new Path2D('M-46 0C-64 -30 -50 -70 -22 -86L-17 -94Q0 -86 17 -94L22 -86C50 -70 64 -30 46 0Z');
  ctx.fillStyle = pt.burlap; ctx.fill(p); ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.stroke(p);
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-20, -88); ctx.quadraticCurveTo(0, -80, 20, -88); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-17, -96); ctx.lineTo(-24, -110); ctx.moveTo(17, -96); ctx.lineTo(25, -108); ctx.stroke();
  ctx.strokeStyle = '#e3262b'; ctx.beginPath(); ctx.arc(0, -42, 16, 0, 7); ctx.moveTo(-9, -42); ctx.lineTo(9, -42); ctx.stroke();
}
export function hash(ctx, pt, t, on) {
  ctx.fillStyle = '#17181c'; ctx.fillRect(-74, -92, 148, 92); ctx.strokeStyle = pt.brass; ctx.lineWidth = 4; ctx.strokeRect(-74, -92, 148, 92);
  ctx.strokeStyle = 'rgba(26,163,224,.5)'; ctx.lineWidth = 1; ctx.strokeRect(-66, -84, 132, 76);
  ctx.font = `500 12.5px ${MONO}`; ctx.textAlign = 'center'; ['e3b0c442 98fc1c14', '9afbf4c8 996fb924', '27ae41e4 649b934c', 'a495991b 7852b855'].forEach((s, i) => { ctx.fillStyle = i === on ? '#fff' : '#7fe8ff'; ctx.fillText(s, 0, -66 + i * 18 + 4); });
}
export function human(ctx) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-70, 22); ctx.lineTo(70, 22); ctx.lineTo(12, 0); ctx.fill(); ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(0, -47, 5, 0, 7); ctx.fill(); ctx.fillRect(-6, -41, 12, 23); ctx.fillRect(-6, -18, 5, 18); ctx.fillRect(1, -18, 5, 18); }

// Static collage behind the scene: archive pieces torn, halftoned and taped. Built once.
export function buildCollage(img, W, H, small) {
  const c = mk(W, H), x = c.getContext('2d'), put = (im, w, h, chain, tx, ty, rot, tape = true) => {
    const pad = Math.round(Math.max(w, h) * .06), s = mk(w + pad * 2, h + pad * 2); const sx = s.getContext('2d'); cover(sx, im, pad, pad, w, h);
    const o = mk(s.width, s.height); apply(s, chain, o, { seed: 4 + (tx | 0) % 9 }); x.save(); x.translate(tx, ty); x.rotate(rot); x.drawImage(o, -o.width / 2, -o.height / 2);
    if (tape) { x.fillStyle = 'rgba(232,214,150,.72)'; x.save(); x.translate(-w * .32, -h / 2 - 4); x.rotate(-.18); x.fillRect(-34, -9, 68, 18); x.restore(); } x.restore(); };
  const cut = [[byId.halftone, { cell: 5 }], [byId.cutpaper, { tear: .016, shadow: .7 }]];
  const q = small ? .75 : 1;
  put(img.heart, 760 * q, 420 * q, [[byId.riso, { misreg: .006, grain: .15, dropout: .12 }], [byId.cutpaper, { tear: .02 }]], W * .5, 150, -.02, false);
  put(img.justice, 250 * q, 340 * q, [[byId.photocopy, { gen: .35 }], [byId.cutpaper, { tear: .014 }]], 90, 330, -.09);
  put(img.famine, 280 * q, 320 * q, cut, W - 100, 300, .07);
  put(img.bread, 340 * q, 250 * q, [[byId.polaroid, { lift: .5 }], [byId.cutpaper, { tear: .008 }]], W - 130, 600, -.05, false);
  put(img.gods, 240 * q, 210 * q, [[byId.newsprint, { gain: .4, age: .7 }], [byId.cutpaper, { tear: .016 }]], 100, 630, .06);
  put(img.hunefer, 300 * q, 240 * q, [[byId.cyanotype, { exposure: .6 }], [byId.cutpaper, { tear: .014 }]], W * .5 - 330 * q, 90, .04, false);
  return c;
}
