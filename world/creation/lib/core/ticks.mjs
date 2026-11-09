// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ticks.mjs: THE tick model (BLEED sections 11 to 15). One module for every caller; it merges the two earlier ones:
//   - superframe/lib/medium/ticks.mjs: ticks as points that ride a flow, a weight vector over N elements,
//     each element's own law (radius, threshold, softness, rate, mode lenia | life | global) driven locally by
//     motion (distance travelled, speed, contact, heat, age)
//   - universe/lib/ticks.mjs: thick ink holds out (the threshold rises with thickness), flip times
//     computed once so a transfer is reversible in t, and the crossfade false-success control with its checks
// What is kept from each, and why: live stepping and N elements (the medium's) because motion must drive the flip
// as it happens; thickness delay and the scheduled, reversible form (the universe's) because a page transition must
// walk back; the checks (the universe's) because they make the section 13 claim testable. Self-contained: no
// imports, so the medium and the universe can import it without a cycle.
//
//   const T = tickField({ w, h, elements: [ {name}, {name, law} ], thickness, seeds, spacing })
//   stepTicks(T, dt, { u, v, drive })    live: move, then grow each element's weight by its law
//   rasterTicks(T, e, out)              element e's weight splatted to the w x h grid
//   measureTicks(T, e, prev)            { mean, spread, front, frontAt, change, snapshot } (section 13 numbers)
//   scheduleFront(w, h, opts)           flip time tau per cell (scheduled form); weightAt(tau, k, t, width)
//   transferChecks(series)              the universe checks: peak spread >= 0.25, largest one-frame mean change
//                                       <= 0.2, settles; a crossfade (mode 'global') must fail them
// Law: { radius, threshold, softness, rate, mode, ring, thick, drive: { thin, travel, speed, contact, heat, age } }
// thick: how much a tick's thickness raises its threshold (the universe's "paint dries from the thin parts inward").

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function rng(seed) { let s = (typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261)) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

export function tickField({ w, h, elements, thickness = null, seeds = [], seedRadius = 2.5, spacing = 1, start = 0, seed = 'ticks', jitter = 0.8 } = {}) {
  const r = rng(seed), xs = [], ys = [], hs = [];
  for (let y = 0; y < h; y += spacing) for (let x = 0; x < w; x += spacing) {
    const jx = x + 0.5 + (r() - 0.5) * spacing * jitter, jy = y + 0.5 + (r() - 0.5) * spacing * jitter, t = thickness ? thickness[clamp(Math.floor(jy), 0, h - 1) * w + clamp(Math.floor(jx), 0, w - 1)] : 1;
    if (t > 0.02) { xs.push(jx); ys.push(jy); hs.push(t); }
  }
  const n = xs.length, E = elements.length, W = new Float32Array(n * E);
  for (let i = 0; i < n; i++) W[i * E + start] = 1;
  const T = { w, h, n, E, elements, x: Float32Array.from(xs), y: Float32Array.from(ys), th: Float32Array.from(hs), W, travel: new Float32Array(n), speed: new Float32Array(n), born: 0, time: 0, clock: new Float32Array(n * E), spacing };
  for (const [sx, sy, e = 1] of seeds) for (let i = 0; i < n; i++) if (Math.hypot(T.x[i] - sx * w, T.y[i] - sy * h) < seedRadius) { for (let q = 0; q < E; q++) W[i * E + q] = 0; W[i * E + e] = 1; }
  return T;
}

const bil = (f, w, h, x, y) => { x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001); const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * w + i; return (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + w] * (1 - a) + f[k + w + 1] * a) * b; };

// cell lists: tick indices binned by cell of size c (counting sort, typed arrays)
function bins(T, c) {
  const gw = Math.ceil(T.w / c) + 1, gh = Math.ceil(T.h / c) + 1, count = new Int32Array(gw * gh + 1), idx = new Int32Array(T.n), cell = new Int32Array(T.n);
  for (let i = 0; i < T.n; i++) { const g = clamp(Math.floor(T.y[i] / c), 0, gh - 1) * gw + clamp(Math.floor(T.x[i] / c), 0, gw - 1); cell[i] = g; count[g + 1]++; }
  for (let g = 0; g < gw * gh; g++) count[g + 1] += count[g];
  const fill = count.slice(0, gw * gh); for (let i = 0; i < T.n; i++) idx[fill[cell[i]]++] = i;
  return { gw, gh, count, idx, c };
}

export function stepTicks(T, dt, { u = null, v = null, drive = null, still = !u } = {}) {
  const s = dt * 30;
  if (!still) for (let i = 0; i < T.n; i++) {
    const u1 = bil(u, T.w, T.h, T.x[i], T.y[i]), v1 = bil(v, T.w, T.h, T.x[i], T.y[i]), mx = T.x[i] + 0.5 * s * u1, my = T.y[i] + 0.5 * s * v1;
    const ux = bil(u, T.w, T.h, mx, my), vy = bil(v, T.w, T.h, mx, my);
    T.x[i] = clamp(T.x[i] + s * ux, 0, T.w - 0.01); T.y[i] = clamp(T.y[i] + s * vy, 0, T.h - 0.01);
    T.speed[i] = Math.hypot(ux, vy); T.travel[i] += T.speed[i] * s;
  }
  for (let e = 1; e < T.E; e++) if (T.elements[e].law) grow(T, e, T.elements[e].law, dt, drive);
  for (let i = 0; i < T.n; i++) for (let e = 0; e < T.E; e++) if (T.W[i * T.E + e] > 0.01) T.clock[i * T.E + e] += dt;
  T.time += dt;
}

function grow(T, e, L, dt, drive) {
  const R = L.radius ?? 1.6, B = bins(T, R), E = T.E, next = new Float32Array(T.n), D = L.drive ?? {};
  for (let i = 0; i < T.n; i++) {
    let S = 0, K = 0; const gi = Math.floor(T.x[i] / R), gj = Math.floor(T.y[i] / R);
    if (L.neighbours !== false) for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const x = gi + a, y = gj + b; if (x < 0 || y < 0 || x >= B.gw || y >= B.gh) continue; const g = y * B.gw + x;
      for (let q = B.count[g]; q < B.count[g + 1]; q++) { const o = B.idx[q]; if (o === i) continue; const d = Math.hypot(T.x[o] - T.x[i], T.y[o] - T.y[i]) / R; if (d > 1) continue; const kw = L.ring ? Math.exp(-(((d - 0.5) / 0.15) ** 2)) : 1 - d * d; S += kw * T.W[o * E + e]; K += kw; }
    }
    S = K > 0 ? S / K : 0;
    const heat = drive ? bil(drive, T.w, T.h, T.x[i], T.y[i]) : 0, floor = T.h - T.y[i] < 1.5 ? 1 : 0;
    const dr = (D.thin ?? 0) * (1 - T.th[i]) + (D.travel ?? 0) * Math.min(1, T.travel[i] / (D.travelScale ?? 40)) + (D.speed ?? 0) * Math.min(1, T.speed[i] / 0.5) + (D.contact ?? 0) * floor + (D.heat ?? 0) * clamp(heat, 0, 1) + (D.age ?? 0) * Math.min(1, T.time / (D.ageScale ?? 6));
    const x = S + dr - (L.threshold ?? 0.5) - (L.thick ?? 0) * T.th[i], rate = (L.rate ?? 1) * dt;
    let w = T.W[i * E + e];
    if (L.mode === 'global') w = clamp(w + rate, 0, 1);
    else if (L.mode === 'life') { if (x > 0) w = 1; }
    else w = clamp(w + rate * Math.tanh(x / (L.softness ?? 0.08)), 0, 1);
    next[i] = w;
  }
  for (let i = 0; i < T.n; i++) {
    const gain = next[i] - T.W[i * E + e]; if (Math.abs(gain) < 1e-7) continue;
    T.W[i * E + e] = next[i]; let take = gain;
    for (let f = e - 1; f >= 0 && take > 0; f--) { const q = Math.min(T.W[i * E + f], take); T.W[i * E + f] -= q; take -= q; }
    if (gain < 0) T.W[i * E + e - 1] -= gain;
  }
}

// element e's weight on the grid: bilinear splat normalised by the splat weight
export function rasterTicks(T, e, out = new Float32Array(T.w * T.h), cnt = new Float32Array(T.w * T.h)) {
  out.fill(0); cnt.fill(0); const { w, h } = T;
  for (let i = 0; i < T.n; i++) {
    const x = clamp(T.x[i] - 0.5, 0, w - 1.001), y = clamp(T.y[i] - 0.5, 0, h - 1.001), a0 = x | 0, b0 = y | 0, a = x - a0, b = y - b0, wt = T.W[i * T.E + e];
    const k = b0 * w + a0, f00 = (1 - a) * (1 - b), f10 = a * (1 - b), f01 = (1 - a) * b, f11 = a * b;
    out[k] += f00 * wt; cnt[k] += f00; out[k + 1] += f10 * wt; cnt[k + 1] += f10; out[k + w] += f01 * wt; cnt[k + w] += f01; out[k + w + 1] += f11 * wt; cnt[k + w + 1] += f11;
  }
  for (let k = 0; k < out.length; k++) out[k] = cnt[k] > 1e-6 ? out[k] / cnt[k] : 0;
  return out;
}

export function measureTicks(T, e = 1, prev = null) {
  let s = 0, s2 = 0, front = 0, fx = 0, fy = 0, d = 0;
  for (let i = 0; i < T.n; i++) { const w = T.W[i * T.E + e]; s += w; s2 += w * w; if (w > 0.15 && w < 0.85) { front++; fx += T.x[i]; fy += T.y[i]; } if (prev) d += Math.abs(w - prev[i]); }
  const mean = s / T.n;
  return { mean, spread: Math.sqrt(Math.max(0, s2 / T.n - mean * mean)), front: front / T.n, frontAt: front ? [fx / front, fy / front] : null, change: prev ? d / T.n : 0, snapshot: Float32Array.from({ length: T.n }, (_, i) => T.W[i * T.E + e]) };
}

// The scheduled form (after the universe module): flip time per cell from a threshold automaton grown once from a
// seed edge or point; thick cells hold out. weightAt depends only on t, so walking back reverses the transfer.
export function scheduleFront(w, h, { thickness = null, seedEdge = 'left', seedAt = null, seed = 1, span = 0.72, maxSteps = 800 } = {}) {
  const n = w * h, on = new Uint8Array(n), step = new Int32Array(n).fill(-1), r = rng(seed), th = k => (thickness ? thickness[k] : 0.5);
  const seedCell = k => { on[k] = 1; step[k] = 0; };
  if (seedAt) { const [si, sj] = seedAt; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = si + di, j = sj + dj; if (i >= 0 && j >= 0 && i < w && j < h) seedCell(j * w + i); } }
  else for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const edge = seedEdge === 'bottom' ? j === h - 1 : seedEdge === 'top' ? j === 0 : seedEdge === 'left' ? i === 0 : i === w - 1; if (edge && r() < 0.35) seedCell(j * w + i); }
  const NB = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 0.7], [1, -1, 0.7], [-1, 1, 0.7], [1, 1, 0.7]];
  let s = 0, left = n - on.reduce((a, b) => a + b, 0);
  while (left > 0 && s < maxSteps) {
    s++; const flip = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i; if (on[k]) continue; let sum = 0;
      for (const [dx, dy, wt] of NB) { const x = i + dx, y = j + dy; if (x >= 0 && y >= 0 && x < w && y < h && on[y * w + x]) sum += wt; }
      if (sum >= 1.4 + 2.2 * th(k) || (sum > 0 && r() < 0.04 * sum)) flip.push(k);
    }
    for (const k of flip) { on[k] = 1; step[k] = s; } left -= flip.length; if (!flip.length && left) { for (let k = 0; k < n; k++) if (!on[k]) { on[k] = 1; step[k] = s; } left = 0; }
  }
  const tau = new Float32Array(n); for (let k = 0; k < n; k++) tau[k] = (step[k] < 0 ? s : step[k]) / Math.max(1, s) * span;
  return { tau, steps: s, span };
}
export const weightAt = (tau, k, t, width = 0.28) => smooth((t - tau[k]) / width);

// The universe checks, adopted as engine tests. series: per-frame { mean, spread } over a full transfer.
export function transferChecks(series, { peak = 0.25, jump = 0.2, settleEps = 2e-3, hold = 5 } = {}) {
  const peakSpread = Math.max(...series.map(s => s.spread)); let maxJump = 0;
  for (let i = 1; i < series.length; i++) maxJump = Math.max(maxJump, Math.abs(series[i].mean - series[i - 1].mean));
  const tail = series.slice(-hold), settled = tail.length === hold && tail.every((s, i) => i === 0 || Math.abs(s.mean - tail[i - 1].mean) < settleEps) && tail.at(-1).spread < 0.05;
  return { peakSpread, maxJump, settled, pass: peakSpread >= peak && maxJump <= jump && settled };
}
