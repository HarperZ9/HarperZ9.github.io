// Procedural paint-over: brush-stroke synthesis over a render, so the demo needs no outside art.
// Original code. The idea of painting a picture as layers of strokes from coarse to fine, each
// stroke taking its colour from a blurred reference and its direction across the local gradient,
// is Hertzmann's (SIGGRAPH 1998); the stroke renderer, object clipping, impasto relief, ink lines
// and grade here are written for this engine.
//
// paint(src, aux, opt): src { w, h, rgb Float32 (3 per pixel, 0..1) }, aux { id Uint8, N Float32 }
// (the render's object ids and normals). Strokes never cross an object boundary, so silhouettes
// stay crisp. Returns { w, h, rgb, rgba8 }.
import { pcg } from "../common.mjs";

const hash2 = (a, b, s) => pcg((a | 0) ^ pcg((b | 0) ^ pcg(s | 0))) / 4294967296;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
function blurPlane(src, w, h, sigma) {
  const r = Math.max(1, Math.ceil(3 * sigma)), k = new Float64Array(2 * r + 1);
  let s = 0; for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-0.5 * (i / sigma) ** 2); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * src[y * w + Math.min(w - 1, Math.max(0, x + i))]; tmp[y * w + x] = a; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -r; i <= r; i++) a += k[i + r] * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]; out[y * w + x] = a; }
  return out;
}
const planes = (rgb, n) => [0, 1, 2].map((c) => { const p = new Float32Array(n); for (let i = 0; i < n; i++) p[i] = rgb[i * 3 + c]; return p; });

// opt.mask (Uint8, optional): paint only where mask is set; every other pixel keeps src exactly
// (hole filling: the secondary painting continues the primary's picture).
export function paint(src, aux, { seed = 1, radii = [11, 6, 3.5, 2], ink = true, relief = 0.2, mask = null } = {}) {
  const { w, h } = src, n = w * h, ref0 = planes(src.rgb, n), lum = (P, i) => 0.3 * P[0][i] + 0.59 * P[1][i] + 0.11 * P[2][i];
  const on = (i) => !mask || mask[i] === 1;
  let canvas = ref0.map((p) => blurPlane(p, w, h, 9)), height = new Float32Array(n), layerNo = 0;
  if (mask) for (let c = 0; c < 3; c++) for (let i = 0; i < n; i++) if (!mask[i]) canvas[c][i] = ref0[c][i];
  for (const r of radii) {
    const ref = ref0.map((p) => blurPlane(p, w, h, r * 0.5)), L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = lum(ref, i);
    const Lb = blurPlane(L, w, h, Math.max(1.2, r * 0.6)), gx = new Float32Array(n), gy = new Float32Array(n);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; gx[i] = Lb[i + 1] - Lb[i - 1]; gy[i] = Lb[i + w] - Lb[i - w]; }
    const grid = Math.max(2, Math.round(r * 0.9)), cx = Math.ceil(w / grid), cy = Math.ceil(h / grid), order = Array.from({ length: cx * cy }, (_, k) => k);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(hash2(k, layerNo, seed) * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const T = layerNo === 0 ? -1 : 0.05 - 0.008 * layerNo, tolStroke = 0.34 - 0.06 * layerNo;
    for (const cell of order) {
      const gx0 = (cell % cx) * grid, gy0 = Math.floor(cell / cx) * grid, x1 = Math.min(w, gx0 + grid), y1 = Math.min(h, gy0 + grid);
      let err = 0, best = -1, bestE = -1, cnt = 0;
      for (let y = gy0; y < y1; y++) for (let x = gx0; x < x1; x++) { const i = y * w + x; if (!on(i)) continue; const e = (Math.abs(canvas[0][i] - ref[0][i]) + Math.abs(canvas[1][i] - ref[1][i]) + Math.abs(canvas[2][i] - ref[2][i])) / 3; err += e; cnt++; if (e > bestE) { bestE = e; best = i; } }
      if (cnt === 0 || err / cnt <= T) continue;
      const bx = best % w, by = (best / w) | 0, sid = aux.id[best], u = hash2(bx, by, seed + layerNo * 7), vj = (hash2(bx, by, seed + 99) - 0.5) * 0.06, hj = (hash2(bx, by, seed + 5) - 0.5) * 0.05;
      const col = [sat(ref[0][best] * (1 + vj + hj)), sat(ref[1][best] * (1 + vj)), sat(ref[2][best] * (1 + vj - hj))];
      // direction: across the gradient when there is one, else along the object's own grain plus noise
      const gm = Math.hypot(gx[best], gy[best]);
      let ang = gm > 0.004 ? Math.atan2(gy[best], gx[best]) + Math.PI / 2 : (aux.N[best * 3 + 1] > 0.7 ? 0.45 : 1.45) + (vnoise(bx * 0.05, by * 0.05, seed) - 0.5) * 1.2;
      ang += (u - 0.5) * 0.35;
      const dx = Math.cos(ang), dy = Math.sin(ang), maxLen = r * (2.0 + 1.4 * u);
      const march = (sgn) => { let t = 0; for (; t < maxLen; t++) { const px = Math.round(bx + sgn * dx * (t + 1)), py = Math.round(by + sgn * dy * (t + 1)); if (px < 0 || py < 0 || px >= w || py >= h) break; const j = py * w + px; if (aux.id[j] !== sid || !on(j) || Math.abs(src.rgb[j * 3] - col[0]) + Math.abs(src.rgb[j * 3 + 1] - col[1]) + Math.abs(src.rgb[j * 3 + 2] - col[2]) > tolStroke) break; } return t; };
      const t1 = march(-1), t2 = march(1), ax = bx - dx * t1, ay = by - dy * t1, ex = bx + dx * t2, ey = by + dy * t2, sx = ex - ax, sy = ey - ay, sl = Math.max(1e-6, sx * sx + sy * sy);
      const halfW = r * 0.5 * (0.85 + 0.3 * hash2(bx, by, seed + 3)), pad = Math.ceil(halfW + 2), id0 = (hash2(bx, by, seed + 11) * 1000) | 0;
      for (let y = Math.max(0, Math.floor(Math.min(ay, ey)) - pad); y <= Math.min(h - 1, Math.ceil(Math.max(ay, ey)) + pad); y++) for (let x = Math.max(0, Math.floor(Math.min(ax, ex)) - pad); x <= Math.min(w - 1, Math.ceil(Math.max(ax, ex)) + pad); x++) {
        const i = y * w + x; if (aux.id[i] !== sid || !on(i)) continue;
        const tt = Math.min(1, Math.max(0, ((x - ax) * sx + (y - ay) * sy) / sl)), qx = ax + sx * tt - x, qy = ay + sy * tt - y, dist = Math.hypot(qx, qy);
        let a = sat((halfW - dist) / 1.2 + 0.5); if (a <= 0) continue;
        const perp = (x - ax) * -dy + (y - ay) * dx, stripe = 0.8 + 0.2 * vnoise(perp * (2.2 / Math.max(1, r * 0.35)), tt * sl * 0.0004 + id0, seed + 17);
        a *= stripe + 0.12;
        const shade = 0.95 + 0.1 * stripe;
        for (let c = 0; c < 3; c++) canvas[c][i] = canvas[c][i] * (1 - a) + sat(col[c] * shade) * a;
        height[i] = height[i] * (1 - a) + a * (stripe * (0.55 + 0.45 * (1 - dist / halfW)) + layerNo * 0.0);
      }
    }
    layerNo++;
  }
  // impasto relief: light the stroke height from the upper left
  const rgb = new Float32Array(n * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!on(i)) { for (let c = 0; c < 3; c++) rgb[i * 3 + c] = canvas[c][i]; continue; }
    const hx = height[Math.min(w - 1, x + 1) + y * w] - height[Math.max(0, x - 1) + y * w], hy = height[x + Math.min(h - 1, y + 1) * w] - height[x + Math.max(0, y - 1) * w];
    const lit = 1 + relief * (-0.8 * hx - 0.6 * hy), tooth = 0.965 + 0.035 * vnoise(x * 1.1, y * 1.1, seed + 41);
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = canvas[c][i] * lit * tooth;
  }
  if (ink) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wx = x + (vnoise(x * 0.09, y * 0.09, seed + 71) - 0.5) * 3, wy = y + (vnoise(x * 0.09 + 9, y * 0.09, seed + 72) - 0.5) * 3;
      const at = (px, py) => { const X = Math.min(w - 1, Math.max(0, Math.round(px))), Y = Math.min(h - 1, Math.max(0, Math.round(py))); return Y * w + X; };
      const a = at(wx, wy), b = at(wx + 1.2, wy), c2 = at(wx, wy + 1.2);
      let line = 0;
      if (aux.id[a] !== aux.id[b] || aux.id[a] !== aux.id[c2]) line = 0.8;
      else if (aux.id[a] !== 255) { const d1 = aux.N[a * 3] * aux.N[b * 3] + aux.N[a * 3 + 1] * aux.N[b * 3 + 1] + aux.N[a * 3 + 2] * aux.N[b * 3 + 2], d2 = aux.N[a * 3] * aux.N[c2 * 3] + aux.N[a * 3 + 1] * aux.N[c2 * 3 + 1] + aux.N[a * 3 + 2] * aux.N[c2 * 3 + 2]; if (Math.min(d1, d2) < 0.75) line = 0.5; }
      if (line > 0 && on(y * w + x)) { const i = y * w + x, k = line * (0.75 + 0.25 * vnoise(x * 0.4, y * 0.4, seed + 73)); rgb[i * 3] = rgb[i * 3] * (1 - k) + 0.1 * k; rgb[i * 3 + 1] = rgb[i * 3 + 1] * (1 - k) + 0.07 * k; rgb[i * 3 + 2] = rgb[i * 3 + 2] * (1 - k) + 0.09 * k; }
    }
  }
  const rgba8 = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) rgba8[i * 4 + c] = Math.round(sat(rgb[i * 3 + c]) * 255); rgba8[i * 4 + 3] = 255; }
  return { w, h, rgb, rgba8 };
}
