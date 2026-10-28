// lib/adapters.mjs: type-checked adapters between property types, and the router that chains them.
//
// An adapter is { from, to, cost, doc, run(value, ctx) }. Its input and output are checked against lib/props.mjs
// on every call, so a wrong shape stops at the edge that made it. route(from, to) finds the cheapest chain
// (Dijkstra over the adapter graph); convert(value, to, ctx) runs it. These are the walls the panel removes: sound
// reaches a stroke, data reaches a surface, a glyph's coverage reaches a spectrum.
import { PROPS, make, checkProp } from './props.mjs';
import { edt, fromMask, normalAt } from '../../glass/lib/body.js';
import { opticsField } from '../../glass/glass.js';
import { bitmap, synth } from '../../lettering/lib/techniques/sound.mjs';
import { stft } from '../../sound/sound/dsp.js';
import { rngFrom } from '../../superframe/lib/seed.mjs';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

function sdfOf(cov) {
  const { w, h, data } = cov, inside = new Uint8Array(w * h), outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { inside[i] = data[i] >= 0.5 ? 1 : 0; outside[i] = 1 - inside[i]; }
  const din = edt(inside, w, h), dout = edt(outside, w, h), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = inside[i] ? 0.5 - din[i] : dout[i] - 0.5;
  return make.sdf(w, h, out);
}

// Rasterise round-capped strokes: coverage is 1 within width/2 of the centre line, antialiased over one px.
function strokesToCoverage(S) {
  const { w, h } = S, out = new Float32Array(w * h);
  for (const s of S.strokes) {
    const r = s.width / 2, P = s.pts, segs = s.closed && P.length > 2 ? [...P.keys()].map((i) => [P[i], P[(i + 1) % P.length]]) : P.slice(1).map((p, i) => [P[i], p]);
    if (P.length === 1) segs.push([P[0], P[0]]);
    for (const [a, b] of segs) {
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 1)), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0]) + r + 1));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 1)), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1]) + r + 1));
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - a[0], py = y + 0.5 - a[1], t = clamp((px * dx + py * dy) / L2);
        const d = Math.hypot(px - t * dx, py - t * dy), c = clamp(r - d + 0.5), i = y * w + x;
        if (c > out[i]) out[i] = c;
      }
    }
  }
  return make.coverage(w, h, out);
}

function cellsOf(cov, cell = 8) {
  const { w, h, data } = cov, cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let s = 0, n = 0;
    for (let y = r * cell; y < Math.min(h, (r + 1) * cell); y++) for (let x = c * cell; x < Math.min(w, (c + 1) * cell); x++) { s += data[y * w + x]; n++; }
    out[r * cols + c] = n ? s / n : 0;
  }
  return make.cells(w, h, cell, cols, rows, out);
}

function cellsToParticles(C) {
  const xs = [], ys = [], size = [], tone = [];
  for (let r = 0; r < C.rows; r++) for (let c = 0; c < C.cols; c++) {
    const v = C.data[r * C.cols + c]; if (v < 0.04) continue;
    xs.push((c + 0.5) * C.cell); ys.push((r + 0.5) * C.cell); size.push(C.cell * 0.5 * Math.sqrt(v)); tone.push(v);
  }
  return make.particles(C.w, C.h, Float32Array.from(xs), Float32Array.from(ys), { size: Float32Array.from(size), tone: Float32Array.from(tone) });
}

// Seeded stipple: rejection sampling against coverage, n grains per 1000 px of ink.
function stipple(cov, { seed = 'stipple', density = 40, radius = 1.2 } = {}) {
  const { w, h, data } = cov, r = rngFrom(seed); let ink = 0; for (const v of data) ink += v;
  const target = Math.round((ink / 1000) * density), xs = [], ys = [];
  for (let tries = 0; xs.length < target && tries < target * 30; tries++) {
    const x = r() * w, y = r() * h; if (r() < data[(y | 0) * w + (x | 0)]) { xs.push(x); ys.push(y); }
  }
  return make.particles(w, h, Float32Array.from(xs), Float32Array.from(ys), { size: new Float32Array(xs.length).fill(radius) });
}

function particlesToCoverage(P) {
  const { w, h } = P, out = new Float32Array(w * h);
  for (let k = 0; k < P.n; k++) {
    const R = P.size ? P.size[k] : 1, cx = P.x[k], cy = P.y[k];
    for (let y = Math.max(0, Math.floor(cy - R - 1)); y <= Math.min(h - 1, Math.ceil(cy + R + 1)); y++) for (let x = Math.max(0, Math.floor(cx - R - 1)); x <= Math.min(w - 1, Math.ceil(cx + R + 1)); x++) {
      const c = clamp(R - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5), i = y * w + x; if (c > out[i]) out[i] = c;
    }
  }
  return make.coverage(w, h, out);
}

// Plexus: each node joined to its nearest neighbours within reach (grid-bucketed, so it stays near linear).
function plexus(P, { k = 2, reach = 18 } = {}) {
  const nodes = [...Array(P.n).keys()].map((i) => [P.x[i], P.y[i]]), edges = [], B = new Map(), key = (x, y) => `${Math.floor(x / reach)},${Math.floor(y / reach)}`;
  nodes.forEach(([x, y], i) => { const kk = key(x, y); if (!B.has(kk)) B.set(kk, []); B.get(kk).push(i); });
  nodes.forEach(([x, y], i) => {
    const near = [], bx = Math.floor(x / reach), by = Math.floor(y / reach);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const j of B.get(`${bx + dx},${by + dy}`) ?? []) if (j > i) { const d = Math.hypot(nodes[j][0] - x, nodes[j][1] - y); if (d < reach) near.push([d, j]); }
    near.sort((a, b) => a[0] - b[0]); for (const [, j] of near.slice(0, k)) edges.push([i, j]);
  });
  return make.graph(P.w, P.h, nodes, edges);
}

function spectrumOf(cov, { rows = 48 } = {}) {
  const { w, h, data } = cov; let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x] > 0.1) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) { x0 = 0; x1 = w - 1; y0 = 0; y1 = h - 1; }
  const bm = bitmap({ w, h, mask: data, bbox: { x0, x1, y0, y1 } }, rows), cols = bm[0].length, out = new Float32Array(rows * cols);
  bm.forEach((row, r) => out.set(row, r * cols));
  return make.spectrum(rows, cols, out);
}

function spectrumToPcm(S, ctx) {
  const bm = []; for (let r = 0; r < S.rows; r++) bm.push(S.data.subarray(r * S.cols, (r + 1) * S.cols));
  const sig = synth(bm, { fLow: S.fLow, fHigh: S.fHigh, colSec: S.colSec, seed: (ctx.seedInt ?? 19) % 101 });
  return make.pcm(sig.sr, [sig.x]);
}

function pcmToSpectrum(A, { rows = 48, fLow = 600, fHigh = 7000 } = {}) {
  const S = stft(A.channels[0], A.rate, { n: 512, hop: 128 }), cols = S.frames.length, out = new Float32Array(rows * Math.max(2, cols));
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const f = fHigh - ((fHigh - fLow) * r) / (rows - 1), b = Math.min(S.bins - 1, Math.round(f / S.binHz)); out[r * cols + c] = clamp((S.frames[c][b] + 80) / 60); }
  return make.spectrum(rows, Math.max(2, cols), out, { fLow, fHigh, colSec: S.hopSec });
}

// Onsets by positive spectral flux, peaks above the running mean.
function onsetsOf(S) {
  const flux = new Float64Array(S.cols);
  for (let c = 1; c < S.cols; c++) { let f = 0; for (let r = 0; r < S.rows; r++) f += Math.max(0, S.data[r * S.cols + c] - S.data[r * S.cols + c - 1]); flux[c] = f; }
  const mx = Math.max(1e-9, ...flux), t = [], s = [];
  for (let c = 1; c + 1 < S.cols; c++) if (flux[c] > flux[c - 1] && flux[c] >= flux[c + 1] && flux[c] > 0.25 * mx) { t.push(c * S.colSec); s.push(flux[c] / mx); }
  return make.onsets(Math.max(S.colSec, S.cols * S.colSec), t, s);
}

const norm = (y) => { let lo = Infinity, hi = -Infinity; for (const v of y) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return (v) => (hi > lo ? (v - lo) / (hi - lo) : 0.5); };

export const ADAPTERS = [
  { from: 'coverage', to: 'field.sdf', cost: 2, doc: 'exact Euclidean distance both sides of the 0.5 edge', run: sdfOf },
  { from: 'field.sdf', to: 'coverage', cost: 1, doc: 'one-pixel antialiased edge', run: (S) => make.coverage(S.w, S.h, S.data.map((d) => clamp(0.5 - d))) },
  { from: 'coverage', to: 'field.scalar', cost: 1, doc: 'coverage read as tone', run: (C) => make.scalar(C.w, C.h, Float32Array.from(C.data)) },
  { from: 'field.scalar', to: 'coverage', cost: 1, doc: 'tone read as coverage', run: (F) => make.coverage(F.w, F.h, F.data.map((v) => clamp(v))) },
  { from: 'coverage', to: 'surface.height', cost: 3, doc: 'a rounded bevel (glass body)', run: (C, ctx) => make.height(C.w, C.h, fromMask(C.data, C.w, C.h, { radius: ctx.radius ?? 10, thickness: ctx.thickness ?? 24 }).height) },
  { from: 'surface.height', to: 'surface.normal', cost: 1, doc: 'central differences', run: (H) => { const out = new Float32Array(H.w * H.h * 3), b = { w: H.w, h: H.h, height: H.data }; for (let y = 0, i = 0; y < H.h; y++) for (let x = 0; x < H.w; x++, i++) out.set(normalAt(b, x, y), i * 3); return make.normal(H.w, H.h, out); } },
  { from: 'surface.height', to: 'light.dispersion', cost: 4, doc: 'slab refraction per channel (glass optics, Cauchy dispersion)', run: (H, ctx) => { const mask = H.data.map((v) => (v > 0 ? 1 : 0)), f = opticsField({ w: H.w, h: H.h, mask, height: H.data }, { glass: ctx.glass ?? 'flint', spread: ctx.spread ?? 1.6, gap: ctx.gap ?? 80 }); return make.dispersion(H.w, H.h, f.off); } },
  { from: 'light.dispersion', to: 'light.refraction', cost: 1, doc: 'the green channel', run: (D) => { const o = new Float32Array(D.w * D.h * 2); for (let i = 0; i < D.w * D.h; i++) { o[i * 2] = D.data[i * 6 + 2]; o[i * 2 + 1] = D.data[i * 6 + 3]; } return make.refraction(D.w, D.h, o); } },
  { from: 'structure.strokes', to: 'coverage', cost: 2, doc: 'round-capped strokes', run: strokesToCoverage },
  { from: 'coverage', to: 'structure.cells', cost: 1, doc: 'mean coverage per cell', run: (C, ctx) => cellsOf(C, ctx.cell ?? 8) },
  { from: 'structure.cells', to: 'structure.particles', cost: 1, doc: 'one dot per cell, area by coverage', run: cellsToParticles },
  { from: 'coverage', to: 'structure.particles', cost: 2, doc: 'seeded stipple', run: (C, ctx) => stipple(C, { seed: `${ctx.seed ?? 'st'}`, density: ctx.density ?? 40 }) },
  { from: 'structure.particles', to: 'coverage', cost: 2, doc: 'discs', run: particlesToCoverage },
  { from: 'structure.particles', to: 'structure.graph', cost: 2, doc: 'plexus by nearest neighbours', run: (P, ctx) => plexus(P, ctx) },
  { from: 'structure.graph', to: 'structure.strokes', cost: 1, doc: 'each edge a hairline', run: (G, ctx) => make.strokes(G.w, G.h, G.edges.map(([i, j]) => ({ pts: [G.nodes[i], G.nodes[j]], width: ctx.width ?? 0.8 }))) },
  { from: 'coverage', to: 'sound.spectrum', cost: 2, doc: 'the letter bitmap as a spectrogram', run: (C, ctx) => spectrumOf(C, ctx) },
  { from: 'sound.spectrum', to: 'sound.pcm', cost: 3, doc: 'additive spectrographic synthesis', run: spectrumToPcm },
  { from: 'sound.pcm', to: 'sound.spectrum', cost: 3, doc: 'short-time Fourier transform', run: (A, ctx) => pcmToSpectrum(A, ctx) },
  { from: 'sound.spectrum', to: 'sound.onsets', cost: 1, doc: 'positive spectral flux peaks', run: onsetsOf },
  { from: 'sound.spectrum', to: 'field.scalar', cost: 1, doc: 'the spectrogram stretched over the frame', run: (S, ctx) => { const w = ctx.w, h = ctx.h, o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = S.data[Math.min(S.rows - 1, (y * S.rows / h) | 0) * S.cols + Math.min(S.cols - 1, (x * S.cols / w) | 0)]; return make.scalar(w, h, o); } },
  { from: 'sound.onsets', to: 'data.series', cost: 1, doc: 'onset strength per 1/16 of the duration', run: (O) => { const y = new Float64Array(16); O.t.forEach((t, i) => { y[Math.min(15, (t / O.duration * 16) | 0)] += O.s[i]; }); return make.series(y, { label: 'onsets', unit: 'strength' }); } },
  { from: 'data.series', to: 'field.scalar', cost: 1, doc: 'the series as a column profile (each column the value at its x)', run: (S, ctx) => { const w = ctx.w, h = ctx.h, n = norm(S.y), o = new Float32Array(w * h); for (let x = 0; x < w; x++) { const u = x / Math.max(1, w - 1) * (S.y.length - 1), i = Math.floor(u), f = u - i, v = n(S.y[i]) * (1 - f) + n(S.y[Math.min(S.y.length - 1, i + 1)]) * f; for (let y = 0; y < h; y++) o[y * w + x] = v; } return make.scalar(w, h, o); } },
  { from: 'data.series', to: 'sound.onsets', cost: 1, doc: 'one onset per value, strength by value', run: (S) => { const n = norm(S.y), t = [], s = []; S.y.forEach((v, i) => { t.push(i * 0.25); s.push(n(v)); }); return make.onsets(S.y.length * 0.25, t, s); } },
  { from: 'sound.pcm', to: 'data.series', cost: 1, doc: 'RMS loudness in 64 windows (the envelope)', run: (A) => { const x = A.channels[0], n = 64, L = Math.max(1, Math.floor(x.length / n)), y = new Float64Array(n); for (let k = 0; k < n; k++) { let s = 0; for (let i = k * L; i < Math.min(x.length, (k + 1) * L); i++) s += x[i] * x[i]; y[k] = Math.sqrt(s / L); } return make.series(y, { label: 'loudness', unit: 'rms' }); } },
  { from: 'data.values', to: 'data.series', cost: 1, doc: 'values in key order', run: (V) => make.series(Object.values(V.values), { label: Object.keys(V.values).join(' ') }) },
  { from: 'field.sdf', to: 'motion.velocity', cost: 2, doc: 'flow along the iso lines (the gradient turned 90 degrees)', run: (S, ctx) => { const { w, h, data: D } = S, o = new Float32Array(w * h * 2), sp = ctx.speed ?? 30; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, gx = (D[i + 1] - D[i - 1]) / 2, gy = (D[i + w] - D[i - w]) / 2, l = Math.hypot(gx, gy) || 1; o[i * 2] = -gy / l * sp; o[i * 2 + 1] = gx / l * sp; } return make.velocity(w, h, o); } },
  { from: 'field.sdf', to: 'motion.phase', cost: 1, doc: 'phase by distance from the edge, one cycle per period px', run: (S, ctx) => { const p = ctx.period ?? 24; return make.phase(S.w, S.h, S.data.map((d) => ((d / p) % 1 + 1) % 1)); } },
  { from: 'surface.albedo', to: 'light.emission', cost: 1, doc: 'a lit panel: reflected colour as emitted light', run: (A, ctx) => { const k = ctx.gain ?? 1; return make.emission(A.w, A.h, A.data.map((v, i) => ((i & 3) === 3 ? v : v * k))); } },
  { from: 'light.emission', to: 'surface.albedo', cost: 1, doc: 'Reinhard tonemap to a surface', run: (E) => make.albedo(E.w, E.h, E.data.map((v, i) => ((i & 3) === 3 ? v : v / (1 + v)))) },
  { from: 'surface.albedo', to: 'coverage', cost: 1, doc: 'alpha', run: (A) => { const o = new Float32Array(A.w * A.h); for (let i = 0; i < o.length; i++) o[i] = A.data[i * 4 + 3]; return make.coverage(A.w, A.h, o); } },
];

function checked(a) {
  return (value, ctx = {}) => {
    const ei = checkProp(a.from, value); if (ei) throw new TypeError(`adapter ${a.from} -> ${a.to}: input: ${ei}`);
    const out = a.run(value, ctx), eo = checkProp(a.to, out); if (eo) throw new TypeError(`adapter ${a.from} -> ${a.to}: output: ${eo}`);
    return out;
  };
}
for (const a of ADAPTERS) {
  if (!PROPS[a.from] || !PROPS[a.to]) throw new Error(`adapters: unknown property in ${a.from} -> ${a.to}`);
  if (PROPS[a.from].dataOnly || PROPS[a.to].dataOnly) throw new Error('adapters: provenance is data only and never converts');
  a.call = checked(a);
}

/** The cheapest chain of adapters from one property type to another, or null when none exists. */
export function route(from, to) {
  if (from === to) return [];
  const dist = new Map([[from, 0]]), prev = new Map(), open = new Set([from]);
  while (open.size) {
    let u = null; for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n;
    open.delete(u); if (u === to) break;
    for (const a of ADAPTERS) if (a.from === u) { const d = dist.get(u) + a.cost; if (!(dist.get(a.to) <= d)) { dist.set(a.to, d); prev.set(a.to, a); open.add(a.to); } }
  }
  if (!prev.has(to)) return null;
  const chain = []; for (let n = to; n !== from; n = prev.get(n).from) chain.unshift(prev.get(n));
  return chain;
}

/** Convert a tagged value to another property type through the cheapest chain. */
export function convert(value, to, ctx = {}) {
  const from = value?.prop; if (!from) throw new TypeError('convert: value has no prop tag (build it with make.*)');
  const chain = route(from, to); if (!chain) throw new TypeError(`convert: no route from ${from} to ${to}`);
  return chain.reduce((v, a) => a.call(v, { w: value.w, h: value.h, ...ctx }), value);
}

/** Every property type reachable from `from`, with the chain length. */
export function reachable(from) {
  return Object.keys(PROPS).filter((p) => p !== from && route(from, p)).map((p) => ({ to: p, steps: route(from, p).length }));
}
