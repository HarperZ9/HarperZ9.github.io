// Emet, Met: the Golem of Prague, truth cut into its brow. Take out the first letter and truth becomes dead, and the giant goes back to clay.
import { byId, apply, loadImage, mk, pointer, rng } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, sfx = small ? '-s' : '';
const L = n => loadImage(`assets/img/${n}${sfx}.jpg`);
const [clay, plaster, ales1, ales2, loew, concrete] = await Promise.all(['clay-floor', 'clay-plaster', 'golem-ales', 'golem-ales2', 'golem-loew', 'concrete-layers'].map(L));
await document.fonts.load('900 60px "Frank Ruhl Libre"', 'אמת').catch(() => {});
const snd = sound({ clink: { url: 'assets/audio/clink.opus', gain: 1.118 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 }, projector: { url: 'assets/audio/projector.opus', gain: 0.056 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1); snd.bed('projector', 1);
const cv = $('cv'), ctx = cv.getContext('2d'), dots = $('dots'), stage = $('stage'), ptr = pointer(stage, { keys: $('take') });
const st = { p: 0, tgt: 0 }; let W = 800, H = 640, claypat, plate, bgc = mk(2, 2), giant = mk(2, 2);
const plateOf = (im, w, h, seed, chain) => { const pad = 24, s = mk(w + pad * 2, h + pad * 2); cover(s.getContext('2d'), im, pad, pad, w, h); const o = mk(s.width, s.height); apply(s, [...chain, [byId.cutpaper, { tear: .014, shadow: .8 }]], o, { seed }); return o; };
function layout() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5); W = Math.round(r.width * dpr); H = Math.round(Math.min(r.width * .85, innerHeight * .8) * dpr); for (const c of [cv, dots, bgc, giant]) { c.width = W; c.height = H; } cv.style.height = dots.style.height = H / dpr + 'px';
  const x = bgc.getContext('2d'); x.fillStyle = '#17120c'; x.fillRect(0, 0, W, H); const g = x.createRadialGradient(W / 2, H * .35, 0, W / 2, H * .35, W * .7); g.addColorStop(0, '#6a4a2a'); g.addColorStop(1, '#17120c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const put = (o, cx, cy, rot) => { x.save(); x.translate(cx, cy); x.rotate(rot); x.drawImage(o, -o.width / 2, -o.height / 2); x.fillStyle = 'rgba(232,214,150,.75)'; x.fillRect(-28, -o.height / 2 + 4, 56, 16); x.restore(); };
  const k = H / 700; put(plateOf(ales1, 200 * k, 280 * k, 1, [[byId.newsprint, { gain: .2, age: .6 }]]), W * .09, H * .3, -.08); put(plateOf(ales2, 220 * k, 250 * k, 2, [[byId.photocopy, { gen: .25 }]]), W * .91, H * .27, .07); put(plateOf(loew, 170 * k, 280 * k, 3, [[byId.halftone, { cell: 5 }]]), W * .91, H * .72, -.05);
  claypat = x.createPattern(clay, 'repeat'); drawGiant();
}
function drawGiant() {
  const x = giant.getContext('2d'), cx = W / 2; x.clearRect(0, 0, W, H);
  const shape = () => { x.beginPath(); x.roundRect(cx - W * .19, H * .1, W * .38, H * .42, W * .06); x.roundRect(cx - W * .08, H * .5, W * .16, H * .14, 4); x.moveTo(cx - W * .42, H); x.lineTo(cx - W * .3, H * .62); x.lineTo(cx + W * .3, H * .62); x.lineTo(cx + W * .42, H); x.closePath(); };
  x.save(); shape(); x.clip(); x.fillStyle = x.createPattern(clay, 'repeat'); x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(cx - W * .1, H * .22, 0, cx, H * .4, W * .55); g.addColorStop(0, 'rgba(255,230,190,.35)'); g.addColorStop(.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(30,18,8,.7)'; x.lineWidth = 6; x.beginPath(); x.moveTo(cx - W * .12, H * .36); x.lineTo(cx - W * .04, H * .35); x.moveTo(cx + W * .04, H * .35); x.lineTo(cx + W * .12, H * .36); x.moveTo(cx - W * .07, H * .46); x.lineTo(cx + W * .07, H * .46); x.stroke(); x.restore();
}
const slot = i => ({ x: W / 2 + (1 - i) * W * .105, y: H * .245 }); // i=0 aleph (rightmost), 1 mem, 2 tav
function draw(t) {
  const e = st.p * st.p * (3 - 2 * st.p), cx = W / 2, sw = W * .09; ctx.drawImage(bgc, 0, 0); ctx.drawImage(giant, 0, 0);
  // the brow plate: concrete, with three carved slots
  const bx = cx - W * .17, by = H * .185, bw = W * .34, bh = H * .12; ctx.save(); ctx.fillStyle = ctx.createPattern(concrete, 'repeat'); ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.strokeRect(bx, by, bw, bh); ctx.restore();
  const fs = H * .13; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `900 ${fs}px "Frank Ruhl Libre","Times New Roman",serif`;
  [['א', 0], ['מ', 1], ['ת', 2]].forEach(([ch, i]) => { if (i === 0) return; const s = slot(i); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillText(ch, s.x + 2, s.y + fs * .42 + 2); ctx.fillStyle = '#16120d'; ctx.fillText(ch, s.x, s.y + fs * .42); });
  const s0 = slot(0); ctx.fillStyle = '#0b0906'; ctx.fillRect(s0.x - sw / 2, by + 6, sw, bh - 12); // the hole the aleph leaves
  // the aleph, a keystone that slides out
  const ax = s0.x + e * W * .3, ay = s0.y - e * H * .13 + Math.sin(e * 3.14) * -H * .05, rot = e * .9; ctx.save(); ctx.translate(ax, ay); ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
  ctx.fillStyle = ctx.createPattern(concrete, 'repeat'); ctx.beginPath(); ctx.moveTo(-sw * .55, -bh * .48); ctx.lineTo(sw * .55, -bh * .48); ctx.lineTo(sw * .42, bh * .48); ctx.lineTo(-sw * .42, bh * .48); ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#e0177e'; ctx.fillText('א', 0, fs * .36); ctx.restore();
  // cracks spread from the empty slot as the letter leaves
  if (st.p > .25) { const r = rng(12); ctx.strokeStyle = 'rgba(10,6,3,.85)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { let px = s0.x, py = s0.y, a = r() * 6.28; ctx.beginPath(); ctx.moveTo(px, py); for (let k = 0; k < 7 * st.p; k++) { a += (r() - .5) * 1.2; px += Math.cos(a) * W * .03; py += Math.sin(a) * W * .03; ctx.lineTo(px, py); } ctx.stroke(); } }
  // the giant goes back to clay: the whole figure dissolves into dots
  const d = Math.max(0, (st.p - .55) / .45); if (d > .01 || ptr.f > .02) { const src = (draw.src && draw.src.width === W && draw.src.height === H) ? draw.src : (draw.src = mk(W, H)); const sx = src.getContext('2d');  /* quality pass: one scratch canvas per size, not one per frame (M2) */ sx.fillStyle = '#000'; sx.fillRect(0, 0, W, H); sx.drawImage(giant, 0, 0); apply(src, [[byId.dotfield, { mode: 0, mix: .35, thresh: .1, dissolve: d * d, size: 1.2, alpha: d > .01 ? Math.min(1, d * 2 + .3) : 1, only: d > .01 ? 0 : 1, count: small ? 14000 : 26000,  /* quality pass: 40000 measured 38 ms per frame at p95 */ ptr: ptr.arr(), pr: .16 }]], dots, { t }); ctx.globalAlpha = 1 - Math.min(1, d * 1.2); } else dots.getContext('2d').clearRect(0, 0, W, H);
  ctx.globalAlpha = 1;
}
function words() { const out = st.p > .6; $('word').textContent = out ? 'מת' : 'אמת'; $('tr').textContent = out ? 'MET: dead' : 'EMET: truth'; $('word').setAttribute('lang', 'he'); if (out !== words.o) { words.o = out; $('live').textContent = out ? 'The aleph is out. The word reads met, dead. The giant is going back to clay.' : 'The word on the brow reads emet, truth.'; } }
const setP = v => { st.tgt = Math.max(0, Math.min(1, v)); $('take').setAttribute('aria-valuenow', Math.round(st.tgt * 100)); };
let drag = false, y0 = 0, p0 = 0; stage.addEventListener('pointerdown', e => { drag = true; y0 = e.clientY; p0 = st.tgt; stage.setPointerCapture(e.pointerId); }); stage.addEventListener('pointermove', e => { if (drag) setP(p0 + (y0 - e.clientY) / (stage.clientHeight * .5)); }); stage.addEventListener('pointerup', () => { drag = false; if (st.tgt > .6) snd.once('clink', { rate: .7 }); });
$('take').addEventListener('keydown', e => { if (e.shiftKey) return; const a = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0; if (a) { setP(st.tgt + a * .08); e.preventDefault(); if (st.tgt > .6) snd.once('clink', { rate: .7 }); if (RM) { st.p = st.tgt; words(); draw(1); } } });
$('btn').onclick = () => { setP(st.tgt > .5 ? 0 : 1); snd.once('clink', { rate: .7 }); if (RM) { st.p = st.tgt; words(); draw(1); } $('btn').textContent = st.tgt > .5 ? 'Put the aleph back' : 'Take out the aleph'; };
addEventListener('resize', () => { layout(); if (RM) draw(1); }); layout();
if (RM) { words(); draw(1); } else {
  // quality pass (M2): a settled plate with no pointer in it is not redrawn; it measured 25 to 38 ms a frame idle
  let still = 0;
  addEventListener('resize', () => { still = 0; });
  loop(stage, (t, dt) => { const moving = Math.abs(st.tgt - st.p) > 1e-4 || ptr.f > .02; st.p += (st.tgt - st.p) * Math.min(1, dt * 3.5); ptr.update(dt); words(); if (moving || still < 2) { draw(t); still = moving ? 0 : still + 1; } }, small ? 24 : 40);
}
window.__emet = { set: v => { st.p = st.tgt = v; words(); } };
