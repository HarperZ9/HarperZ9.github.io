// Demo wiring for the plate room. The ecosystem room lives in life.js.
import { solvePlate, drivenAmplitude, membraneAmplitude, Sand, modeForValue, valueForMode, pitchRatio } from './chladni.js';
import { startLife } from './life.js';
import { createPlateRenderer } from './plate-gl.js';

const SENTENCE = 'between finite and infinite there is no comparison ';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cv = document.getElementById('plate'), readout = document.getElementById('plate-readout');
// Grain budget (quality pass, 2026-10-23): letter grains carry the sentence; fine grains are the sand that
// draws the ridge. Desktop 6,000 + 24,000, small screens 2,500 + 9,000. The simulation runs on a fixed
// 120 Hz clock whatever the display rate, at most 4 ticks per frame; resting grains cost nothing, a settled
// plate is not redrawn, and nothing runs while the plate is off screen.
const small = innerWidth < 700, N_LETTERS = small ? 2500 : 6000, N_FINE = small ? 9000 : 24000;
const TICK = 1 / 120, MAX_TICKS = 4;
// step options for the 120 Hz clock: the walk is tuned at 240 Hz, so the throw scales by sqrt 2 (same diffusion)
// and the drifts by 2 (same speed)
const STEP = { hop: 0.16 * Math.SQRT2, drift: 0.0012, roll: 0.008 };
let gfx = null, visible = true, dirty = true;

const state = { edge: 'free', k: 6, sounding: false, series: null, seriesIdx: 0, timer: 0 };
const plates = {};
const plateFor = (edge) => (plates[edge] ??= solvePlate({ N: 12, edge }));
// drum modes for the comparison view, ordered by pitch (n² + m²), excluding the transposed duplicates
const DRUM = []; for (let n = 1; n <= 7; n++) for (let m = n; m <= 7; m++) DRUM.push([n, m]); DRUM.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
const MAXK = 20;

let field = null, sand = null, fine = null, acc = 0, last = 0;

function fieldFor() {
  if (state.edge === 'membrane') { const [n, m] = DRUM[state.k - 1]; return membraneAmplitude(n, m, 45, 192); }
  const p = plateFor(state.edge); return drivenAmplitude(p, p.modes[state.k - 1].lambda, { R: 192 });
}
function describe() {
  if (state.edge === 'membrane') { const [n, m] = DRUM[state.k - 1]; return `drum mode <b>${state.k}</b> · sin ${n}πu · sin ${m}πv · pitch ×${(Math.hypot(n, m) / Math.SQRT2).toFixed(2)}`; }
  const p = plateFor(state.edge), md = p.modes[state.k - 1];
  return `${state.edge} plate mode <b>${state.k}</b> · λ ${md.lambda.toFixed(2)} · pitch ×${pitchRatio(p, state.k).toFixed(2)} · ${md.cls}`;
}

// The word in silence: rasterize it in the display face and sample grain homes in reading order.
async function homesFor(word, count = N_LETTERS, step = 2) {
  await document.fonts.load('850 200px "Hanken Grotesk"').catch((e) => console.warn('font load failed, using fallback face', e));
  const c = new OffscreenCanvas(900, 900), x = c.getContext('2d'); let size = 420;
  x.font = `850 ${size}px "Hanken Grotesk", system-ui, sans-serif`;
  const w = x.measureText(word).width || 1; size = Math.min(520, size * (780 / w)); x.font = `850 ${size}px "Hanken Grotesk", system-ui, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(word, 450, 470);
  const d = x.getImageData(0, 0, 900, 900).data, pts = [];
  for (let px = 0; px < 900; px += step) for (let py = 0; py < 900; py += step) if (d[(py * 900 + px) * 4 + 3] > 128) pts.push([px / 450 - 1, py / 450 - 1]);
  if (!pts.length) throw new Error(`homesFor: "${word}" rasterized to no pixels`);
  const out = []; for (let i = 0; i < count; i++) out.push(pts[Math.floor((i / count) * pts.length)]);
  return out; // pts are already column-major left to right, so reading order follows the word
}

function draw() {
  if (!gfx || !sand) return;
  gfx.draw([{ sand: fine, glyphs: false, px: 2.1 }, { sand, glyphs: true, px: 11 }], Math.floor(performance.now() / 41.7));
}
function tick() {
  let moved;
  if (state.sounding) moved = sand.step(field, STEP) + fine.step(field, STEP);
  else moved = sand.spell({ k: 0.0305 }) + fine.spell({ k: 0.0305 });   // 0.06 per 60 Hz frame, rescaled to 120 Hz
  if (moved) dirty = true;
}
function settle() { // reduced motion: jump straight to the end state, then draw once
  if (state.sounding) for (let i = 0; i < 1200; i++) tick();
  else for (const s of [sand, fine]) for (let i = 0; i < s.n; i++) { s.x[i] = s.hx[i]; s.y[i] = s.hy[i]; }
  draw();
}
function frame(now) {
  const dt = last ? Math.min(0.1, (now - last) / 1000) : TICK; last = now;
  if (visible) {
    acc += dt; let n = 0;
    while (acc >= TICK && n < MAX_TICKS) { tick(); acc -= TICK; n++; }
    if (n === MAX_TICKS) acc = 0;          // a long stall drops time instead of spiralling
    if (n && dirty) { draw(); dirty = false; }
  }
  requestAnimationFrame(frame);
}
new IntersectionObserver((es) => { visible = es[0].isIntersecting; last = 0; }).observe(cv);

// ---- sound: one sine partial at the plate's pitch ratio over 110 Hz, only after a click ----
let ac = null, osc = null, gain = null;
function audioUpdate() {
  const want = document.getElementById('audio').checked && state.sounding;
  if (!want) { if (gain) gain.gain.setTargetAtTime(0, ac.currentTime, 0.05); return; }
  ac ??= new AudioContext(); if (!osc) { osc = ac.createOscillator(); gain = ac.createGain(); gain.gain.value = 0; osc.connect(gain).connect(ac.destination); osc.start(); }
  const ratio = state.edge === 'membrane' ? Math.hypot(...DRUM[state.k - 1]) / Math.SQRT2 : pitchRatio(plateFor(state.edge), state.k);
  osc.frequency.setTargetAtTime(Math.min(1800, 110 * ratio), ac.currentTime, 0.03); gain.gain.setTargetAtTime(0.05, ac.currentTime, 0.08);
}

const WHAT = {
  free: "A free square plate, Poisson ratio 0.3, solved by Rayleigh-Ritz on a Legendre basis. The numbers are Leissa's frequency parameter, so you can check them against the published table.",
  clamped: 'The same plate with its rim clamped: no motion and no slope at the edge. The modes stiffen (the first sits at λ 35.99) and the rim itself becomes a resting line.',
  membrane: 'A drum, not a plate: sin(nπu)·sin(mπv) mixed with its transpose. The reference clip fits this family best, with sand lining the rim and straight lines at whole fractions of the side.',
};
function refresh() {
  dirty = true;
  field = fieldFor(); document.getElementById('what').textContent = WHAT[state.edge];
  const s = state.series, sv = s ? ` · ${s.rows[state.seriesIdx].year}: ${s.rows[state.seriesIdx].v.toFixed(1)}% inflation` : '';
  readout.innerHTML = (state.sounding ? describe() : `silence · grains spell the word · next mode ${state.k}`) + sv;
  document.getElementById('mode-k').textContent = String(state.k);
  document.getElementById('sound').setAttribute('aria-pressed', String(state.sounding));
  document.getElementById('sound').textContent = state.sounding ? 'Let it fall silent' : 'Sound the plate';
  audioUpdate(); if (reduce) settle();
}

async function loadSeries() {
  const r = await fetch('../../dataviz/data/cpi-annual.json');
  if (!r.ok) throw new Error(`series fetch failed: ${r.status}`);
  const d = await r.json(), rows = d.rows.filter((q) => q.inflation_pct != null && (q.year - 1917) % 8 === 0).map((q) => ({ year: q.year, v: q.inflation_pct }));
  const lo = Math.min(...rows.map((q) => q.v)), hi = Math.max(...rows.map((q) => q.v)), scale = { lo, hi, kMin: 1, kMax: MAXK };
  const step = (hi - lo) / (MAXK - 1);
  document.getElementById('series-key').textContent = `Key: mode k stands for ${lo.toFixed(1)}% + (k − 1) × ${step.toFixed(2)}%, read to ±${(step / 2).toFixed(2)}%. Mode 1 = ${valueForMode(1, scale).toFixed(1)}%, mode ${MAXK} = ${valueForMode(MAXK, scale).toFixed(1)}%. Source: ${d.series}, sha256 ${d.raw_sha256.slice(0, 12)}…`;
  return { rows, scale };
}
function seriesStep() {
  const s = state.series; if (!s) return;
  state.seriesIdx = (state.seriesIdx + 1) % s.rows.length; state.k = modeForValue(s.rows[state.seriesIdx].v, s.scale); state.sounding = true; refresh();
}

async function main() {
  try {
    const word = 'finite';
    sand = new Sand(N_LETTERS, { seed: 22, text: SENTENCE, homes: await homesFor(word) });
    fine = new Sand(N_FINE, { seed: 23, text: '.', homes: await homesFor(word, N_FINE, 1) });
    gfx = createPlateRenderer(cv, { chars: SENTENCE });
    addEventListener('resize', () => draw());
    refresh(); draw();
    if (!reduce) requestAnimationFrame(frame); else settle();
  } catch (e) { console.error('plate demo failed to start', e); readout.textContent = `could not start: ${e.message}`; return; }
  const on = (id, f) => document.getElementById(id).addEventListener('click', f);
  on('sound', () => { state.sounding = !state.sounding; refresh(); });
  on('export', async () => {
    try {
      const blob = await gfx.exportPNG([{ sand: fine, glyphs: false, px: 2.1 }, { sand, glyphs: true, px: 11 }], 3840);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chladni-${state.edge}-mode${state.k}-3840.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { console.error('plate export failed', e); readout.textContent = `export failed: ${e.message}`; }
  });
  on('next', () => { state.k = state.k % MAXK + 1; state.sounding = true; refresh(); });
  on('prev', () => { state.k = ((state.k + MAXK - 2) % MAXK) + 1; state.sounding = true; refresh(); });
  on('series', async () => {
    try { state.series ??= await loadSeries(); } catch (e) { console.error('could not load the data series', e); readout.textContent = 'data series unavailable'; return; }
    clearInterval(state.timer); state.seriesIdx = -1; seriesStep();
    if (!reduce) state.timer = setInterval(seriesStep, 1800); else document.getElementById('series').textContent = 'Next value';
  });
  document.querySelectorAll('input[name=edge]').forEach((r) => r.addEventListener('change', () => { state.edge = r.value; state.sounding = true; refresh(); }));
  document.getElementById('audio').addEventListener('change', audioUpdate);
  document.getElementById('word').addEventListener('change', async (ev) => {
    const w = ev.target.value.trim() || 'finite';
    try { sand.setHomes(await homesFor(w)); fine.setHomes(await homesFor(w, N_FINE, 1)); state.sounding = false; clearInterval(state.timer); refresh(); } catch (e) { console.error('could not set the word', e); }
  });
  cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') document.getElementById('next').click(); if (e.key === 'ArrowLeft') document.getElementById('prev').click(); if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); document.getElementById('sound').click(); } });
}
main();
startLife(reduce);
