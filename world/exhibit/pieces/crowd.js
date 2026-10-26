// Manufactured consensus: one voice split across many accounts. A 1920s crowd photograph becomes a dot field whose points all share one waveform.
// Pull the crowd apart with the pointer, and strings appear to a single hand. The analogy is a ventriloquist.
import { byId, apply, loadImage, mk, pointer, rng } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, sfx = small ? '-s' : '', stage = $('stage'), cv = $('cv'), dots = $('dots'), wave = $('wave');
const [crowd, dummy, baker] = await Promise.all(['crowd-nyse', 'ventriloquist-coster', 'ventriloquist-baker'].map(n => loadImage(`assets/img/${n}${sfx}.jpg`)));
const snd = sound({ teletype: { url: 'assets/audio/teletype.opus', gain: 0.208 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 }, key: { url: 'assets/audio/key.opus', gain: 0.498 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
const ptr = pointer(stage, { keys: stage }), st = { r: 0 }; let W = 800, H = 560, src = mk(2, 2), puppet = null, anchors = [];
function layout() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was 1.5, backing below DPR (R1) */; W = Math.round(r.width * dpr); H = Math.round(Math.min(r.width * .7, innerHeight * .78) * dpr); for (const c of [cv, dots, src]) { c.width = W; c.height = H; } cv.style.height = dots.style.height = H / dpr + 'px';
  const x = src.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); cover(x, crowd, 0, H * .22, W, H * .78, .5, .6);
  const pw = Math.round(W * .26), ph = Math.round(pw * .8), s = mk(pw + 40, ph + 40); cover(s.getContext('2d'), dummy, 20, 20, pw, ph, .5, .45); puppet = mk(s.width, s.height); apply(s, [[byId.halftone, { cell: 4 }], [byId.cutpaper, { tear: .014, shadow: .8 }]], puppet, { seed: 4 });
  const r2 = rng(6); anchors = Array.from({ length: small ? 22 : 46 }, () => [r2() * W, H * (.35 + r2() * .6)]);
  const w = wave; w.width = Math.round(r.width * dpr); w.height = Math.round(120 * dpr);
}
function strings(t) {
  const c = cv.getContext('2d'); c.clearRect(0, 0, W, H); c.fillStyle = '#0e0c0a'; c.fillRect(0, 0, W, H); c.save(); c.globalAlpha = .28; c.drawImage(src, 0, 0); c.restore();
  const k = Math.max(0, (st.r - .15) / .85), hx = W / 2, hy = H * .2 + Math.sin(t * 1.6) * 3;
  if (k > .01) { c.strokeStyle = `rgba(238,233,223,${.15 + k * .6})`; c.lineWidth = Math.max(1, W / 700); anchors.forEach(([ax, ay], i) => { if (i / anchors.length > k * 1.15) return; c.beginPath(); c.moveTo(hx, hy + 20); c.quadraticCurveTo((hx + ax) / 2 + Math.sin(t + i) * 8, (hy + ay) / 2 - 20, ax, ay); c.stroke(); });
    c.save(); c.globalAlpha = Math.min(1, k * 1.6); c.drawImage(puppet, hx - puppet.width / 2, hy - puppet.height * .55 + (1 - k) * -H * .1); c.restore(); }
}
function waves(t) {
  const c = wave.getContext('2d'), w = wave.width, h = wave.height, rows = 8; c.clearRect(0, 0, w, h); c.fillStyle = '#0b0b0c'; c.fillRect(0, 0, w, h); const sep = 1 - Math.min(1, st.r * 1.6);
  for (let i = 0; i < rows; i++) { c.strokeStyle = i === 0 ? '#e0177e' : `rgba(238,233,223,${.35 + .4 * (1 - sep)})`; c.lineWidth = i === 0 ? 3 : 2; c.beginPath(); for (let x = 0; x <= w; x += 3) { const u = x / w * 12 - t * 1.4 + i * .55 * sep, y = h / 2 + (i - rows / 2) * 5 * sep + Math.sin(u) * h * .26 * (.6 + .4 * Math.sin(u * .3)); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  $('says').textContent = st.r > .8 ? 'One trace. Eight accounts, one source.' : st.r > .35 ? 'The traces are lining up.' : 'Eight accounts, eight voices.';
}
let last = 0; function frame(t, dt) {
  ptr.update(dt); st.r = Math.min(1, st.r + ptr.f * dt * .16); if (ptr.f < .02) st.r = Math.max(st.r - dt * .01, 0);
  strings(t); waves(t); apply(src, [[byId.dotfield, { mode: 0, mix: 0, thresh: .12, sync: 1 - Math.min(1, st.r * .5), speed: 2.4, size: 1.1, count: small ? 16000 : 52000, ptr: ptr.arr(), pr: .2, dissolve: st.r * .22 }]], dots, { t });
  if (st.r > .8 && !frame.done) { frame.done = true; $('live').textContent = 'The accounts share one waveform. A single hand pulls the strings.'; snd.once('key', { rate: .7 }); }
}
$('pull').onclick = () => { st.r = Math.min(1, st.r + .34); if (RM) { strings(1); waves(1); } };
addEventListener('resize', () => { layout(); if (RM) { strings(1); waves(1); } }); layout();
if (RM) { st.r = .9; strings(1); waves(1); apply(src, [[byId.dotfield, { mode: 0, mix: 0, thresh: .12, sync: .5, size: 1.1, count: 30000, dissolve: .2 }]], dots, { t: 1 }); } else loop(stage, frame, small ? 24 : 40);
window.__crowd = { set: v => { st.r = v; } };
