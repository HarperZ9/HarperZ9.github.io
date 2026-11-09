// lib/bubbly.mjs: the inflated display system (build e).
//
// Each letter's centre lines are inflated into round capsules and melted together with a smooth minimum, so a stroke
// becomes a soft blob and joins pool like poured syrup. Letters are set tight enough to overlap and are stacked in a
// set order. Each blob gets a hard offset shadow straight down, a keyline knocked off register from its fill, a
// slow edge wobble, and a few glints (stars and dots) scattered in the margin around the word. Only the skeleton is
// read, so any face or any word inflates the same way.
//
// SPEC:
//   bubbly(sk, { inflate 1..3 x half width, melt 0..1 x radius, inks [#hex...], shadow #hex, keyline #hex,
//                drop 0..0.08 x size, register [dx, dy] px, wobble 0..0.12 x radius, glints 0..40, seed, t (s), boil Hz })
//   -> { R: raster (transparent ground), blobs: coverage per letter (array), union: coverage }
// The edge wobble re-seeds at floor(t x boil): a 12 Hz boil gives a hand-drawn shimmer (QUALITY-SPEC M5).
import { canvas, paint, hexLin, rngFrom, clamp } from './raster.mjs';
import { valueNoise } from '../../../techniques/lib/util.js';
import { ribbonInto, polygonInto } from './geom.mjs';
import { components } from '../../../lettering/lib/fields.mjs';
import { sdfOf } from './skel.mjs';

/**
 * Counters (enclosed holes of the set letters) and how far to keep them open: a blob is carved back to its letter's
 * counter shrunk by `keep` x the counter's own inradius, so a, e and o stay a, e and o after inflation.
 */
export function counters(sk, keep = 0.3) {
  const inv = sk.cov.map((v) => 1 - v), { label, parts } = components(inv, sk.w, sk.h);
  const hole = parts.filter((p) => p.x0 > 0 && p.y0 > 0 && p.x1 < sk.w - 1 && p.y1 < sk.h - 1).map((p) => p.id), set = new Set(hole);
  const mask = new Float32Array(sk.w * sk.h); for (let i = 0; i < mask.length; i++) if (set.has(label[i])) mask[i] = inv[i];
  const d = sdfOf(mask, sk.w, sk.h), inr = new Map();
  for (let i = 0; i < d.length; i++) if (set.has(label[i])) inr.set(label[i], Math.max(inr.get(label[i]) ?? 0, -d[i]));
  const carve = new Float32Array(sk.w * sk.h).fill(Infinity);
  for (let i = 0; i < d.length; i++) if (set.has(label[i]) || d[i] < 2) { const id = label[i], r = inr.get(id) ?? 0; carve[i] = d[i] + keep * r; }
  return carve; // negative where the counter stays open
}

const smin = (a, b, k) => { const h = clamp(0.5 + (0.5 * (b - a)) / k); return b + (a - b) * h - k * h * (1 - h); };

function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-9, t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L2);
  return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
}

/** Signed distance of one inflated letter (smooth union of capsules) over its padded box; negative inside. */
export function blobField(sk, gi, { R, k, wobble = 0, seed = 1, carve = null }) {
  const S = sk.strokes.filter((s) => s.glyph === gi); if (!S.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of S) for (const [x, y] of s.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = R + k + 4; x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(sk.w - 1, Math.ceil(x1 + pad)); y1 = Math.min(sk.h - 1, Math.ceil(y1 + pad));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, d = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const px = x + x0 + 0.5, py = y + y0 + 0.5; let v = Infinity;
    for (const s of S) { let ds = Infinity; for (let i = 0; i + 1 < s.pts.length; i++) ds = Math.min(ds, segDist(px, py, s.pts[i], s.pts[i + 1])); if (s.pts.length === 1) ds = Math.hypot(px - s.pts[0][0], py - s.pts[0][1]); v = v === Infinity ? ds - R : smin(v, ds - R, k); }
    const c = carve ? carve[(y + y0) * sk.w + x + x0] : Infinity;
    d[y * bw + x] = Math.max(v + (wobble ? (valueNoise(px / (R * 1.6), py / (R * 1.6), seed) - 0.5) * 2 * wobble * R : 0), Number.isFinite(c) ? -c : -Infinity);
  }
  return { x0, y0, bw, bh, d };
}

// Coverage of a blob field shifted by (dx, dy), written into a full-frame array; ring > 0 draws only a band.
function stamp(sk, B, { dx = 0, dy = 0, ring = 0, offset = 0 } = {}) {
  const out = new Float32Array(sk.w * sk.h);
  for (let y = 0; y < B.bh; y++) for (let x = 0; x < B.bw; x++) {
    const X = x + B.x0 + Math.round(dx), Y = y + B.y0 + Math.round(dy); if (X < 0 || Y < 0 || X >= sk.w || Y >= sk.h) continue;
    const v = B.d[y * B.bw + x] - offset, c = ring ? clamp(ring / 2 - Math.abs(v) + 0.5) : clamp(0.5 - v);
    if (c > 0) out[Y * sk.w + X] = c;
  }
  return out;
}

/** A five-point star with rounded tips as a polygon. */
export function star(cx, cy, r, rot = 0, points = 5, inner = 0.46) {
  const P = [];
  for (let k = 0; k < points * 2; k++) { const a = rot - Math.PI / 2 + (k * Math.PI) / points, rr = k & 1 ? r * inner : r; P.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return P;
}

function glints(sk, union, o, rnd) {
  const cov = { star: new Float32Array(sk.w * sk.h), dot: new Float32Array(sk.w * sk.h) }, placed = [], marks = [];
  for (let tries = 0; placed.length < o.glints && tries < o.glints * 60; tries++) {
    const x = rnd() * sk.w, y = rnd() * sk.h, i = (y | 0) * sk.w + (x | 0); if (union.near[i] !== 1 || (union.carve && union.carve[i] < sk.size * 0.05)) continue; // never inside a counter
    const r = sk.size * (0.025 + 0.05 * rnd() ** 2.2); if (placed.some(([px, py, pr]) => Math.hypot(px - x, py - y) < (pr + r) * 2.2)) continue;
    placed.push([x, y, r]); const kind = rnd() < 0.6 ? 'star' : 'dot', ink = Math.floor(rnd() * o.inks.length);
    if (kind === 'star') polygonInto(cov.star, sk.w, sk.h, star(x, y, r, rnd() * 0.6 - 0.3)); else ribbonInto(cov.dot, sk.w, sk.h, [[x, y]], [r * 0.9]);
    marks.push({ kind, x, y, r, ink });
  }
  return marks;
}

export function bubbly(sk, opt = {}) {
  const o = { inflate: 1.9, melt: 0.55, inks: ['#f1ebdd', '#e6a03c', '#7fd6e8'], shadow: '#b5452f', keyline: '#f1ebdd', drop: 0.035, register: [-0.012, -0.01], wobble: 0.05, glints: 9, counters: 0.3, seed: 'bubbly', t: 0, boil: 12, ...opt };
  const R = canvas(sk.w, sk.h), rnd = rngFrom(o.seed), Rr = sk.half * o.inflate, k = Rr * o.melt, frame = Math.floor(o.t * o.boil);
  const carve = o.counters ? counters(sk, o.counters) : null;
  const blobs = sk.glyphs.map((_, gi) => blobField(sk, gi, { R: Rr, k, wobble: o.wobble, seed: 31 + frame * 7 + gi, carve }));
  const order = blobs.map((_, i) => i).filter((i) => blobs[i]).sort((a, b) => (a & 1) - (b & 1) || a - b); // odd letters sit on top
  const union = new Float32Array(sk.w * sk.h), cover = [];
  for (const gi of order) {
    const B = blobs[gi], fill = stamp(sk, B), ink = hexLin(o.inks[gi % o.inks.length]);
    paint(R, stamp(sk, B, { dy: sk.size * o.drop }), hexLin(o.shadow));
    paint(R, fill, ink);
    paint(R, stamp(sk, B, { dx: sk.size * o.register[0], dy: sk.size * o.register[1], ring: Math.max(1.2, sk.size * 0.006) }), hexLin(o.keyline), 0.9);
    for (let i = 0; i < union.length; i++) union[i] = Math.max(union[i], fill[i]);
    cover.push(fill);
  }
  const near = nearBand(sk, union, Rr);
  const marks = glints(sk, { near, carve }, o, rnd);
  for (const m of marks) { const c = new Float32Array(sk.w * sk.h); if (m.kind === 'star') polygonInto(c, sk.w, sk.h, star(m.x, m.y, m.r, 0.1)); else ribbonInto(c, sk.w, sk.h, [[m.x, m.y]], [m.r * 0.9]); paint(R, c, hexLin(o.inks[m.ink])); }
  return { R, union, blobs: cover, marks };
}

// The margin band where glints may sit: outside the word, within about four radii of it (box-dilated mask).
function nearBand(sk, union, Rr) {
  const { w, h } = sk, step = Math.max(2, Math.round(Rr * 0.5)), cw = Math.ceil(w / step), ch = Math.ceil(h / step), g = new Uint8Array(cw * ch), out = new Uint8Array(w * h);
  for (let i = 0; i < union.length; i++) if (union[i] > 0.5) g[Math.floor(((i / w) | 0) / step) * cw + Math.floor((i % w) / step)] = 1;
  const reach = Math.ceil((Rr * 4) / step), near = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (g[y * cw + x]) for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < cw && Y < ch) near[Y * cw + X] = 1; }
  for (let i = 0; i < out.length; i++) { const c = Math.floor(((i / w) | 0) / step) * cw + Math.floor((i % w) / step); out[i] = near[c] && !g[c] && union[i] < 0.01 ? 1 : 0; }
  return out;
}
