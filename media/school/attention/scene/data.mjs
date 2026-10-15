// Inside the lens: the model's own numbers as dense data art. Every word is a column of dots, one
// dot per number of its vector; attention is a bundle of fine threads from the reading word back
// to each earlier word, where a thread lands on a word with probability equal to that word's
// attention weight, so the density of light is the weight. All values come from facts.json.
import { circle, polyline, rect, C, SPECTRUM, QUALITY, rng, words, quad, smooth01, pct } from "./lib.mjs";

export const COL = { y0: 560, dy: 12, top: 520 };
export const colX = (i, n) => 960 + (i - (n - 1) / 2) * Math.min(150, 1700 / n);

// Columns of dots. lit[i] in 0..1 brightens a column; q marks the reading word in the hot mark.
export function columns(A, F, { appear = 1, lit = null, q = F.probe.query, shares = null, labels = true } = {}) {
  const out = [], n = F.probe.words.length, max = F.vecMax;
  F.vecs.forEach((v, i) => {
    const a = smooth01(appear * n - i * 0.6), x = colX(i, n), isQ = i === q, l = lit ? lit[i] : 0.5;
    if (a <= 0) return;
    v.forEach((val, k) => out.push({ shape: circle(x, COL.y0 + k * COL.dy, (1.4 + 4.6 * Math.min(1, Math.abs(val) / max)) * a, 10), blend: "add",
      fill: isQ ? [0.89, 0.58, 0.45, 0.95] : val >= 0 ? [0.93, 0.9, 0.84, 0.35 + 0.65 * l] : [0.6, 0.7, 0.85, 0.35 + 0.65 * l] }));
    if (labels) out.push({ shape: words(F.probe.words[i], A.sans, 34, x, COL.y0 + v.length * COL.dy + 46, "center"), fill: isQ ? C.hot : C.ink, opacity: a });
    if (shares && i < q) out.push({ shape: words(pct(shares[i]), A.mono, 26, x, COL.y0 + v.length * COL.dy + 84, "center"), fill: C.dim, opacity: a });
  });
  return out;
}

// Pick a word for thread u by its weight (inverse of the cumulative sum).
const pick = (w, u, q) => { let s = 0; for (let i = 0; i < q; i++) { s += w[i]; if (u < s) return i; } return Math.max(0, q - 1); };

// The bundle: count threads from the reading word, up over the prism at (px, py), down to their
// words. grow (0..1) draws them out; each bundle spreads in proportion to its weight.
export function threads(F, shares, { grow = 1, count = 1400, seed = 42, px = 960, py = 300, colour = [1, 0.9, 0.75], alpha = 0.075, q = F.probe.query, lift = 0 } = {}) {
  const r = rng(seed), n = F.probe.words.length, out = [], qx = colX(q, n), y = COL.y0 - 14;
  if (grow <= 0) return out;
  const m = Math.max(50, Math.round(count * QUALITY.threads)), boost = Math.min(4, count / m);
  for (let j = 0; j < m; j++) {
    const key = pick(shares, r(), q), w = shares[key], spread = 10 + 220 * Math.sqrt(w);
    const mx = px + (r() - 0.5) * spread, my = py + (r() - 0.5) * spread * 0.35 - lift;
    const kx = colX(key, n) + (r() - 0.5) * (6 + 30 * w), h1 = 120 + r() * 80, h2 = 60 + r() * 60;
    const a = quad(qx, y, (qx + mx) / 2 + 40, my - h1, mx, my, 14), b = quad(mx, my, (mx + kx) / 2 - 20, my - h2 * 0.3, kx, y, 14);
    const pts = [...a, ...b.slice(2)], keep = Math.max(2, Math.floor((pts.length / 2) * grow)) * 2;
    out.push({ shape: polyline(pts.slice(0, keep)), fill: null, stroke: [...colour, alpha * boost], width: 1, blend: "add" });
  }
  return out;
}

// Rerun's prism, and the spectrum at its exit edge (the only place the spectrum appears).
export function prism(px, py, flare = 1, s = 1) {
  const out = [{ shape: polyline([px - 90 * s, py + 80 * s, px, py - 80 * s, px + 90 * s, py + 80 * s], true), fill: [0.6, 0.7, 0.8, 0.08], stroke: [0.9, 0.95, 1, 0.75], width: 2 }];
  SPECTRUM.forEach((c, i) => out.push({ shape: polyline([px + 46 * s + i * 4, py + 2 - i * 2, px + 70 * s + i * 6, py + 40 * s + i * 3]), fill: null, stroke: [...c, 0.85 * flare], width: 3, blend: "add" }));
  return out;
}

// One head's attention map as a grid of cells: brightness is the weight, upper triangle empty
// (a word cannot read words after it). (x, y) is the top-left, cell the size of one cell.
export function grid(A, M, x, y, cell, { appear = 1, title = null, hi = null } = {}) {
  const T = M.length, out = [{ shape: rect(x - 6, y - 6, T * cell + 12, T * cell + 12, 4), fill: [0, 0, 0, 0.6 * appear], stroke: [0.6, 0.55, 0.5, 0.5 * appear], width: 1.5 }];
  for (let i = 0; i < T; i++) for (let j = 0; j <= i; j++) {
    const w = M[i][j], v = Math.sqrt(w);
    if (smooth01(appear * 2 - (i + j) / (2 * T)) <= 0 || w < 0.01) continue;
    out.push({ shape: rect(x + j * cell + 1, y + i * cell + 1, cell - 2, cell - 2), fill: hi && hi(i, j) ? [0.89, 0.58, 0.45, v] : [0.95, 0.88, 0.72, v] });
  }
  if (title) out.push({ shape: words(title, A.mono, 22, x, y - 18), fill: C.ink, opacity: appear });
  return out;
}

// The dot product of one pair, shown as products: each product is a spark that falls into the sum.
export function dotProduct(A, q, k, x, y, u, { scale = 1, gap = 20 } = {}) {
  const out = [], n = q.length, sum = q.reduce((s, v, i) => s + v * k[i], 0);
  let run = 0;
  for (let i = 0; i < n; i++) {
    const p = q[i] * k[i], yy = y + i * gap, done = smooth01(u * (n + 4) - i);
    out.push({ shape: circle(x - 80, yy, 3 + 11 * Math.min(1, Math.abs(q[i]) * scale), 16), fill: q[i] >= 0 ? [0.89, 0.58, 0.45, 0.95] : [0.6, 0.45, 0.4, 0.95] });
    out.push({ shape: circle(x + 80, yy, 3 + 11 * Math.min(1, Math.abs(k[i]) * scale), 16), fill: k[i] >= 0 ? [0.93, 0.9, 0.84, 0.95] : [0.6, 0.7, 0.85, 0.95] });
    if (done > 0 && done < 1) out.push({ shape: circle(x + (1 - done) * 0, yy + (y + n * gap + 40 - yy) * done, 3 + 3 * Math.min(1, Math.abs(p) * scale * scale), 10), fill: p >= 0 ? [1, 0.85, 0.6, 1] : [0.6, 0.75, 1, 1], blend: "add" });
    if (done >= 1) run += p;
  }
  return { items: out, running: run, sum };
}
