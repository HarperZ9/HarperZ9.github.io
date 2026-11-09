// lib/living/fields.mjs: the pieces every living state shares. All fields are Float32Array, row-major, w x h pixels.
//   noise(w, h, scale, seed)        smooth value noise in [0, 1] (three octaves)
//   blur(src, w, h, r)              three box passes, a gaussian of radius r
//   tangents(G)                     per pixel, the direction of the nearest stroke centre line (unit x, y) and the
//                                   distance travelled along that stroke (arc, 0 at its start, 1 at its end)
//   linear(hex) / srgb8(v)          colour conversions (states paint in linear light)
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function hash(a, b, s = 0) { let h = (a * 374761393 + b * 668265263 + s * 2654435761) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function rng(seed) { let s = (hash(seed | 0, 77) * 4294967296) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

export function noise(w, h, scale = 8, seed = 1, octaves = 3) {
  const vn = (x, y, o) => { const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j, u = a * a * (3 - 2 * a), v = b * b * (3 - 2 * b);
    return (hash(i, j, seed + o) * (1 - u) + hash(i + 1, j, seed + o) * u) * (1 - v) + (hash(i, j + 1, seed + o) * (1 - u) + hash(i + 1, j + 1, seed + o) * u) * v; };
  const out = new Float32Array(w * h); let norm = 0, amp = 1; for (let o = 0; o < octaves; o++) { norm += amp; amp *= 0.5; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let f = 0, a = 1, sc = 1 / scale; for (let o = 0; o < octaves; o++) { f += a * vn(x * sc, y * sc, o); a *= 0.5; sc *= 2.1; }
    out[y * w + x] = f / norm;
  }
  return out;
}

export function blur(src, w, h, r) {
  const a = Float32Array.from(src), t = new Float32Array(a.length), R = Math.max(1, Math.round(r));
  const cx = (x) => (x < 0 ? 0 : x >= w ? w - 1 : x), cy = (y) => (y < 0 ? 0 : y >= h ? h - 1 : y);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -R; x <= R; x++) s += a[y * w + cx(x)]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * R + 1); s += a[y * w + cx(x + R + 1)] - a[y * w + cx(x - R)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -R; y <= R; y++) s += t[cy(y) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * R + 1); s += t[cy(y + R + 1) * w + x] - t[cy(y - R) * w + x]; } }
  }
  return a;
}

/** Directional smear: each pixel averages n samples back along its own (dx, dy) field, scaled by len px. */
export function smear(src, w, h, dx, dy, len, n = 8) {
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, L = typeof len === 'number' ? len : len[i]; let s = 0;
    for (let k = 0; k < n; k++) { const f = (k / (n - 1)) * L, sx = Math.round(x - dx[i] * f), sy = Math.round(y - dy[i] * f); s += sx >= 0 && sy >= 0 && sx < w && sy < h ? src[sy * w + sx] : 0; }
    out[i] = s / n;
  }
  return out;
}

export function tangents(G) {
  const { w, h } = G, tx = new Float32Array(w * h), ty = new Float32Array(w * h).fill(1), arc = new Float32Array(w * h), best = new Float32Array(w * h).fill(Infinity);
  for (const s of G.strokes.strokes) {
    const P = s.pts; if (P.length < 2) continue;
    let total = 0; const L = [0]; for (let i = 1; i < P.length; i++) { total += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); L.push(total); }
    const R = s.width * 0.9 + 2;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay] = P[i - 1], [bx, by] = P[i], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9, l = Math.sqrt(l2);
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - R)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + R)), y0 = Math.max(0, Math.floor(Math.min(ay, by) - R)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = clamp(((x - ax) * dx + (y - ay) * dy) / l2), d = Math.hypot(x - ax - t * dx, y - ay - t * dy), k = y * w + x;
        if (d < best[k] && d <= R) { best[k] = d; tx[k] = dx / l; ty[k] = dy / l; arc[k] = total ? (L[i - 1] + t * l) / total : 0; }
      }
    }
  }
  return { tx, ty, arc };
}

export function linear(hex) { const n = parseInt(hex.slice(1), 16); return [16, 8, 0].map((s) => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); }
export const srgb8 = (v) => Math.round(255 * clamp(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(clamp(v), 1 / 2.4) - 0.055));
export const PAPER = '#ebe5d8';
