// The skipping groove: a 78 that catches on a scratch. One bar repeats, and every digital copy keeps the shape of the injury.
import { byId, apply, loadImage, mk, pointer, rng } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, sfx = small ? '-s' : '';
const [label, berliner] = await Promise.all(['disc-label', 'gramophone-berliner'].map(n => loadImage(`assets/img/${n}${sfx}.jpg`)));
const snd = sound({ hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 }, record78: { url: 'assets/audio/record78.opus', gain: 0.314 } }); snd.mount(document.querySelector('.top'));
const cv = $('cv'), ctx = cv.getContext('2d'), dots = $('dots'), ptr = pointer($('stage'), { keys: $('stage') });
const DUR = 14, TS = 6.2, LOOP = 1.15, ROT = .42, TILT = -.5; // clip length, skip time, loop length (s), visual revolutions per second
const st = { mode: 'play', t: 0, loops: 0, pull: 0, ang: 0, lift: 0, ended: false }; let last = performance.now(), src = null;
const live = $('live'), count = $('count');

// ---- the record as a drawn object: shellac, grooves, label, one scratch ----
let S = 800; const disc = mk(2, 2);
function paintDisc(n) {
  disc.width = disc.height = n; const x = disc.getContext('2d'), c = n / 2, R = n * .47, r = rng(7);
  x.fillStyle = '#0c0b0a'; x.beginPath(); x.arc(c, c, R, 0, 7); x.fill();
  for (let i = 0; i < 520; i++) { const rr = R * (.34 + .64 * i / 520); x.strokeStyle = `rgba(${r() < .5 ? '255,250,235' : '0,0,0'},${.03 + r() * .08})`; x.lineWidth = .6 + r() * .8; x.beginPath(); x.arc(c, c, rr, 0, 7); x.stroke(); }
  const g = x.createConicGradient(0, c, c); g.addColorStop(0, 'rgba(255,255,255,.0)'); g.addColorStop(.12, 'rgba(255,255,255,.14)'); g.addColorStop(.25, 'rgba(255,255,255,0)'); g.addColorStop(.62, 'rgba(255,255,255,.1)'); g.addColorStop(.75, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(c, c, R, 0, 7); x.arc(c, c, R * .3, 0, 7, true); x.fill();
  x.save(); x.beginPath(); x.arc(c, c, R * .3, 0, 7); x.clip(); cover(x, label, c - R * .3, c - R * .3, R * .6, R * .6, .5, .35); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, 0, n, n); x.restore();
  x.fillStyle = '#0c0b0a'; x.beginPath(); x.arc(c, c, R * .03, 0, 7); x.fill();
  // the scratch: a thin bright line across the grooves at one angle, with a chip
  x.save(); x.translate(c, c); x.rotate(TILT); x.strokeStyle = 'rgba(255,240,220,.85)'; x.lineWidth = 2; x.beginPath(); x.moveTo(R * .38, 3); x.lineTo(R * .97, -4); x.stroke(); x.strokeStyle = 'rgba(224,23,126,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(R * .5, 3); x.lineTo(R * .86, -2); x.stroke(); x.restore();
}
const rOf = t => .93 - .5 * (t / DUR); // needle radius as a fraction of the disc radius, outside to inside
function draw(now) {
  const n = cv.width, c = n / 2, R = n * .47; ctx.clearRect(0, 0, n, n);
  ctx.fillStyle = '#1d1c1a'; ctx.beginPath(); ctx.arc(c, c, R * 1.07, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6f2a'; ctx.lineWidth = n * .008; ctx.stroke();
  ctx.save(); ctx.translate(c, c); ctx.rotate(st.ang); ctx.drawImage(disc, -c, -c, n, n); ctx.restore();
  // the tonearm: pivot at upper right, needle at the current radius on the line through the centre at TILT
  const rr = rOf(st.t) * R, nx = c + Math.cos(0) * rr, ny = c; const px = n * .93, py = n * .1, lift = st.lift;
  ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = n * .02; ctx.beginPath(); ctx.moveTo(px + 6, py + 10); ctx.lineTo(nx + 8 + lift * 20, ny + 16 + lift * 24); ctx.stroke();
  const g = ctx.createLinearGradient(px, py, nx, ny); g.addColorStop(0, '#f1e4a6'); g.addColorStop(.5, '#b8932f'); g.addColorStop(1, '#7d5b14'); ctx.strokeStyle = g; ctx.lineWidth = n * .014; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx - lift * 14, ny - lift * 26); ctx.stroke();
  ctx.fillStyle = '#b8932f'; ctx.beginPath(); ctx.arc(px, py, n * .035, 0, 7); ctx.fill(); ctx.fillStyle = '#17150f'; ctx.beginPath(); ctx.arc(px, py, n * .014, 0, 7); ctx.fill();
  ctx.fillStyle = st.mode === 'stuck' || st.mode === 'pull' ? '#e0177e' : '#eee9df'; ctx.beginPath(); ctx.arc(nx - lift * 14, ny - lift * 26, n * .012, 0, 7); ctx.fill();
  // dots wake where the viewer's attention is
  if (ptr.f > .02) apply(cv, [[byId.dotfield, { mode: 0, mix: 0, invert: 0, thresh: .2, only: 1, size: 1.3, ptr: ptr.arr(), pr: .18, count: small ? 14000 : 36000 }]], dots, { t: now / 1000 }); else dots.getContext('2d').clearRect(0, 0, dots.width, dots.height);
}

// ---- the state machine and the sound ----
function stopSrc() { if (src) { try { src.stop(); } catch (e) {} src = null; } }
async function startAudio(offset, loopStart, loopEnd) {
  stopSrc(); if (!snd.on || !snd.ctx()) return; const b = await snd.buffer('record78').catch(e => { console.warn('groove: record78 failed to load', e); return null; }); if (!b) return; const s = snd.ctx().createBufferSource(), gn = snd.ctx().createGain(); gn.gain.value = 0.314; s.buffer = b; if (loopEnd) { s.loop = true; s.loopStart = loopStart; s.loopEnd = loopEnd; } s.connect(gn); gn.connect(snd.master()); s.start(0, offset); src = s;
}
const loopsMsg = () => { count.textContent = st.loops ? `Loop ${st.loops}. Same bar.` : ''; if (st.loops && st.loops % 3 === 1) live.textContent = `The needle is stuck. The same bar has played ${st.loops} times.`; };
function step(dt) {
  st.ang += dt * ROT * 6.2832; st.lift += ((st.mode === 'lifted' ? 1 : 0) - st.lift) * Math.min(1, dt * 8);
  if (st.mode === 'play' || st.mode === 'free') { st.t += dt; if (st.mode === 'play' && st.t >= TS) { st.mode = 'stuck'; st.loops = 1; st.t = TS; startAudio(TS - LOOP, TS - LOOP, TS); st.lt = 0; loopsMsg(); } if (st.t >= DUR) { st.mode = 'end'; st.t = DUR; } }
  else if (st.mode === 'stuck') { st.lt = (st.lt || 0) + dt; st.t = TS - LOOP + (st.lt % LOOP); if (st.lt >= st.loops * LOOP) { st.loops++; loopsMsg(); } }
  else if (st.mode === 'pull') { st.lt += dt; st.t = TS - LOOP + (st.lt % LOOP); if (st.lt >= (st.loops - st.base + 1) * LOOP) { st.loops++; loopsMsg(); } if (st.lt >= 3 * LOOP) { st.mode = 'free'; st.t = TS; startAudio(TS, 0, 0); live.textContent = 'The loop let go. The record plays on.'; } }
}
$('lift').onclick = () => { const b = $('lift'); if (st.mode === 'lifted') { st.mode = 'pull'; st.lt = 0; st.base = st.loops; startAudio(TS - LOOP, TS - LOOP, TS); b.textContent = 'Lift the needle'; b.setAttribute('aria-pressed', 'false'); live.textContent = 'The needle is dropped. The groove pulls it back to the same bar, three more times.'; }
  else if (st.mode === 'stuck' || st.mode === 'pull' || st.mode === 'play' || st.mode === 'free') { st.mode = 'lifted'; stopSrc(); b.textContent = 'Drop the needle'; b.setAttribute('aria-pressed', 'true'); live.textContent = 'The needle is lifted.'; } };
$('restart').onclick = () => { st.mode = 'play'; st.t = 0; st.loops = 0; count.textContent = ''; $('lift').textContent = 'Lift the needle'; $('lift').setAttribute('aria-pressed', 'false'); startAudio(0, 0, 0); };
snd.mount; $('stage').addEventListener('click', e => { if (e.target === dots || e.target === cv) { if (RM) return; } });
document.querySelector('.sndbtn').addEventListener('click', () => setTimeout(() => { if (snd.on) { snd.bed('hiss', 1); if (st.mode === 'stuck') startAudio(TS - LOOP, TS - LOOP, TS); else if (st.mode === 'play') startAudio(st.t, 0, 0); } else stopSrc(); }, 120));

// ---- the digital echo: four copies of the same bar, each lossier, with the repeat kept ----
const echo = $('echo'); let peaks = null;
async function waveform() {
  try { const r = await fetch('assets/audio/record78.opus'), a = await r.arrayBuffer(), oc = new OfflineAudioContext(1, 44100, 44100), b = await oc.decodeAudioData(a), d = b.getChannelData(0), seg = Math.floor(LOOP * b.sampleRate), start = Math.floor((TS - LOOP) * b.sampleRate), N = 56;
    const bar = (i0, len) => { const out = []; for (let k = 0; k < N; k++) { let m = 0; for (let j = Math.floor(k * len / N); j < Math.floor((k + 1) * len / N); j++) m = Math.max(m, Math.abs(d[i0 + j] || 0)); out.push(m); } return out; };
    const before = bar(start - seg, seg), rep = bar(start, seg), after = bar(Math.floor(TS * b.sampleRate), seg); const mx = Math.max(...before, ...rep, ...after) || 1; peaks = { before: before.map(v => v / mx), rep: rep.map(v => v / mx), after: after.map(v => v / mx) };
  } catch (e) { const r = rng(3); const mk2 = () => Array.from({ length: 56 }, () => .2 + r() * .7); peaks = { before: mk2(), rep: mk2(), after: mk2() }; }
  drawEcho();
}
function drawEcho() {
  if (!peaks) return; const w = echo.clientWidth, dpr = Math.min(devicePixelRatio || 1, 2), rows = 4, rh = 70; echo.width = w * dpr; echo.height = rows * rh * dpr; const x = echo.getContext('2d'); x.scale(dpr, dpr); x.clearRect(0, 0, w, rows * rh);
  const seq = [...peaks.before, ...peaks.rep, ...peaks.rep, ...peaks.rep, ...peaks.after], bw = w / seq.length, r = rng(9);
  const names = ['The record', 'Copy 1', 'Copy 2', 'Copy 4'], levels = [64, 12, 6, 3];
  for (let g = 0; g < rows; g++) { const y0 = g * rh + rh / 2; x.fillStyle = '#a39e94'; x.font = '600 16px "Hanken Grotesk",sans-serif'; x.fillText(names[g], 2, g * rh + 16);
    seq.forEach((v, i) => { const inRep = i >= 56 && i < 56 * 4, q = Math.round(v * levels[g]) / levels[g], vn = Math.max(0, q + (r() - .5) * (g * .12)); const h = Math.max(1.5, (inRep ? q : vn) * (rh - 26)); x.fillStyle = inRep ? '#e0177e' : '#eee9df'; x.fillRect(i * bw + 1, y0 + 8 - h / 2, Math.max(1, bw - 2), h); }); }
}
addEventListener('resize', drawEcho); waveform();

function layout() { const r = $('stage').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was 1.5, backing below DPR (R1) */; S = Math.round(r.width * dpr); cv.width = cv.height = dots.width = dots.height = S; cv.style.height = dots.style.height = r.width + 'px'; paintDisc(S); }
addEventListener('resize', layout); layout();
if (RM) { st.mode = 'stuck'; st.loops = 4; st.t = TS - .3; st.ang = .9; count.textContent = 'Loop 4. Same bar.'; draw(1000); }
else loop($('stage'), (t, dt) => { step(Math.min(dt, .05)); ptr.update(dt); draw(t * 1000); }, small ? 30 : 45);
window.__groove = { state: () => ({ mode: st.mode, loops: st.loops, t: st.t }) };
