// Between stations: the dot field as radio static. Turn the dial and an almost-image gathers, then slips. It never settles.
import { byId, apply, loadImage, mk, pointer } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, cv = $('cv'), sfx = small ? '-s' : '';
const STN = [{ f: .2, n: 'pale-blue-dot', say: 'Something faint and blue.' }, { f: .5, n: 'golden-record', say: 'A disc. Gold. It was meant for someone with a needle.' }, { f: .8, n: 'fast-telescope', say: 'A dish in a valley, listening.' }];
const imgs = await Promise.all(STN.map(s => loadImage(`assets/img/${s.n}${sfx}.jpg`)));
const W = small ? 340 : 760, H = small ? 340 : 480; cv.width = W; cv.height = H;
const srcs = imgs.map(im => { const c = mk(W, H), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); cover(x, im, 0, 0, W, H, .5, .5); return c; });
const snd = sound({ hiss: { url: 'assets/audio/hiss.opus', gain: 0.134 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
// Static is made in code: a noise buffer through a band-pass that follows the dial. It evokes a radio between stations, nothing more.
let nz = null;
snd.hook = () => { const c = snd.ctx(); if (!c || nz) return; const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .7; const g = c.createGain(); g.gain.value = .0; s.connect(f); f.connect(g); g.connect(snd.master()); s.start(); nz = { f, g }; };
document.querySelector('.sndbtn').addEventListener('click', () => setTimeout(() => snd.on && snd.hook(), 200));
const ptr = pointer($('stage'), { keys: $('stage') }), st = { f: .12, clar: 0, near: 0, vel: 0 }; const dial = $('f');
const clarityAt = f => { let b = 0, k = 0; STN.forEach((s, i) => { const c = Math.exp(-(((f - s.f) / .035) ** 2)); if (c > b) { b = c; k = i; } }); return { c: b, k }; };
function step(dt, now) {
  const { c, k } = clarityAt(st.f); st.near = k; st.clar += (c * .78 - st.clar) * Math.min(1, dt * 6);
  if (c > .6) { st.hold = (st.hold || 0) + dt; if (st.hold > 1.2) st.f += (st.f < STN[k].f ? -1 : 1) * .02 * dt * 3 + (Math.sin(now * 1.7) * .01) * dt; } else st.hold = 0; // the dial drifts off the station
  st.f = Math.max(0, Math.min(1, st.f)); dial.value = Math.round(st.f * 1000);
  if (nz) { nz.f.frequency.value = 400 + st.f * 3000; nz.g.gain.setTargetAtTime(.12 * (1 - st.clar * .9), snd.ctx().currentTime, .1); }
  $('say').textContent = st.clar > .45 ? STN[k].say : 'Noise.'; $('meter').style.width = Math.round(st.clar / .78 * 100) + '%';
}
function draw(t) {
  const d = 1 - Math.pow(Math.max(0, st.clar / .78), .6) * .84; // never below .22: it does not resolve
  apply(srcs[st.near], [[byId.dotfield, { mode: 0, mix: 0, invert: 0, thresh: .06, dissolve: RM ? .5 : d, size: 1.2, count: small ? 16000 : 52000, ptr: ptr.arr(), pr: .15 }]], cv, { t });
}
dial.addEventListener('input', () => { st.f = +dial.value / 1000; st.hold = 0; if (RM) { st.clar = clarityAt(st.f).c * .78; step(0, 0); draw(1); } });
$('stage').addEventListener('keydown', e => { if (e.shiftKey) return; const a = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0; if (a) { st.f = Math.max(0, Math.min(1, st.f + a * (e.altKey ? .02 : .005))); st.hold = 0; e.preventDefault(); if (RM) { st.clar = clarityAt(st.f).c * .78; step(0, 0); draw(1); } } });
let dragging = false; const fromX = e => { const r = $('strip').getBoundingClientRect(); st.f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); st.hold = 0; };
$('strip').addEventListener('pointerdown', e => { dragging = true; $('strip').setPointerCapture(e.pointerId); fromX(e); }); $('strip').addEventListener('pointermove', e => { if (dragging) fromX(e); }); $('strip').addEventListener('pointerup', () => dragging = false);
if (RM) { st.f = .5; st.clar = .78 * .6; step(0, 0); draw(1); } else loop($('stage'), (t, dt) => { step(Math.min(dt, .05), t); ptr.update(dt); draw(t); }, small ? 24 : 40);
window.__static = { set: f => { st.f = f; st.hold = 0; st.clar = clarityAt(f).c * .78; } };
