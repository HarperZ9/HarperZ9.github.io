// ticks.mjs: transformation as weight shifting in motion (BLEED.md sections 11 to 15), as pure numbers.
// An element is a grid of ticks. Each tick carries a weight vector over two elements, [from, to], that sums to 1.
// A transfer is the weights shifting from one element toward the next, tick by tick. A cellular automaton decides
// when each tick flips: a tick crosses over once enough of its neighbours have (a weighted neighbour sum against a
// threshold, the same form as a Life cell or a perceptron), and thick ink holds out longer than thin. The flips
// spread as a front from a seed edge, so the change is a moving front and never one global slider (a crossfade).
//
//   const f = growFront(cols, rows, { ink, seedEdge: "bottom", seed })   // flip time per tick, 0..1
//   weightAt(f.tau, i, t, width)        -> the tick's weight on the "to" element at transfer time t
//   spread(f.tau, t, { mask })          -> { mean, sd } of the weights across the ticks: the per-frame check
//   timing(t, clocks, weights)          -> a weighted timing layer (each element's clock is a law with a weight)
//   recombine(a, b, w)                  -> two colours recombined by weight under the subtractive law
// The flip times are computed once per transfer, so a weight depends only on t: walking back reverses it.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

// Grow the flip front with a threshold automaton. ink (Float32Array cols*rows, 0..1) thickens a tick against the
// flip; seedEdge sets where the front starts (the side nearest the next place), or seedAt [i, j] starts it from
// one point, the way frost spreads from a seed. Returns tau (0..span) per tick
// and the number of automaton steps it took. Deterministic for a seed.
// Fitted by build/fit_front.mjs to the reference library's measured fronts: the median spread exponent over the 96
// studies that measured one is a = 0.176 (r ~ t^a; quartiles 0.10 and 0.30). The automaton keeps its own shape,
// a connected front that grows as r ~ s^b in steps with b = 0.96 (ruleExponent, measured by the fit). The timing law
// carries the measured pace: tau = (s / S)^(b / a), so r ~ tau^0.176 on the transfer's clock: a fast bloom, then a
// slow creep at the edge. Measured consequences, kept: the bloom flips about a quarter of the element early, so the
// weights' peak spread falls from about 0.40 (steps as time) to 0.25 to 0.32 in the checks, and the steepest change of
// the mean rises from 3.0 to about 4 per unit of transfer time (no cut; a cut would be above 20). Tried and rejected: an onset offset t0 (keeps
// the spread, but its effective exponent is about 0.46, so it no longer fits), and a slower automaton (its slowest
// member grew as s^0.475 only because a stalled front reseeds at random: nucleation, not a front).
export const FRONT_FIT = Object.freeze({ theta0: 1.4, thetaInk: 2.2, noise: 0.04, decay: 0, a: 0.176, ruleExponent: 0.96,
  source: "library studies/*/MEASURED.md, spread exponent, n = 96 of 319 (the rest null)" });
export function frontTime(x, rule = FRONT_FIT) {  // the timing law: normalised step (0..1) to transfer time (0..1)
  if (rule.k != null) return x ** rule.k;  // a plain power, kept for the fit's own measurement (k = 1: steps as time)
  if (!rule.a) return x;
  return x ** (rule.ruleExponent / rule.a);
}
export function growFront(cols, rows, { ink = null, seedEdge = "bottom", seedAt = null, seed = 1, span = 0.72, maxSteps = 600, rule = FRONT_FIT, onStep = null } = {}) {
  const n = cols * rows, on = new Uint8Array(n), step = new Int32Array(n).fill(-1);
  let r = seed >>> 0 || 1; const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  const thick = (k) => (ink ? ink[k] : 0.5);
  if (seedAt) { const [si, sj] = seedAt; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = si + di, j = sj + dj; if (i >= 0 && j >= 0 && i < cols && j < rows) { on[j * cols + i] = 1; step[j * cols + i] = 0; } } }
  else for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const edge = seedEdge === "bottom" ? j === rows - 1 : seedEdge === "top" ? j === 0 : seedEdge === "left" ? i === 0 : i === cols - 1;
    if (edge && rnd() < 0.35) { const k = j * cols + i; on[k] = 1; step[k] = 0; }
  }
  let s = 0, left = n - on.reduce((a, b) => a + b, 0);
  const W = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 0.7], [1, -1, 0.7], [-1, 1, 0.7], [1, 1, 0.7]];
  while (left > 0 && s < maxSteps) {
    s++; const flip = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i; if (on[k]) continue;
      let sum = 0; for (const [dx, dy, w] of W) { const x = i + dx, y = j + dy; if (x >= 0 && y >= 0 && x < cols && y < rows && on[y * cols + x]) sum += w; }
      const theta = rule.theta0 + rule.thetaInk * thick(k);  // thick ink holds out: paint dries from the thin parts inward
      if (sum >= theta || (sum > 0 && rnd() < rule.noise * sum / (1 + s) ** rule.decay)) flip.push(k);
    }
    if (!flip.length) { const k = (rnd() * n) | 0; if (!on[k]) flip.push(k); }  // a stalled front reseeds anywhere
    for (const k of flip) { on[k] = 1; step[k] = s; left--; }
    onStep?.(s, n - left);
  }
  const tau = new Float32Array(n), last = Math.max(1, s);
  for (let k = 0; k < n; k++) tau[k] = frontTime(step[k] < 0 ? 1 : step[k] / last, rule) * span;
  return { tau, steps: s };
}

// The tick's weight on the "to" element at transfer time t: a local flip of width `width` at its own moment.
export function weightAt(tau, k, t, width = 0.14) { return smooth((t - tau[k]) / width); }

// Mean and spatial spread of the weights across the ticks (optionally only where mask[k] is true). A crossfade has
// sd near 0 on every frame; a front has a high sd mid-transfer and 0 at both ends.
export function spread(tau, t, { mask = null, width = 0.14 } = {}) {
  let n = 0, s = 0, s2 = 0;
  for (let k = 0; k < tau.length; k++) { if (mask && !mask[k]) continue; const w = weightAt(tau, k, t, width); n++; s += w; s2 += w * w; }
  const mean = n ? s / n : 0; return { mean, sd: n ? Math.sqrt(Math.max(0, s2 / n - mean * mean)) : 0, n };
}

// A timing layer: each element's clock is a curve (a law) with a weight, combined by weight like any other layer.
export function timing(t, clocks, weights) {
  let s = 0, wsum = 0; clocks.forEach((c, i) => { const w = weights[i] ?? 1; s += w * c(clamp(t)); wsum += w; });
  return wsum ? s / wsum : t;
}

// Two colours (0..255 sRGB triples) recombined by weight under the subtractive law: transmissions multiply, so the
// weighted mix is a geometric mean in linear light. Not a linear blend: a weight on a shape (BLEED.md section 11).
const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const enc = (v) => Math.round(255 * clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
export function recombine(a, b, w) { return a.map((c, i) => enc(Math.max(1e-4, lin(c)) ** (1 - w) * Math.max(1e-4, lin(b[i])) ** w)); }

// ---- the transparency record (PRINCIPLES-BRIEF 3 and 4): what of the source survives a transfer, per property ----
// Clarity of a property = d' in the view / d' in the source, where d' separates the element's ticks from its ground:
// |mean(element) - mean(ground)| / sqrt((var(element) + var(ground)) / 2). Below 1 the property is lost by that
// share; above 1 the view sharpens it. Structure is the correlation between the source's lightness pattern across
// the element's ticks and the view's (|r|; 1 keeps the pattern, 0 loses it). Colours are sRGB 0..255 triples.
function lab(c) {
  const l = c.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const X = (0.4124 * l[0] + 0.3576 * l[1] + 0.1805 * l[2]) / 0.9505, Y = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2], Z = (0.0193 * l[0] + 0.1192 * l[1] + 0.9505 * l[2]) / 1.089;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const L = 116 * f(Y) - 16, a = 500 * (f(X) - f(Y)), b = 200 * (f(Y) - f(Z));
  return { L, C: Math.hypot(a, b), a, b };
}
function dprime(e, g) {
  const m = (v) => v.reduce((s, x) => s + x, 0) / Math.max(1, v.length), va = (v, mu) => v.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, v.length);
  const me = m(e), mg = m(g); return Math.abs(me - mg) / Math.sqrt((va(e, me) + va(g, mg)) / 2 + 1e-6);
}
function corr(x, y) {
  const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 1e-9 && syy > 1e-9 ? sxy / Math.sqrt(sxx * syy) : 0;
}
// A, B: { col: [[r,g,b]...], ink } per tick; mask marks the element's ticks; weights: each tick's weight on B now.
export function clarity(A, B, mask, weights) {
  const src = { L: [[], []], C: [[], []] }, view = { L: [[], []], C: [[], []] }, sL = [], vL = [];
  const gw = weights.reduce((s, w, k) => s + (mask[k] ? w : 0), 0) / Math.max(1, mask.reduce((s, v) => s + v, 0));
  for (let k = 0; k < mask.length; k++) {
    const side = mask[k] ? 0 : 1, a = lab(A.col[k]), v = lab(recombine(A.col[k], B.col[k], mask[k] ? weights[k] : gw));
    src.L[side].push(a.L); src.C[side].push(a.C); view.L[side].push(v.L); view.C[side].push(v.C);
    if (mask[k]) { sL.push(a.L); vL.push(v.L); }
  }
  const ratio = (p) => { const s = dprime(src[p][0], src[p][1]); return s > 1e-3 ? dprime(view[p][0], view[p][1]) / s : null; };
  return { lightness: ratio("L"), chroma: ratio("C"), structure: sL.length > 2 ? Math.abs(corr(sL, vL)) : null };
}
