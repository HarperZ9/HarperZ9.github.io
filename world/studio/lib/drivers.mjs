// drivers.mjs: any lane drives another. Each driver is a pure function from a source (text, a data series,
// code, a sound score or analysis, a rendered picture) to a drive: { core (overrides), image (plates, strokes,
// cells, dye, impulses), sound (grid, events) }. The cell numbers refer to the cross-modal matrix in
// ../../dataviz/FRAMEWORK.md section 2c.
import { stft } from '../../sound/sound/dsp.js';
import { normalize, fnv } from './schema.mjs';
import { motion } from './lanes/motion.mjs';

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const r3 = x => +x.toFixed(4);
const norm = xs => { const lo = Math.min(...xs), hi = Math.max(...xs); return xs.map(x => (hi > lo ? (x - lo) / (hi - lo) : 0.5)); };

export const DRIVERS = Object.freeze([
  { id: 'text', from: 'language', to: ['sound', 'image'], cells: [7, 9], recover: 'the word is the real text of the type lane' },
  { id: 'data-brush', from: 'numbers', to: ['image', 'sound'], cells: [13, 15], recover: 'stroke height and note pitch both follow the value; the series is in the material JSON' },
  { id: 'code-image', from: 'code', to: ['image', 'sound'], cells: [9, 7], recover: 'one cell and one event per character, in reading order' },
  { id: 'sound-paint', from: 'audio', to: ['image'], cells: [3], recover: 'one dab per onset, x is time, height is pitch' },
  { id: 'spectrum-light', from: 'audio', to: ['image'], cells: [3], recover: 'film thickness follows the spectral centroid' },
  { id: 'stroke-pitch', from: 'motion', to: ['sound'], cells: [25], recover: 'pitch follows the build speed of the motion curve' },
  { id: 'density-texture', from: 'image', to: ['sound'], cells: [19], recover: 'noise share and event density follow the picture\'s ink density' },
  { id: 'any-liquid', from: 'any', to: ['image', 'sound'], cells: [15, 13], recover: 'the payload is the dye; stirring energy sets the bubble rate' },
]);

// Language to sound and image: letters become a 16-step grid (bits of each character code), the word seeds both.
export function textDrive(text) {
  const s = String(text || ' '), seed = fnv(s) % 100000, grid = Array.from({ length: 16 }, (_, k) => (s.charCodeAt(k % s.length) >> (k >> 2 & 3)) & 1 ? true : k % 4 === 0);
  const vowels = (s.match(/[aeiou]/gi) ?? []).length / Math.max(1, s.length);
  return { seed, core: { durationS: r3(Math.min(8, 0.6 + 0.18 * s.length)) }, sound: { grid }, vowels: r3(vowels) };
}

// Numbers to brushstroke (and to sound): the series is one gesture across the sheet; height and pressure carry
// the value, a second thinner stroke traces the running mean. Each value is also a note in a pentatonic ladder.
export function dataBrush(series, material, { aspect = 0.625, seconds = null } = {}) {
  const m = normalize(material), v = series.map(Number).filter(Number.isFinite);
  if (v.length < 2) throw new RangeError('drivers: a data series needs at least two numbers');
  const n = norm(v), pts = n.map((y, i) => ({ x: 0.08 + 0.84 * (i / (n.length - 1)), y: aspect * (0.82 - 0.64 * y), p: 0.25 + 0.75 * y }));
  const mean = n.map((_, i) => n.slice(Math.max(0, i - 3), i + 4).reduce((a, b, _k, arr) => a + b / arr.length, 0));
  const meanPts = mean.map((y, i) => ({ x: pts[i].x, y: aspect * (0.82 - 0.64 * y) + 0.01, p: 0.35 }));
  const sec = seconds ?? Math.max(2, Math.min(8, v.length * 0.18)), dt = sec / v.length;
  const events = n.map((y, i) => ({ t: r3(i * dt), voice: 'pluck', role: 'datum', args: { note: Math.round(m.core.pitch) + PENTA[Math.round(y * (PENTA.length - 1))], dur: r3(Math.max(0.08, dt * 1.6)), vel: r3(0.25 + 0.3 * y), bright: 2400, type: 'sawtooth' } }));
  return { image: { plates: [{ kind: 'brush', opacity: 1, mode: 'normal' }], strokes: [{ pts, size: 2.2 }, { pts: meanPts, size: 0.7, color: m.palette.accent }] }, sound: { events }, series: v };
}

// Code to image (and sound): tokens by class, one glyph cell per character; keywords hot, numbers and strings mid.
const KW = /^(const|let|var|function|return|if|else|for|while|import|export|from|class|new|async|await|def|fn|pub|use|match)$/;
export function codeCells(code, { maxCols = 64, maxRows = 40 } = {}) {
  const lines = String(code).replace(/\t/g, '  ').split('\n').slice(0, maxRows), cols = Math.min(maxCols, Math.max(8, ...lines.map(l => l.length))), rows = Math.max(4, lines.length);
  const tone = new Float32Array(cols * rows), kind = new Uint8Array(cols * rows), events = [];
  lines.forEach((line, y) => {
    for (const mt of line.slice(0, cols).matchAll(/[A-Za-z_]\w*|\d+(\.\d+)?|"[^"]*"|'[^']*'|\S/g)) {
      const tok = mt[0], k = KW.test(tok) ? 2 : /^[\d"']/.test(tok) ? 3 : /\w/.test(tok) ? 1 : 4, t = { 1: 0.55, 2: 1, 3: 0.75, 4: 0.3 }[k];
      for (let i = 0; i < tok.length && mt.index + i < cols; i++) { tone[y * cols + mt.index + i] = t; kind[y * cols + mt.index + i] = k; }
      events.push({ y, x: mt.index, k });
    }
  });
  return { cols, rows, tone, kind, tokens: events };
}
export function codeDrive(code, material) {
  const m = normalize(material), cells = codeCells(code), s = 60 / m.core.tempo / 4;
  const events = cells.tokens.slice(0, 96).map((tk, i) => tk.k === 4
    ? { t: r3(i * s), voice: 'hat', role: 'punct', args: { vel: 0.25 } }
    : { t: r3(i * s), voice: tk.k === 2 ? 'bell' : 'pluck', role: 'token', args: tk.k === 2 ? { note: Math.round(m.core.pitch) + 12, dur: 0.4, vel: 0.22, ratio: 3.5, index: 200 } : { note: Math.round(m.core.pitch) + PENTA[(tk.x + tk.y) % PENTA.length], dur: 0.12, vel: 0.28, bright: 3000, type: 'square' } });
  return { image: { plates: [{ kind: 'codecells', opacity: 1, mode: 'normal' }], cells }, sound: { events } };
}

// Sound to paint: each onset of a score (or of an analysed buffer) becomes a short brush gesture; x is time,
// height is pitch (or spectral centroid), pressure is loudness.
export function soundPaint(onsets, { seconds, pitches = null, levels = null, aspect = 0.625, seed = 1 } = {}) {
  const strokes = onsets.map((t, i) => {
    const x = 0.06 + 0.88 * (t / seconds), y = aspect * (0.85 - 0.7 * (pitches ? pitches[i] : ((i * 7919 + seed) % 97) / 97)), p = levels ? levels[i] : 0.8, len = 0.025 + 0.04 * p;
    return { pts: [{ x, y, p: 0.3 }, { x: x + len * 0.5, y: y - len * 0.35, p }, { x: x + len, y: y - len * 0.1, p: 0.2 }], size: 0.8 + 1.4 * p };
  });
  return { image: { plates: [{ kind: 'brush', opacity: 1, mode: 'normal' }], strokes } };
}
// Pitches and loudness for a score's onsets (from its events), so painting a score needs no audio render.
export function scoreFeatures(sc) {
  const by = new Map();
  for (const e of sc.events) if (sc.onsets.includes(e.t)) { const p = e.args.note ?? (e.voice === 'noise' ? 96 : e.voice === 'bubble' ? 84 : 48), v = e.args.vel ?? 0.5, o = by.get(e.t); if (!o || v > o.v) by.set(e.t, { p, v }); }
  const ps = sc.onsets.map(t => by.get(t)?.p ?? 60), vs = sc.onsets.map(t => by.get(t)?.v ?? 0.5), pn = norm(ps), vmax = Math.max(...vs, 1e-6);
  return { pitches: pn, levels: vs.map(v => v / vmax) };
}

// Audio analysis (browser or node): onsets by spectral flux, centroid per frame. x is mono Float32Array.
export function analyse(x, sr, { n = 1024, hop = 512 } = {}) {
  const S = stft(x, sr, { n, hop, floorDb: -100 }), cent = [], flux = [];
  let prev = null;
  for (const f of S.frames) {
    let num = 0, den = 0, fl = 0;
    for (let b = 1; b < S.bins; b++) { const a = 10 ** (f[b] / 20); num += a * b * S.binHz; den += a; if (prev) fl += Math.max(0, f[b] - prev[b]); }
    cent.push(den ? num / den : 0); flux.push(fl / S.bins); prev = f;
  }
  // a frame's time is its window centre
  const mu = flux.reduce((a, b) => a + b, 0) / Math.max(1, flux.length), onsets = [], half = n / 2 / sr;
  for (let i = 1; i < flux.length - 1; i++) if (flux[i] > mu * 2.2 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && (!onsets.length || i * S.hopSec + half - onsets.at(-1) > 0.05)) onsets.push(+(i * S.hopSec + half).toFixed(4));
  return { onsets, centroid: cent, hopSec: S.hopSec, seconds: x.length / sr };
}

// Spectrum to light: the centroid sets the film's thickness range and the sheen (bright sounds, thin film, more sheen).
export function spectrumLight(centroidHz) {
  const c = centroidHz.filter(v => v > 0), mean = c.length ? c.reduce((a, b) => a + b, 0) / c.length : 1000, k = Math.min(1, Math.log2(Math.max(100, mean) / 100) / 7);
  return { core: { sheen: r3(0.3 + 0.7 * k), filmMinNm: Math.round(500 - 300 * k), filmMaxNm: Math.round(900 - 250 * k) }, image: { plates: [{ kind: 'film', mode: 'screen', opacity: 0.85 }] } };
}

// Motion to sound: the build's speed along its curve becomes pitch, one note per held drawing.
export function strokePitch(material) {
  const m = normalize(material), mo = motion(m), frames = Math.max(4, Math.round(mo.durationS * mo.boilHz)), sp = [];
  for (let i = 0; i < frames; i++) sp.push(mo.speed(i / (frames - 1)));
  const s = norm(sp), events = s.map((v, i) => ({ t: r3(i * mo.hold), voice: 'pluck', role: 'stroke', args: { note: Math.round(m.core.pitch) + PENTA[Math.round(v * (PENTA.length - 1))], dur: r3(mo.hold * 1.5), vel: r3(0.15 + 0.3 * v), bright: 2000, type: 'sawtooth' } }));
  return { sound: { events } };
}

// Picture to sound: ink density (share of dark pixels) and edge energy set noise share, particle density, brightness.
export function densityTexture(rgba, w, h) {
  let dark = 0, edge = 0;
  for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) { const i = 4 * (y * w + x), l = rgba[i + 1], l0 = rgba[i - 3]; if (l < 96) dark++; edge += Math.abs(l - l0); }
  const d = dark / (w * h), e = Math.min(1, edge / (w * h) / 40);
  return { core: { noise: r3(0.1 + 0.8 * e), particles: r3(Math.min(1, 0.1 + 1.4 * d)), brightness: r3(0.2 + 0.7 * e) }, density: r3(d), edges: r3(e) };
}

// Anything to liquid: the payload becomes dye (a mask), and its rhythm becomes impulses that stir it.
export function anyLiquid({ mask = null, series = null, onsets = null, seconds = 4 } = {}) {
  const impulses = [];
  if (series) norm(series).forEach((v, i, a) => impulses.push({ x: (i + 0.5) / a.length, y: 1 - v, vx: 0, vy: -30 * v, r: 5 }));
  if (onsets) onsets.forEach((t, i) => impulses.push({ x: Math.min(0.95, t / seconds), y: 0.5 + 0.3 * Math.sin(i), vx: 20, vy: 10 * Math.cos(i), r: 4 }));
  return { image: { plates: [{ kind: 'liquid', opacity: 1, mode: 'normal' }], dye: mask?.data ?? null, impulses } };
}

// Merge drives into one: later drives add plates, strokes and events; core overrides apply in order.
export function mergeDrives(...ds) {
  const out = { core: {}, image: { plates: [] }, sound: { events: [] } };
  for (const d of ds.filter(Boolean)) {
    Object.assign(out.core, d.core ?? {});
    if (d.image) { const { plates = [], ...rest } = d.image; out.image.plates.push(...plates); Object.assign(out.image, rest); }
    if (d.sound) { const { events = [], ...rest } = d.sound; out.sound.events.push(...events); Object.assign(out.sound, rest); }
  }
  return out;
}
// Apply a drive's core overrides to a material.
export const driven = (material, d) => normalize({ ...normalize(material), core: { ...normalize(material).core, ...(d?.core ?? {}) } });
