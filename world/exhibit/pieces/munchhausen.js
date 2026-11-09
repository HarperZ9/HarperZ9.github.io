// By his own hair: a verifier certifying itself. Drag the ring up and the Baron rises; the dot-field swamp shows nothing holding him.
import { byId, apply, loadImage, mk, pointer, rng } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, sfx = small ? '-s' : '';
const L = n => loadImage(`assets/img/${n}${sfx}.jpg`);
const [hair, stag, boar, ducks, hess] = await Promise.all(['munch-hair', 'munch-stag', 'munch-boar', 'munch-ducks', 'hessian'].map(L));
const snd = sound({ key: { url: 'assets/audio/key.opus', gain: 0.498 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
const cv = $('cv'), ctx = cv.getContext('2d'), dots = $('dots'), stage = $('stage'), ptr = pointer(stage, { keys: $('pull') });
const st = { rise: 0, tgt: 0, held: 0, done: false }; let W = 800, H = 640;
// Engraving to paper: the plate is opaque, torn and shadowed with the cut-paper medium.
const plate = (im, w, h, seed, chain = []) => { const pad = 26, s = mk(w + pad * 2, h + pad * 2); cover(s.getContext('2d'), im, pad, pad, w, h); const o = mk(s.width, s.height); apply(s, [...chain, [byId.cutpaper, { tear: .014, shadow: .8 }]], o, { seed }); return o; };
let main, p2, p3, p4; const band = mk(2, 2);
function build() {
  const hh = Math.round(H * .66); main = plate(hair, Math.round(hh * .64), hh, 2, [[byId.newsprint, { gain: .2, age: .55, through: .1 }]]);
  p2 = plate(stag, 190, 290, 3, [[byId.halftone, { cell: 5 }]]); p3 = plate(boar, 200, 300, 4, [[byId.riso, { misreg: .008, grain: .2, dropout: .1 }]]); p4 = plate(ducks, 180, 280, 5, [[byId.photocopy, { gen: .3 }]]);
}
function paintBand() { band.width = W; band.height = H; const x = band.getContext('2d'), r = rng(4); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); const g = x.createLinearGradient(0, H * .72, 0, H); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,.9)'); x.fillStyle = g; x.fillRect(0, H * .72, W, H * .28); for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(0,0,0,${.2 + r() * .5})`; x.fillRect(r() * W, H * .72 + r() * H * .28, 10 + r() * 60, 3 + r() * 6); } }
function layout() { const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was 1.5, backing below DPR (R1) */; W = Math.round(r.width * dpr); H = Math.round(Math.min(r.width * .8, innerHeight * .78) * dpr); cv.width = dots.width = W; cv.height = dots.height = H; cv.style.height = dots.style.height = H / dpr + 'px'; build(); paintBand(); }
const headPos = () => ({ x: W * .5, y: H * (.58 - st.rise * .26) });
function draw(t) {
  ctx.fillStyle = '#0d4f80'; ctx.fillRect(0, 0, W, H); ctx.save(); ctx.translate(W / 2, H * .3); for (let i = 0; i < 24; i++) { const a0 = i / 24 * 6.2832 + t * .02, a1 = a0 + .13; ctx.fillStyle = i % 2 ? '#1aa3e0' : '#0a3a66'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 2 * Math.cos(a0), W * 2 * Math.sin(a0)); ctx.lineTo(W * 2 * Math.cos(a1), W * 2 * Math.sin(a1)); ctx.fill(); } ctx.restore();
  ctx.drawImage(p2, W * .02, H * .08, p2.width * H / 900, p2.height * H / 900); ctx.drawImage(p3, W * .78, H * .06, p3.width * H / 900, p3.height * H / 900); ctx.drawImage(p4, W * .8, H * .5, p4.width * H / 900, p4.height * H / 900);
  ctx.fillStyle = '#17120c'; ctx.fillRect(0, H * .8, W, H * .2); // the swamp is drawn as dots, overlaid below
  const hp = headPos(), mw = main.width, mh = main.height, mx = W / 2 - mw / 2, my = H * .78 - mh + (-st.rise * H * .16);
  ctx.save(); ctx.translate(W / 2, my + mh); ctx.rotate(Math.sin(t * 1.3) * .01 * (1 - st.rise) - st.rise * .02); ctx.translate(-W / 2, -(my + mh)); ctx.drawImage(main, mx, my); ctx.restore();
  // the hair: a strand from the head up to the ring the viewer holds
  const ringY = H * .13, hy = my + mh * .11; ctx.strokeStyle = '#eee9df'; ctx.lineWidth = Math.max(2, W / 260); ctx.beginPath(); ctx.moveTo(W / 2 + mw * .02, hy); ctx.bezierCurveTo(W / 2 + W * .09, hy - H * .1, W / 2 - W * .09, ringY + H * .12, W / 2, ringY + 10); ctx.stroke();
  ctx.strokeStyle = '#d9b44a'; ctx.lineWidth = Math.max(4, W / 160); ctx.beginPath(); ctx.arc(W / 2, ringY, W * .024, 0, 7); ctx.stroke();
  // swamp as dots, pushed away from under him
  const bx = .5, by = (my + mh) / H; apply(band, [[byId.dotfield, { mode: 0, thresh: .06, size: 1.15, count: small ? 12000 : 30000, ptr: [bx, by, .3 + 1.7 * st.rise], pr: .27 }]], dots, { t });
}
function setRise(v) { st.tgt = Math.max(0, Math.min(1, v)); const p = $('pull'); p.setAttribute('aria-valuenow', Math.round(st.tgt * 100)); }
let drag = false, y0 = 0, r0 = 0;
stage.addEventListener('pointerdown', e => { drag = true; y0 = e.clientY; r0 = st.tgt; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', e => { if (drag) { setRise(r0 + (y0 - e.clientY) / (stage.clientHeight * .5)); snd.once('key', { gain: .15, rate: 1.4 }); } });
stage.addEventListener('pointerup', () => drag = false);
$('pull').addEventListener('keydown', e => { if (e.shiftKey) return; const a = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0; if (a) { setRise(st.tgt + a * .06); snd.once('key', { gain: .3, rate: 1.4 }); e.preventDefault(); if (RM) { st.rise = st.tgt; text(); draw(1); } } });
function text() {
  const r = st.rise; $('pct').textContent = Math.round(r * 100) + '%'; $('hold').textContent = '0';
  $('t1').hidden = r < .25; $('t2').hidden = r < .55; $('t3').hidden = r < .8; if (r > .92 && !st.done) { st.done = true; $('end').hidden = false; $('live').textContent = $('end').textContent; }
}
addEventListener('resize', () => { layout(); if (RM) draw(1); }); layout();
if (RM) { st.rise = st.tgt = .0; text(); draw(1); } else loop(stage, (t, dt) => { st.rise += (st.tgt - st.rise) * Math.min(1, dt * 5); ptr.update(dt); text(); draw(t); }, small ? 24 : 40);
window.__mun = { set: v => { st.rise = st.tgt = v; text(); } };
