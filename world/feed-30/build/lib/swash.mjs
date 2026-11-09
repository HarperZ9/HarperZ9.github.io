// lib/swash.mjs: swashes and ligatures grown from a skeleton (build b).
//
// A swash is a stroke that keeps going past its terminal and curls. We find the free ends of the centre lines,
// read each end's outward tangent, and grow an Euler-spiral tail from it: curvature rises with arc length, so the
// tail leaves straight and tightens into a curl, the way a pen swash does. Its width tapers from the stroke width
// to a hairline and can end in a ball. A ligature joins one letter's exit to the next letter's entry with a cubic
// that leaves and arrives along both tangents and thins in the middle. Tails and joins are tested against the
// letters they would cross and turned or dropped when they would bury a counter.
//
// SPEC:
//   grow(sk, { amount 0..1 share of free ends, length 0.5..4 x stroke width... (px via size), turns 0.25..1.6,
//              power 1..3 curvature ramp, ball 0..1.6 x half width, ligatures true|false, maxPerGlyph 1..4, seed })
//   -> { cov, tails: [{ pts, widths, glyph, end }], joins: [{ pts, widths, from, to }] }
// Deterministic for a given skeleton and seed.
import { ribbonInto } from './geom.mjs';
import { endTangent } from './skel.mjs';
import { rngFrom } from './raster.mjs';

/**
 * Free ends: stroke ends not lying on another stroke of the same letter. In Latin, how far a letter reaches up or
 * down is part of its identity (n against h, r against f), so an end that points down at the baseline or up at the
 * x-height is turned to leave sideways and curl away from the body ("foot" and "flag"); only ends already at the
 * ascender, cap or descender line keep their vertical direction.
 */
export function terminals(sk) {
  const out = [], Z = sk.zones ?? { baseline: sk.h * 0.7, xh: sk.size * 0.5, cap: sk.size * 0.7 }, tol = sk.size * 0.09;
  sk.strokes.forEach((s, si) => {
    if (s.dot || s.pts.length < 2) return;
    let len = 0; for (let i = 1; i < s.pts.length; i++) len += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
    if (len < s.width * 1.5) return; // a dot or a tittle keeps its shape
    const G = sk.glyphs[s.glyph], mid = G ? (G.x0 + G.x1) / 2 : s.pts[0][0];
    for (const end of [0, 1]) {
      const p = end ? s.pts[s.pts.length - 1] : s.pts[0];
      if (sk.strokes.some((o, oi) => oi !== si && o.glyph === s.glyph && distToPoly(p, o.pts) < s.width * 0.7)) continue;
      let t = endTangent(s.pts, end, s.width * 0.6), kind = 'free', side = 0;
      const dir = p[0] >= mid ? 1 : -1;
      if (t[1] > 0.6 && p[1] < Z.baseline + tol) { t = [dir, 0]; kind = 'foot'; side = dir > 0 ? -1 : 1; }
      else if (t[1] < -0.6 && p[1] > Z.baseline - Z.xh - tol && p[1] > Z.baseline - Z.cap + tol) {
        if (sk.strokes.some((o) => o.glyph === s.glyph && (o.dot || o.pts.length === 2 && Math.hypot(o.pts[1][0] - o.pts[0][0], o.pts[1][1] - o.pts[0][1]) < s.width * 1.2))) continue; // a dotted letter keeps a clear top
        t = [dir, 0]; kind = 'flag'; side = dir > 0 ? -1 : 1;
      }
      out.push({ stroke: si, end, p, t, width: s.width, glyph: s.glyph, kind, side });
    }
  });
  return out;
}

export function distToPoly(p, P) {
  let best = Infinity;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

/**
 * An Euler-spiral tail from point p along unit tangent t: curvature k(s) = kmax (s/L)^power, with kmax set so the
 * whole tail turns `turns` full circles. side = +1 curls clockwise on screen, -1 anticlockwise.
 */
export function spiral(p, t, { length, turns = 0.7, power = 1.6, side = 1, step = 1.5 }) {
  const n = Math.max(4, Math.ceil(length / step)), ds = length / n, kmax = (turns * 2 * Math.PI * (power + 1)) / length;
  let th = Math.atan2(t[1], t[0]), x = p[0], y = p[1]; const pts = [[x, y]];
  for (let i = 1; i <= n; i++) { const s = (i - 0.5) * ds; th += side * kmax * (s / length) ** power * ds; x += Math.cos(th) * ds; y += Math.sin(th) * ds; pts.push([x, y]); }
  return pts;
}

/** Width along a tail: from w0 at the root, swelling a little, to a hairline; optional ball at the tip. */
export function tailWidths(n, w0, { swell = 0.18, hair = 1.2, ball = 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) { const u = i / Math.max(1, n - 1); out.push(Math.max(hair, w0 * (1 - u) ** 1.15 * (1 + swell * Math.sin(Math.PI * u)))); }
  if (ball > 0) out[n - 1] = Math.max(out[n - 1], w0 * ball);
  return out;
}

// Share of a ribbon's coverage that lands on ink other than its own root.
function overlap(sk, pts, widths, root, keep) {
  const roots = Array.isArray(root[0]) ? root : [root];
  const m = Math.max(...widths) / 2 + 2; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m); x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(sk.w - 1, Math.ceil(x1)); y1 = Math.min(sk.h - 1, Math.ceil(y1));
  if (x1 < x0 || y1 < y0) return 1;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, probe = new Float32Array(bw * bh);
  ribbonInto(probe, bw, bh, pts.map(([x, y]) => [x - x0, y - y0]), widths);
  let ink = 0, all = 0, out = 0;
  for (let i = 0; i < probe.length; i++) {
    if (probe[i] <= 0) continue;
    const x = (i % bw) + x0, y = ((i / bw) | 0) + y0; if (roots.some((r) => Math.hypot(x - r[0], y - r[1]) < keep)) continue;
    all += probe[i]; ink += probe[i] * sk.cov[y * sk.w + x];
  }
  // A tail that leaves the frame is clipped; count the lost part as overlap so it turns the other way.
  for (const [x, y] of pts) if (x < 0 || y < 0 || x >= sk.w || y >= sk.h) out++;
  return all ? ink / all + out / pts.length : 1;
}

function growTail(sk, T, o, r) {
  const short = T.kind === 'free' ? 1 : 0.85, length = T.width * o.length * short * (0.75 + 0.5 * r()), best = [];
  for (const side of T.side ? [T.side] : [1, -1]) {
    const pts = spiral(T.p, T.t, { length, turns: o.turns * (T.kind === 'free' ? 1 : 0.7) * (0.85 + 0.3 * r()), power: o.power, side });
    const widths = tailWidths(pts.length, T.width, { ball: o.ball });
    best.push({ pts, widths, ov: overlap(sk, pts, widths, T.p, T.width * 0.8), side });
  }
  best.sort((a, b) => a.ov - b.ov);
  return best[0].ov <= o.maxOverlap ? { ...best[0], glyph: T.glyph, end: T.end, stroke: T.stroke } : null;
}

function cubic(p0, p1, p2, p3, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const u = i / n, a = (1 - u) ** 3, b = 3 * u * (1 - u) ** 2, c = 3 * u * u * (1 - u), d = u ** 3; out.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]); }
  return out;
}

/** Join an exit terminal (letter i) to an entry terminal (letter i+1) with a tapered cubic. */
export function join(A, B, { reach = 1.1, thin = 0.3, sag = 0 } = {}) {
  const d = Math.hypot(B.p[0] - A.p[0], B.p[1] - A.p[1]) * 0.5 * reach, n = Math.max(8, Math.ceil(d / 1.2));
  const pts = cubic(A.p, [A.p[0] + A.t[0] * d, A.p[1] + A.t[1] * d + sag], [B.p[0] + B.t[0] * d, B.p[1] + B.t[1] * d + sag], B.p, n);
  const widths = pts.map((_, i) => { const u = i / n, m = Math.abs(2 * u - 1) ** 1.6; return Math.max(1.2, (A.width * (1 - u) + B.width * u) * (thin + (1 - thin) * m)); });
  return { pts, widths };
}

function ligatures(sk, T, used, o) {
  const joins = [], Z = sk.zones ?? { baseline: sk.h * 0.7 };
  for (let gi = 0; gi + 1 < sk.glyphs.length; gi++) {
    const gap = sk.glyphs[gi + 1].x0 - sk.glyphs[gi].x1; if (gap > sk.size * 0.3) continue; // a word space
    // The rightmost low end of one letter leaves rightward, the leftmost low end of the next arrives leftward.
    const low = (t) => t.kind !== 'flag' && Math.abs(t.p[1] - Z.baseline) < sk.size * 0.15 && !used.has(t);
    const ex = T.filter((t) => t.glyph === gi && low(t)).sort((p, q) => q.p[0] - p.p[0])[0], en = T.filter((t) => t.glyph === gi + 1 && low(t)).sort((p, q) => p.p[0] - q.p[0])[0];
    let best = null;
    if (ex && en && en.p[0] > ex.p[0] && en.p[0] - ex.p[0] < sk.size * 0.9 && Math.abs(en.p[1] - ex.p[1]) < sk.size * 0.45) best = { a: { ...ex, t: [1, 0] }, b: { ...en, t: [-1, 0] }, ra: ex, rb: en };
    if (!best) continue;
    const J = join(best.a, best.b, { ...o, sag: o.sag * sk.size });
    if (overlap(sk, J.pts, J.widths, [best.a.p, best.b.p], Math.max(best.a.width, best.b.width) * 1.2) > 0.35) continue;
    used.add(best.ra); used.add(best.rb); joins.push({ ...J, from: gi, to: gi + 1 });
  }
  return joins;
}

/** Grow swashes and ligatures on a skeleton; returns the new coverage and the added centre lines. */
export function grow(sk, opt = {}) {
  const o = { amount: 0.55, length: 3.2, turns: 0.75, power: 1.6, ball: 0.55, ligatures: true, maxPerGlyph: 2, maxOverlap: 0.12, seed: 'swash', reach: 1.1, thin: 0.3, sag: 0.1, ...opt };
  const r = rngFrom(o.seed), T = terminals(sk), used = new Set();
  const joins = o.ligatures ? ligatures(sk, T, used, o) : [];
  // Ends that face outward from the word's body first: tops, bottoms, the first entry and the last exit.
  const last = sk.glyphs.length - 1, score = (t) => Math.abs(t.t[1]) + (t.glyph === 0 && t.t[0] < 0 ? 1 : 0) + (t.glyph === last && t.t[0] > 0 ? 1 : 0) + r() * 0.6;
  const order = T.filter((t) => !used.has(t)).map((t) => [score(t), t]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const per = new Map(), tails = [], want = Math.round(order.length * o.amount);
  for (const t of order) {
    if (tails.length >= want) break;
    if ((per.get(t.glyph) ?? 0) >= o.maxPerGlyph) continue;
    const tail = growTail(sk, t, o, r); if (!tail) continue;
    tails.push(tail); per.set(t.glyph, (per.get(t.glyph) ?? 0) + 1);
  }
  const cov = Float32Array.from(sk.cov);
  for (const x of [...tails, ...joins]) ribbonInto(cov, sk.w, sk.h, x.pts, x.widths);
  return { cov, tails, joins, strokes: [...tails, ...joins].map((x) => ({ pts: x.pts, width: x.widths[0], glyph: x.glyph ?? x.from, ch: '', swash: true })) };
}
