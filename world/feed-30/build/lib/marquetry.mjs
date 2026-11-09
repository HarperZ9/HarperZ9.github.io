// lib/marquetry.mjs: tile-warp marquetry (build d).
//
// Two veneers alternate on a diamond lattice. Each dark tile is a superellipse in its cell, and its exponent and
// scale move together along one shape path q in [0, 1]: at q = 0 a small pinched diamond, at q = 1 a full square
// that bulges into its light neighbours. Tone is the dark share of the panel, so a tone field (a word, a picture)
// is drawn by choosing q per tile from a measured lookup table. Tiles are constant per cell, as cut veneer is. The
// two species run their grain at right angles, so the checker also shimmers with the light (chatoyance). Pins of
// holly and ebony sit at the lattice nodes, and a glue line runs along every tile edge.
//
// SPEC:
//   marquetry(w, h, { tone: Float32Array(w*h) 0..1 darkness, pitch 12..120 px (diagonal of a cell),
//                     kerf 0..2 px, pin 0..0.2 cell, light/dark species, frame 0..0.12 share, lightDeg, sheen 0..1, seed })
//   -> raster (opaque)
//   shapeOf(q) -> { n, rho }; shareOf(q) dark share of a uniform panel; qForTone(t) the inverse (monotone LUT)
import { wood } from './wood.mjs';
import { canvas, rngFrom, blur, hexLin } from './raster.mjs';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const SQ = Math.SQRT1_2;

/** The shape path: exponent and scale of the dark superellipse (cell units, half size 0.5 x rho). */
export const shapeOf = (q) => ({ n: 1.1 + 4.9 * q ** 1.4, rho: 0.84 + 0.36 * q });

// Superellipse radius ratio of a point (u, v) in cell units around a dark tile centre: < 1 inside.
const ratio = (u, v, s) => (Math.abs(2 * u / s.rho) ** s.n + Math.abs(2 * v / s.rho) ** s.n) ** (1 / s.n);

/** Dark share of a panel where every tile has shape q (sampled on a 2 x 2 cell block, 96 x 96 per cell). */
export function shareOf(q, N = 96) {
  const s = shapeOf(q), cells = []; let dark = 0;
  for (let ci = -1; ci <= 2; ci++) for (let cj = -1; cj <= 2; cj++) if (((ci + cj) & 1) === 0) cells.push([ci, cj]);
  for (let y = 0; y < 2 * N; y++) for (let x = 0; x < 2 * N; x++) {
    const U = (x + 0.5) / N, V = (y + 0.5) / N;
    if (cells.some(([ci, cj]) => ratio(U - ci - 0.5, V - cj - 0.5, s) < 1)) dark++;
  }
  return dark / (4 * N * N);
}

let LUT = null;
function lut() { if (!LUT) { LUT = []; for (let k = 0; k <= 48; k++) LUT.push([k / 48, shareOf(k / 48, 48)]); } return LUT; }
/** The q whose uniform panel has dark share t (clamped to the reachable range). */
export function qForTone(t) {
  const L = lut(); if (t <= L[0][1]) return 0; if (t >= L[L.length - 1][1]) return 1;
  for (let k = 1; k < L.length; k++) if (L[k][1] >= t) { const [q0, s0] = L[k - 1], [q1, s1] = L[k]; return q0 + ((t - s0) / (s1 - s0 || 1)) * (q1 - q0); }
  return 1;
}
export const toneRange = () => { const L = lut(); return [L[0][1], L[L.length - 1][1]]; };

/** A darkness field from a skeleton: base outside the letters, base + contrast inside, softened over one cell. */
export function toneFromSkeleton(sk, { base = 0.3, contrast = 0.4, soften = 10 } = {}) {
  const b = blur(sk.cov, sk.w, sk.h, soften), out = new Float32Array(sk.w * sk.h);
  for (let i = 0; i < out.length; i++) out[i] = base + contrast * b[i];
  return out;
}

function tileQ(o, w, h, c) {
  const cache = new Map();
  return (i, j) => {
    const key = i * 100003 + j; let v = cache.get(key); if (v !== undefined) return v;
    const U = (i + 0.5) * c, V = (j + 0.5) * c, x = Math.round((U - V) * SQ), y = Math.round((U + V) * SQ);
    const t = typeof o.tone === 'function' ? o.tone(x, y) : o.tone ? o.tone[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)] : 0.5;
    v = shapeOf(qForTone(t)); cache.set(key, v); return v;
  };
}

// Distance (px, negative inside) to the nearest dark tile edge at cell coordinates (U, V); also which dark tile.
function darkAt(U, V, c, Q) {
  const i = Math.floor(U), j = Math.floor(V); let best = Infinity, bi = 0, bj = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
    const ci = i + di, cj = j + dj; if (((ci + cj) & 1) !== 0) continue;
    const s = Q(ci, cj), f = ratio(U - ci - 0.5, V - cj - 0.5, s), d = (f - 1) * s.rho * c * 0.5;
    if (d < best) { best = d; bi = ci; bj = cj; }
  }
  return { d: best, i: bi, j: bj };
}

export function marquetry(w, h, opt = {}) {
  const o = { pitch: 36, kerf: 0.9, pin: 0.075, light: 'maple', dark: 'fumed', frame: 0.05, lightDeg: 20, sheen: 0.35, seed: 'marquetry', ...opt };
  const R = canvas(w, h), c = o.pitch * SQ, Q = tileQ(o, w, h, c), rnd = rngFrom(o.seed), seedInt = Math.floor(rnd() * 1e6), la = (o.lightDeg * Math.PI) / 180;
  const fw = Math.round(Math.min(w, h) * o.frame), glue = hexLin('#2a201a');
  const jitter = (i, j, k) => { const x = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + seedInt) * 43758.5453; return x - Math.floor(x); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (x < fw || y < fw || x >= w - fw || y >= h - fw) { R.data.set(frameAt(x, y, w, h, fw, seedInt), p); R.data[p + 3] = 1; continue; }
    const U = ((x + 0.5 + (y + 0.5)) * SQ) / c, V = ((y + 0.5 - (x + 0.5)) * SQ) / c, D = darkAt(U, V, c, Q);
    const nU = Math.round(U), nV = Math.round(V), pinD = (Math.abs(U - nU) + Math.abs(V - nV)) - o.pin;
    let col;
    if (pinD < 0) col = wood(x, y, { species: (nU & 1) ? 'holly' : 'ebony', angle: 0.6, seed: seedInt + 5, sheen: 0.1 });
    else {
      const darkSide = D.d < 0, ti = darkSide ? D.i : Math.floor(U), tj = darkSide ? D.j : Math.floor(V);
      const angle = (darkSide ? Math.PI / 2 : 0) + (jitter(ti, tj, 1) - 0.5) * 0.08, sp = darkSide ? o.dark : o.light;
      col = wood(x + jitter(ti, tj, 2) * 900, y + jitter(ti, tj, 3) * 900, { species: sp, angle, seed: seedInt + (darkSide ? 1 : 2), sheen: o.sheen, light: la });
      const tint = 0.95 + 0.1 * jitter(ti, tj, 4); col = col.map((v) => v * tint);
      const a = clamp(0.5 - D.d) , e = clamp(o.kerf / 2 - Math.abs(D.d) + 0.5); // anti-aliased edge, then the glue line
      if (a > 0 && a < 1) { const other = wood(x, y, { species: darkSide ? o.light : o.dark, angle: darkSide ? 0 : Math.PI / 2, seed: seedInt + (darkSide ? 2 : 1), sheen: o.sheen, light: la }); col = col.map((v, k) => (darkSide ? v * a + other[k] * (1 - a) : other[k] * a + v * (1 - a))); }
      col = col.map((v, k) => v * (1 - e) + glue[k] * e);
    }
    if (pinD >= 0 && pinD < 0.012) col = col.map((v, k) => v * 0.6 + glue[k] * 0.4);
    const vig = 0.9 + 0.1 * Math.cos(((x / w - 0.42) * Math.PI) * 0.9) * Math.cos(((y / h - 0.4) * Math.PI) * 0.9), inset = fw ? clamp((Math.min(x - fw, y - fw, w - fw - x, h - fw - y)) / (fw * 0.35)) : 1;
    R.data[p] = col[0] * vig * (0.7 + 0.3 * inset); R.data[p + 1] = col[1] * vig * (0.7 + 0.3 * inset); R.data[p + 2] = col[2] * vig * (0.7 + 0.3 * inset); R.data[p + 3] = 1;
  }
  return R;
}

// A mitred walnut frame: grain runs along each side; a lit bevel on the inner edge.
function frameAt(x, y, w, h, fw, seed) {
  const dl = x, dr = w - 1 - x, dt = y, db = h - 1 - y, m = Math.min(dl, dr, dt, db), horiz = m === dt || m === db;
  const col = wood(x, y, { species: 'walnut', angle: horiz ? 0 : Math.PI / 2, seed: seed + 11, sheen: 0.2 });
  const inner = clamp((m - fw * 0.78) / (fw * 0.22)), lit = (m === dt || m === dl) ? 1.25 : 0.72;
  return col.map((v) => v * (1 + (lit - 1) * inner) * (0.85 + 0.15 * clamp(m / (fw * 0.2))));
}
