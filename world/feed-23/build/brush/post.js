// brush/post.js: passes over a finished surface. Bloom lets bright light bleed into the dark (screen-like add of
// a blurred highlight layer); reflect mirrors the sky into still water with a horizontal shimmer and a darkening.
import { linear, gradNoise } from './core.js';

// Three box blurs approximate a gaussian. In place on a Float32Array of n channels, w x h.
function boxBlur(src, w, h, n, r) {
  const tmp = new Float32Array(src.length), k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 2; pass++) {
    const [a, b, horiz] = pass ? [tmp, src, false] : [src, tmp, true];
    const len = horiz ? w : h, lines = horiz ? h : w;
    for (let l = 0; l < lines; l++) for (let c = 0; c < n; c++) {
      const at = (p) => (horiz ? (l * w + Math.min(len - 1, Math.max(0, p))) : (Math.min(len - 1, Math.max(0, p)) * w + l)) * n + c;
      let s = 0; for (let p = -r; p <= r; p++) s += a[at(p)];
      for (let p = 0; p < len; p++) { b[at(p)] = s * k; s += a[at(p + r + 1)] - a[at(p - r)]; }
    }
  }
}

// bloom: pixels brighter than `threshold` (linear luminance) are blurred at `radius` (fraction of width) on a
// quarter-size buffer and added back, tinted. Light bleeds into the dark around the opening and the stars.
export function bloom(surface, { threshold = 0.35, radius = 0.03, strength = 0.6, tint = '#c9c8ff' } = {}) {
  const { w, h, px } = surface, f = 4, bw = Math.ceil(w / f), bh = Math.ceil(h / f), buf = new Float32Array(bw * bh * 3), t = linear(tint);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, L = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2], e = Math.max(0, L - threshold);
    if (e <= 0) continue;
    const o = (Math.floor(y / f) * bw + Math.floor(x / f)) * 3, k = e / (L + 1e-6) / (f * f);
    buf[o] += px[i] * k; buf[o + 1] += px[i + 1] * k; buf[o + 2] += px[i + 2] * k;
  }
  const r = Math.max(1, Math.round((radius * w) / f));
  for (let p = 0; p < 3; p++) boxBlur(buf, bw, bh, 3, r);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // bilinear read of the blurred buffer
    const fx = Math.min(bw - 1.001, Math.max(0, x / f - 0.5)), fy = Math.min(bh - 1.001, Math.max(0, y / f - 0.5)), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const a = buf[(iy * bw + ix) * 3 + c], b = buf[(iy * bw + ix + 1) * 3 + c], cc = buf[((iy + 1) * bw + ix) * 3 + c], d = buf[((iy + 1) * bw + ix + 1) * 3 + c];
      const v = a + (b - a) * tx + (cc - a + (d - cc - b + a) * tx) * ty;
      const add = Math.min(1, v * strength * t[c]), al = px[i + 3], cur = al > 1e-6 ? px[i + c] / al : 0;
      px[i + c] = (cur + add * (1 - Math.min(1, cur))) * al; // screen: light bleeds into the dark without blowing what is already bright
    }
  }
  surface.dirty = { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  return surface;
}

// reflect: below `horizon` (fraction of height), each row shows the mirrored row above, shifted sideways by a
// shimmer that grows with distance from the shore, darkened by `dim`, mixed over the water at `mix`.
export function reflect(surface, { horizon = 0.78, dim = 0.55, mix = 0.8, shimmer = 0.012, seed = 7, water = '#0e0f16' } = {}) {
  const { w, h, px } = surface, hy = Math.round(horizon * h), src = px.slice(), wc = linear(water);
  for (let y = hy; y < h; y++) {
    const my = 2 * hy - y - 1; if (my < 0) break;
    const depth = (y - hy) / Math.max(1, h - hy);
    for (let x = 0; x < w; x++) {
      const sh = (gradNoise(x / (w * 0.004), y / (h * 0.0025), seed) - 0.5) * 2 * shimmer * w * (0.2 + depth);
      const sx = Math.min(w - 1, Math.max(0, Math.round(x + sh))), j = (my * w + sx) * 4, i = (y * w + x) * 4;
      const k = mix * (1 - depth * 0.5);
      for (let c = 0; c < 3; c++) px[i + c] = src[j + c] * dim * k + wc[c] * (1 - k);
      px[i + 3] = 1;
    }
  }
  surface.dirty = { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  return surface;
}
