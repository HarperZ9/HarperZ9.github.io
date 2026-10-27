// demo.js: the page. The hero word is a cloud grown along the lettering agent's glyph skeleton (cloud.json, volume
// style); the star cloud plate; the painting studio; one cloud.json in four styles; and two ledgers, one writing a
// measured series, one a word that tallies its own letters.
import { Grain } from './brush/index.js';
import { makeCloud, growLobes } from './brush/cloud2d.js';
import { createLedger, seriesFromMask, maskFromCoverage } from './ledger/ledger.js';
import { glyphFromElement, glyphFromText } from '../../lettering/lib/glyph.mjs';
import { studio } from './demo-studio.js';
import { ctx2d, srgbImage } from './demo-canvas.js';
import { renderOff } from './demo-worker.js';

const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
// ?still forces the reduced-motion path, so the still state can be checked in a browser that cannot emulate it
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('still');

// Letters built from the technique: trunk lobes ride the word's centre lines, grow sub-lobes toward a light above
// and to the left, and render as one lit cloud. The h1 text stays for screen readers; the painting is the word.
async function cloudWord(h1) {
  const g = await glyphFromElement(h1, { pad: 40 });
  const W = Math.round(g.w * dpr), H = Math.round(g.h * dpr), k = dpr / W, half = g.half;
  const trunks = [];
  for (const st of g.strokes) for (let i = 0; i < st.pts.length; i += 2 * Math.max(1, Math.round(half * 0.9))) {
    trunks.push({ c: [st.pts[i] * k, st.pts[i + 1] * k, 0], r: [half * 1.25 * k, half * 1.1 * k, half * 1.2 * k] });
  }
  const light = { pos: [0.12, -0.2, 0.06], color: '#f4f3fb', falloff: 2, intensity: 1.6 };
  const cloud = makeCloud({ seed: 5, lobes: growLobes(trunks, { seed: 5, depth: 1, light }), light, base: { y: 99, soft: 0.01 },
    erosion: [{ kind: 'billow', scale: 60, amount: 0.004 }], medium: { extinction: 160, ambient: '#565b80', bounce: '#1b1a24', powder: 0.4 }, style: 'volume',
    styleOpts: { mid: '#3e3f58', lit: '#ecebf8', glowK: 0, rimK: 0.6, ambient: 0.3, under: 0, curl: 0.003, soft: [0.0015, 0.006] } });
  // rendered in the worker on a transparent layer (ground null), with the default film grain
  const r = await renderOff({ scene: { aspect: H / W, ground: null, ops: [{ type: 'cloud', cloud }], grain: { period: 0.0038, amount: 0.03 } }, width: W, out: 'rgba8' });
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, { position: 'absolute', left: `${-g.pad}px`, top: `${-g.pad}px`, width: `${g.cssWidth}px`, height: `${g.cssHeight}px`, zIndex: '-1', pointerEvents: 'none' });
  ctx2d(c).putImageData(srgbImage(new Uint8ClampedArray(r.buffer), r.w, r.h), 0, 0);
  h1.style.height = `${h1.getBoundingClientRect().height}px`; h1.style.position = 'relative'; h1.style.isolation = 'isolate';
  h1.append(c); h1.classList.add('lettered');
}

async function heroPlate(cv) {
  // R1: full device resolution, capped only above 2600 px per side (a 2600 x 3467 paint takes a few seconds)
  const W = Math.min(2600, Math.round(cv.clientWidth * dpr)), H = Math.round(W * 4 / 3);
  cv.width = W; cv.height = H;
  const r = await renderOff({ scene: 'starcloud', width: W, out: 'rgba8' }); // off the main thread
  ctx2d(cv).putImageData(srgbImage(new Uint8ClampedArray(r.buffer), r.w, r.h), 0, 0);
}

// One cloud.json, four 2D styles: the same lobe tree, base and light, read as volume, wash, dither and halftone.
async function styles(root) {
  const base = makeCloud({ seed: 9, trunks: [{ c: [0.36, 0.62, 0], r: [0.2, 0.15, 0.18] }, { c: [0.62, 0.58, 0.02], r: [0.22, 0.17, 0.2] }, { c: [0.5, 0.42, -0.02], r: [0.17, 0.14, 0.16] }],
    light: { pos: [0.2, 0.12, -0.02], color: '#f6f4ff', falloff: 0.6, intensity: 1.8 }, base: { y: 0.74, soft: 0.01 }, medium: { extinction: 30, ambient: '#565b80', bounce: '#131117' } });
  await Promise.all([...root.querySelectorAll('canvas[data-style]')].map(async (cv) => {
    const W = Math.round(cv.clientWidth * dpr), style = cv.dataset.style; cv.width = W; cv.height = W;
    const so = { volume: { lit: '#e3e2f6', glowK: 0.3 }, halftone: { pitch: 0.024 }, dither: { cell: 0.006 } }[style] ?? {};
    const paper = style === 'volume' ? ['#0b0b10', '#0b0b10'] : ['#e9e4d8', '#e9e4d8'];
    const r = await renderOff({ scene: { aspect: 1, ground: paper, ops: [{ type: 'cloud', cloud: { ...base, base: { ...base.base, soft: 0.02 }, style, styleOpts: so } }] }, width: W, out: 'rgba8' });
    ctx2d(cv).putImageData(srgbImage(new Uint8ClampedArray(r.buffer), r.w, r.h), 0, 0);
  }));
}

// Halftone patterns for the ledger's side faces, cached per ink, tone and pitch.
const patterns = new Map();
function patternFor(ctx) {
  return (ink, tone, pitch) => {
    const key = `${ink}|${tone.toFixed(2)}|${Math.round(pitch)}`; if (patterns.has(key)) return patterns.get(key);
    const P = Math.max(4, Math.round(pitch * 0.2)), c = document.createElement('canvas'); c.width = c.height = P;
    const x = c.getContext('2d'), n = parseInt(ink.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    x.fillStyle = `rgb(${rgb.map((v) => Math.round(v * Math.min(1, tone + 0.15))).join(',')})`; x.fillRect(0, 0, P, P);
    x.fillStyle = `rgb(${rgb.map((v) => Math.round(v * tone * 0.45)).join(',')})`;
    const r = (P / 2) * Math.sqrt(Math.max(0.05, 1 - tone)); x.beginPath(); x.arc(P / 2, P / 2, r, 0, Math.PI * 2); x.fill();
    const pat = ctx.createPattern(c, 'repeat'); patterns.set(key, pat); return pat;
  };
}

// A ledger on a canvas, animated only while visible on a fixed 1/120 s clock; reduced motion shows it written.
function ledger(cv, make, { cols, rows, playBtn }) {
  const ctx = ctx2d(cv), STEP = 1 / 120, pf = patternFor(ctx);
  let g = make(), playing = !reduced, visible = true, last = 0, raf = 0, acc = 0;
  // R4 paper grain as a static overlay the compositor blends (soft-light): drawn once per size, never per frame
  const overlay = document.createElement('canvas'); overlay.setAttribute('aria-hidden', 'true'); overlay.className = 'grain-overlay';
  cv.parentElement.style.position = 'relative'; cv.after(overlay);
  const fit = () => {
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientWidth * dpr * (rows + 2) / (cols + 2));
    const gl = grainLayer(cv.width, cv.height, 2.4 * dpr); overlay.width = gl.width; overlay.height = gl.height; ctx2d(overlay).drawImage(gl, 0, 0);
  };
  const draw = () => {
    const p = cv.width / (cols + 2); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = g.inks.ground; ctx.fillRect(0, 0, cv.width, cv.height); g.draw(ctx, p, p, p, pf);
  };
  // cadence (quality spec M5): the clock steps at 1/120 s, but the ledger prints at 24 on ones, like a stop-motion
  // print run; and while nothing moves (the hold before the loop starts over) it does not redraw at all
  let shown = -1;
  const loop = (now) => {
    raf = 0; if (!playing || !visible) return;
    acc += last ? Math.min(0.1, (now - last) / 1000) : STEP; last = now;
    let n = 0; while (acc >= STEP && n < 24) { g.step(STEP); acc -= STEP; n++; }
    const t = g.time % g.period, frame = Math.floor(g.time * 24), writing = t < g.entries.length * g.options.stagger + g.options.maxLen / g.options.cellsPerSecond + 0.1;
    if (frame !== shown && (writing || t < 0.1)) { shown = frame; draw(); }
    raf = requestAnimationFrame(loop);
  };
  const go = () => { if (!raf && playing && visible) { last = 0; raf = requestAnimationFrame(loop); } };
  fit(); if (reduced) g.finish(); draw(); go();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; go(); }).observe(cv);
  if (playBtn) { playBtn.setAttribute('aria-pressed', String(playing)); playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.addEventListener('click', () => { playing = !playing; playBtn.setAttribute('aria-pressed', String(playing)); playBtn.textContent = playing ? 'Pause' : 'Play'; go(); }); }
  addEventListener('resize', () => { fit(); draw(); });
}

// A grey grain plate (mean mid-grey, so soft-light leaves the average tone alone), built once per canvas size.
function grainLayer(w, h, period) {
  const g = new Grain({ period, kind: 'paper', seed: 41 }), c = document.createElement('canvas'); c.width = w; c.height = h;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.round(128 + (g.at(x, y) - 0.5) * 90), i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  c.getContext('2d').putImageData(img, 0, 0);
  return c;
}

// The brand film's 49 shot lengths in frames at 23.976 fps, as measured in this study (frames/favourites_targeted.json).
const SHOTS = [42, 10, 19, 14, 22, 28, 15, 35, 18, 16, 9, 28, 11, 14, 18, 4, 7, 16, 67, 38, 170, 233, 47, 40, 20, 21, 102, 32, 17, 25, 92, 65, 174, 4, 5, 5, 12, 4, 29, 4, 15, 8, 6, 14, 21, 8, 15, 21, 248];

async function main() {
  await document.fonts.ready;
  await Promise.all([
    cloudWord(document.querySelector('.cloudword')).catch((e) => console.error('demo: cloud lettering failed', e)),
    heroPlate(document.querySelector('#hero-plate')).catch((e) => console.error('demo: hero plate failed', e)),
  ]);
  studio(document.querySelector('.studio').parentElement, { dpr, reduced });
  styles(document.querySelector('.styles')).catch((e) => console.error('demo: cloud styles failed', e));
  ledger(document.querySelector('#rods'), () => createLedger({ series: SHOTS.map((f) => Math.log(f)), cols: 18, rows: 18, maxLen: 4, stagger: 0.035 }), { cols: 18, rows: 18, playBtn: document.querySelector('#rods-play') });
  // the word: the lettering glyph's mask on the grid, and its own column ink as the series
  const word = await glyphFromText('TALLY', { size: 160, weight: 800, pad: 0.06 });
  const cols = 54, rows = Math.max(8, Math.round((cols * word.h) / word.w)), mask = maskFromCoverage(word.mask, word.w, word.h, cols, rows, 0.45);
  const wcv = document.querySelector('#rods-word'); wcv.parentElement.style.aspectRatio = `${cols + 2} / ${rows + 2}`;
  ledger(wcv, () => createLedger({ series: seriesFromMask(word.mask, word.w, word.h, cols), cols, rows, mask, maxLen: 3, stagger: 0.012 }), { cols, rows });
}
main().catch((e) => console.error('demo: start failed', e));
