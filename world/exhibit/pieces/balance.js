import { byId, apply, loadImage, mk, backend, dotCount, pointer } from '../media/index.js';
import { reduced, loop } from './common.js';
import * as A from './balance-art.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), cv = $('cv'), ctx = cv.getContext('2d'), RM = reduced;
const small = innerWidth < 700, sfx = small ? '-s' : '';
const load = n => loadImage(`assets/img/${n}${sfx}.jpg`);
const [concrete, layers, rust, hessian, heart, justice, famine, bread, gods, hunefer, wellcome] = await Promise.all(
  ['concrete-worn', 'concrete-layers', 'rust-metal', 'hessian', 'heart-ani', 'justice-etching', 'famine-bangalore', 'bread-line-bowery', 'gods-word', 'heart-hunefer', 'justice-wellcome'].map(load));
const IMG = { concrete, layers, rust, hessian, heart, justice, famine, bread, gods, hunefer };
const pt = A.makePatterns(ctx, IMG);
const WX0 = -400, WW = 1600, WH = 800;
const collage = A.buildCollage(IMG, WW, WH, small);

const NAMES = ['FEATHER', 'HEART', 'SACK', 'HASH'], SAYS = ['A feather on the left pan.', 'A heart on the left pan.', 'A sack of grain on the left pan.', 'A hash string on the left pan.'];
const MASS = [14, 85, 12, 30];
const st = { ang: 0, name: 'FEATHER', door: 0, hint: .1, t: 0 };
let idx = 0, mode = 'rest', tMode = 0, nextIdx = 0, objY = 0, objA = 1, vel = 0, restAt = performance.now(), playing = !RM, look = 0, lookT = 0, rot = 0, last = performance.now(), sceneDirty = true, spin = 0;
const snd = sound({ clink: { url: 'assets/audio/clink.opus', gain: 1.118 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
const ptr = pointer($('stage')), live = $('live'), say = () => SAYS[idx] + ' The arm is level.';
const lerp = (a, b, t) => a + (b - a) * t, sm = t => t * t * (3 - 2 * t);

// Layout: wide on desktop, portrait crop on phones. The canvas is sized in CSS; the backing store follows.
let portrait = false, S = mk(2, 2), OUT = mk(2, 2), sctx = S.getContext('2d');
function layout() {
  portrait = innerWidth < 700 || innerWidth < innerHeight * .9;
  const r = $('stage').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was small ? 1.5 : 1.25, backing below DPR (R1) */;
  const w = Math.round(r.width * dpr), h = Math.round((portrait ? Math.min(r.width * 1.25, innerHeight * .78) : Math.min(r.width * .5625, innerHeight - 190)) * dpr);
  cv.style.height = (h / dpr) + 'px'; cv.width = w; cv.height = h; $('dots').width = w; $('dots').height = h; S.width = OUT.width = w; S.height = OUT.height = h; sceneDirty = true;
}
function view() {
  const a = cv.width / cv.height, base = portrait ? { h: 800, cx: 300, cy: 400 } : { h: 800, cx: 400, cy: 400 }, und = { h: portrait ? 400 : 340, cx: 185, cy: 440 };
  const v = sm(look), h = lerp(base.h, und.h, v), cx = lerp(base.cx, und.cx, v), cy = lerp(base.cy, und.cy, v), w = h * a;
  return { s: cv.height / h, x: cx - w / 2, y: cy - h / 2 };
}

function drawWorld(c, t) {
  const V = view(); c.setTransform(V.s, 0, 0, V.s, -V.x * V.s, -V.y * V.s);
  const thv = st.ang * Math.PI / 180, lx = A.P.x - A.ARM * Math.cos(thv), ly = A.P.y - A.ARM * Math.sin(thv), rx = A.P.x + A.ARM * Math.cos(thv), ry = A.P.y + A.ARM * Math.sin(thv);
  c.fillStyle = '#0d4f80'; c.fillRect(WX0, -300, WW, 1400);
  A.rays(c, '#1aa3e0', '#0a3a66', 28, rot);
  if (look > .01) { c.globalAlpha = sm(look); A.rays(c, '#ffe93a', '#e0177e', 28, -rot * 1.6); c.globalAlpha = 1; }
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; for (const r of [90, 150, 230, 330]) { c.beginPath(); c.arc(A.P.x, A.P.y, r, 0, 7); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(400, 190, 60, 0, 7); c.fill(); c.fillStyle = '#151515'; c.beginPath(); c.arc(400, 190, 34, 0, 7); c.fill();
  c.globalAlpha = .95; c.drawImage(collage, WX0 + Math.sin(t * .07) * 6, 0); c.globalAlpha = 1;
  c.fillStyle = pt.floor; c.fillRect(WX0, 700, WW, 140); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(WX0, 700, WW, 140);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); for (let i = -14; i <= 14; i++) { c.moveTo(400 + i * 160, 800); c.lineTo(400 + i * 30, 700); } c.moveTo(WX0, 750); c.lineTo(WX0 + WW, 750); c.stroke();
  st.name = NAMES[idx]; st.t = t;
  A.stage(c, pt, st); A.beam(c, pt, st.ang);
  for (const [px, py, left] of [[lx, ly, true], [rx, ry, false]]) { c.save(); c.translate(px, py); A.pan(c, pt, left, st); if (!left) { c.save(); c.translate(0, 150); c.fillStyle = '#1d1d20'; c.strokeStyle = pt.brass; c.lineWidth = 3; const p = new Path2D('M-38 0V-16H38V0ZM-28 -16V-34H28V-16ZM-16 -34V-50H16V-34Z'); c.fill(p); c.stroke(p); c.beginPath(); c.arc(0, -58, 7, 0, 7); c.stroke(); c.restore(); }
    else { c.save(); c.translate(0, 150 + objY); c.globalAlpha = objA; if (mode === 'rest' && !RM) { if (idx === 1) { const k = 1 + .04 * Math.max(0, Math.sin(t * 6)) ** 3; c.scale(k, k); } if (idx === 0) c.rotate(Math.sin(t * 1.4) * .05); } if (idx === 0) c.scale(1.45, 1.45);
      [A.feather, A.heart, A.sack, A.hash][idx](c, idx === 2 ? pt : idx === 3 ? pt : t, idx === 3 ? t : 0, Math.floor(t * 2) % 4); c.restore(); } c.restore(); }
  c.save(); c.translate(556, 700); A.human(c); c.restore();
  // The prompt: stamped label and arrow, loudest while the sack is on the pan.
  if (look < .6) { const loud = idx === 2 ? 1 : .9, pulse = RM ? 1 : .88 + .12 * Math.sin(t * 5); c.save(); c.translate(lx - 10, ly + 340); c.rotate(-.06); c.globalAlpha = (1 - look / .6) * loud * pulse;
    c.fillStyle = '#ffe93a'; c.strokeStyle = '#151515'; c.lineWidth = 4; c.fillRect(-124, 0, 248, 54); c.strokeRect(-124, 0, 248, 54); c.fillStyle = '#151515'; c.font = `800 24px "Hanken Grotesk",sans-serif`; c.textAlign = 'center'; c.fillText('LOOK UNDER THE PAN', 0, 25);
    c.font = `700 13px "Hanken Grotesk",sans-serif`; c.fillText(idx === 2 ? 'Why did the sack feel light?' : 'The arm reads true. Check the base.', 0, 44); c.beginPath(); c.moveTo(0, -4); c.lineTo(-14, -26); c.lineTo(14, -26); c.closePath(); c.fillStyle = '#e0177e'; c.fill(); c.stroke(); c.restore(); }
  c.setTransform(1, 0, 0, 1, 0, 0);
}

function present(t) {
  drawWorld(sctx, t);
  const chain = [[byId.filmburn, { weave: RM ? 0 : .0012, burn: .1 + .55 * sm(look), flicker: RM ? 0 : .1 }]];
  if (look > .02) chain.push([byId.crt, { curve: .05 * look, scan: .55 * look, mask: .4 * look, bloom: .7 * look }]);
  apply(S, chain, OUT, { t, seed: 2 }); dots(t); const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(OUT, 0, 0);
}

function dots(t) { // the arm swing as a dot field: two wave sources at the pans, calm blue when level, hot when swinging
  const V = view(), th = st.ang * Math.PI / 180, uv = (x, y) => [(x - V.x) * V.s / cv.width, (y - V.y) * V.s / cv.height];
  const [ax, ay] = uv(A.P.x - A.ARM * Math.cos(th), A.P.y - A.ARM * Math.sin(th) + 150), [bx, by] = uv(A.P.x + A.ARM * Math.cos(th), A.P.y + A.ARM * Math.sin(th) + 150);
  const amp = 1;
  apply(null, [[byId.dotfield, { mode: 2, two: [ax, ay, amp, 0, bx, by, amp, 0], freq: 26 + Math.abs(st.ang) * 2, speed: 1.6 + Math.abs(vel) * .05, size: 1.2, amp: .25 + .75 * Math.min(1, Math.abs(st.ang) / 2.5), alpha: (.5 + .45 * Math.min(1, ptr.f)) * (1 - sm(look)), count: small ? 9000 : 16000, ptr: ptr.arr(), pr: .2 }]], $('dots'), { t });
}
function show(i) { idx = i; live.textContent = say(); }
function request(i) { i = (i + 4) % 4; if (RM) { show(i); st.ang = 0; present(performance.now() / 1000); return; } nextIdx = i; mode = 'out'; tMode = performance.now(); }
function step(now, dt) {
  ptr.update(dt);
  rot += dt * 2.2; look += (lookT - look) * Math.min(1, dt * 4.5); if (Math.abs(lookT - look) < .002) look = lookT;
  if (mode === 'out') { const k = (now - tMode) / 260; objY = -50 * k; objA = Math.max(0, 1 - k); if (k >= 1) { show(nextIdx); mode = 'in'; tMode = now; objY = -190; objA = 1; } }
  else if (mode === 'in') { const t = (now - tMode) / 1000; objY = Math.min(0, -190 + .5 * 2600 * t * t); if (objY >= 0) { objY = 0; mode = 'rest'; restAt = now; vel = -MASS[idx]; snd.once('clink', { rate: idx === 0 ? 1.6 : idx === 1 ? 1 : idx === 2 ? .7 : 1.25, gain: idx === 0 ? .3 : 1 }); } }
  else if (playing && look < .02 && lookT === 0 && now - restAt > 6200) request(idx + 1);
  if (look > .5) { st.ang = 0; vel = 0; } else { vel += (-70 * st.ang - 3.2 * vel) * dt; st.ang += vel * dt; if (Math.abs(st.ang) < .02 && Math.abs(vel) < .08) { st.ang = 0; vel = 0; } }
  const door = sm(Math.max(0, Math.min(1, (look - .45) / .55))); st.door = door; st.hint = (.12 + .1 * Math.sin(now / 330)) * (idx === 2 ? 2.2 : 1) * (1 - door);
}
function setLook(on) {
  lookT = on ? 1 : 0; $('look').setAttribute('aria-pressed', on); $('look').textContent = on ? 'Back to the beam' : 'Look under the pan';
  live.textContent = on ? 'Under the left pan, behind a brass door, a lit iron wedge props the pan up. The arm still reads level.' : say();
  if (RM) { look = lookT; step(performance.now(), .016); present(performance.now() / 1000); }
}
$('prev').onclick = () => request(idx - 1); $('next').onclick = () => request(idx + 1); $('look').onclick = () => setLook(lookT === 0);
$('pause').onclick = () => { playing = !playing; $('pause').setAttribute('aria-pressed', !playing); $('pause').textContent = playing ? 'Pause' : 'Play'; };
if (RM) $('pause').hidden = true;
cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(); if ((e.clientX - r.left) / r.width < .5 && (e.clientY - r.top) / r.height > .45) setLook(lookT === 0); });
$('stage').addEventListener('keydown', e => { const k = e.key; if (k === 'ArrowRight') request(idx + 1); else if (k === 'ArrowLeft') request(idx - 1); else if (k === 'ArrowDown') setLook(true); else if (k === 'ArrowUp') setLook(false); else return; e.preventDefault(); });
addEventListener('resize', () => { layout(); if (RM) present(performance.now() / 1000); });
layout(); show(0); $('engine').textContent = backend() === 'webgl2' ? '' : 'Canvas 2D fallback in use.';
if (RM) present(1); else { let ts = performance.now(); loop($('stage'), (t, dt) => { step(performance.now(), dt); present(t); }, small ? 30 : 45); }
window.__balance = { setLook, request, state: () => ({ idx, look, ang: st.ang }) };
