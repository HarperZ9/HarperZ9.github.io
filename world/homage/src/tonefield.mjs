// src/tonefield.mjs: a tone field rebuilt from a likeness descriptor (descriptors/<key>.json), never from the photo.
//
// The descriptor holds a 20 x 25 grid of lightness masses, a grid of form directions and six hand-read landmarks.
// This module draws a new field at plate resolution from those numbers:
//   1. masses: the grid upsampled with a Catmull-Rom (bicubic) kernel, then softened by low-frequency fbm so cell
//      edges never show;
//   2. features drawn by hand-rules at the landmarks: eye sockets and pupils, the shadow under the nose, the line of
//      the mouth. These are an illustrator's conventions, the same for every sitter, placed by the measured points;
//   3. a vignette: the figure fades into bare paper along an ellipse from crown to chin with a torn, fbm-shaped edge,
//      as engraved book portraits do. The background of the reference is not kept.
// Output: { w, h, tone (0 ink-dark .. 1 paper-light), tx, ty (unit tangent along the form), coh, mask, marks (px) }.
import { rng } from './raster.mjs';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x, y, s = 0, oct = 4) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return v / n; }

function cubic(p0, p1, p2, p3, t) { return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0))); }
// Bicubic sample of a gx x gy grid at u, v in 0..1 (cell centres at (i + 0.5) / gx).
export function bicubic(g, gx, gy, u, v) {
  const x = u * gx - 0.5, y = v * gy - 0.5, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const at = (i, j) => g[clamp(j, 0, gy - 1) * gx + clamp(i, 0, gx - 1)];
  const r = [];
  for (let j = -1; j <= 2; j++) r.push(cubic(at(xi - 1, yi + j), at(xi, yi + j), at(xi + 1, yi + j), at(xi + 2, yi + j), fx));
  return cubic(r[0], r[1], r[2], r[3], fy);
}

const gauss = (dx, dy, sx, sy) => Math.exp(-0.5 * ((dx * dx) / (sx * sx) + (dy * dy) / (sy * sy)));

export function toneField(desc, w, h, o = {}) {
  const [gx, gy] = desc.grid, seed = o.seed ?? 5;
  const m = Object.fromEntries(Object.entries(desc.marks).map(([k, [u, v]]) => [k, [u * w, v * h]]));
  // flow as doubled-angle vectors so interpolation never flips across +-90 degrees
  const c2 = desc.flow.angle.map((a, i) => Math.cos(2 * a) * desc.flow.coherence[i]), s2 = desc.flow.angle.map((a, i) => Math.sin(2 * a) * desc.flow.coherence[i]);
  const eyeW = Math.hypot(m.eyeR[0] - m.eyeL[0], m.eyeR[1] - m.eyeL[1]);
  const headH = Math.max(eyeW * 1.6, m.chin[1] - m.crown[1]);
  const cx = (m.eyeL[0] + m.eyeR[0] + m.nose[0]) / 3, cy = (m.crown[1] + m.chin[1]) / 2;
  const ry = headH * 0.5 * (o.vignette ?? 1.22), rx = Math.max(ry * 0.74, eyeW * 1.9);
  const n = w * h, tone = new Float32Array(n), tx = new Float32Array(n), ty = new Float32Array(n), coh = new Float32Array(n), mask = new Float32Array(n);
  const contrast = o.contrast ?? 1.15, lift = o.lift ?? 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = (y + 0.5) / h, i = y * w + x;
    let t = bicubic(desc.tone, gx, gy, u, v);
    t += (fbm(u * 3, v * 3, seed, 3) - 0.5) * 0.12;
    // features
    for (const e of [m.eyeL, m.eyeR]) {
      t -= 0.24 * gauss(x - e[0], y - e[1], eyeW * 0.2, eyeW * 0.13);
      t -= 0.3 * gauss(x - e[0], y - e[1], eyeW * 0.045, eyeW * 0.045);
      t -= 0.12 * gauss(x - e[0], y - (e[1] - eyeW * 0.2), eyeW * 0.24, eyeW * 0.05);
    }
    t -= 0.2 * gauss(x - m.nose[0], y - (m.nose[1] + eyeW * 0.06), eyeW * 0.17, eyeW * 0.05);
    t -= 0.26 * gauss(x - m.mouth[0], y - m.mouth[1], eyeW * 0.26, eyeW * 0.035);
    t = 0.5 + (t - 0.5) * contrast + lift;
    // vignette: an ellipse with a torn edge, falling to bare paper
    const ex = (x - cx) / rx, ey = (y - cy) / ry, r = Math.sqrt(ex * ex + ey * ey);
    const edge = 1 + (fbm(x / (w * 0.22), y / (h * 0.22), seed + 3, 3) - 0.5) * 0.34;
    const k = 1 - smooth(edge * 0.62, edge * 1.0, r);
    mask[i] = k; tone[i] = clamp(1 - (1 - clamp(t)) * k * k);
    // form direction
    const a = bicubic(c2, gx, gy, u, v), b = bicubic(s2, gx, gy, u, v), ang = 0.5 * Math.atan2(b, a);
    tx[i] = Math.cos(ang); ty[i] = Math.sin(ang); coh[i] = clamp(Math.hypot(a, b));
  }
  return { w, h, tone, tx, ty, coh, mask, marks: m, eyeW, head: { cx, cy, rx, ry }, rand: rng(seed) };
}

export function sampleF(f, arr, x, y) {
  const xi = clamp(Math.floor(x), 0, f.w - 2), yi = clamp(Math.floor(y), 0, f.h - 2), fx = clamp(x - xi), fy = clamp(y - yi), i = yi * f.w + xi;
  return arr[i] * (1 - fx) * (1 - fy) + arr[i + 1] * fx * (1 - fy) + arr[i + f.w] * (1 - fx) * fy + arr[i + f.w + 1] * fx * fy;
}
