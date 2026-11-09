// layer.mjs: the layer and the sheet of the compositor; compose.mjs is the public entry. A layer holds
// pixels; place() (alias blend) stacks one layer on another; mosaic() lays tiles; out() writes 8-bit or
// 16-bit RGBA with one measured grain layer.
//
// Our own API and code. Pixels are linear-light float RGB in the layout of the feed-24 rasteriser
// ({ w, h, px }), so its antialiased lines, rings and cells draw straight onto any layer. Every random
// choice comes from a seed: a layer's operators draw from rng(hash(seed, k)) with k counting up, so the
// same chain on the same seed gives the same pixels, bit for bit.
import { rng, toLin, toSrgb, hexLin, enc, hash, colour, gauss } from './px.mjs';
import { OPS } from './ops.mjs';

export { rng, toLin, toSrgb, hexLin, enc, hash, colour };

export class Layer {
  constructor(w, h, { px = null, a = null, seed = 1 } = {}) {
    if (!(w >= 1 && h >= 1)) throw new RangeError(`compose: layer size must be at least 1 x 1, got ${w} x ${h}`);
    this.w = w | 0; this.h = h | 0; this.px = px ?? new Float32Array(this.w * this.h * 3); this.a = a; this.seed = seed >>> 0; this.k = 0;
    this.meta = {};
  }
  rand() { return rng(hash(this.seed, ++this.k)); }
  fill(c) { const [r, g, b] = colour(c), p = this.px; for (let i = 0; i < p.length; i += 3) { p[i] = r; p[i + 1] = g; p[i + 2] = b; } return this; }
  clone() { const L = new Layer(this.w, this.h, { px: this.px.slice(), a: this.a?.slice() ?? null, seed: this.seed }); L.k = this.k; L.meta = { ...this.meta }; return L; }
  // sRGB luma at pixel i, 0..1 (Rec. 709 weights on encoded values, as a viewer reads it).
  luma(i) { const p = this.px, k = 3 * i; return 0.2126 * enc(p[k]) + 0.7152 * enc(p[k + 1]) + 0.0722 * enc(p[k + 2]); }
  lumaField() { const f = new Float32Array(this.w * this.h); for (let i = 0; i < f.length; i++) f[i] = this.luma(i); return f; }
  // Cut a rectangle out as a new layer (alpha kept), or paste one back in.
  crop(x, y, w, h) {
    const L = new Layer(w, h, { seed: hash(this.seed, x * 7919 + y) }), a = this.a ? new Float32Array(w * h) : null;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const sx = Math.min(this.w - 1, Math.max(0, x + i)), sy = Math.min(this.h - 1, Math.max(0, y + j)), s = sy * this.w + sx, d = j * w + i;
      L.px[3 * d] = this.px[3 * s]; L.px[3 * d + 1] = this.px[3 * s + 1]; L.px[3 * d + 2] = this.px[3 * s + 2]; if (a) a[d] = this.a[s];
    }
    L.a = a; return L;
  }
  // Composite layer L at (x, y). Modes act in linear light. Coverage = opacity x L.a x mask.
  place(L, x = 0, y = 0, { mode = 'normal', opacity = 1, mask = null } = {}) {
    const blend = MODES[mode]; if (!blend) throw new Error(`compose: unknown blend mode "${mode}"`);
    x = Math.round(x); y = Math.round(y);
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + L.w), y1 = Math.min(this.h, y + L.h), d = this.px, s = L.px;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      const li = (j - y) * L.w + (i - x), di = j * this.w + i;
      const c = opacity * (L.a ? L.a[li] : 1) * (mask ? mask[li] : 1); if (c <= 0) continue;
      for (let ch = 0; ch < 3; ch++) { const b = d[3 * di + ch], v = blend(b, s[3 * li + ch]); d[3 * di + ch] = b + (v - b) * c; }
    }
    return this;
  }
  // Hydra calls it blend; here it is place under a second name.
  blend(L, x = 0, y = 0, opts = {}) { return this.place(L, x, y, opts); }
  // Mosaic: a grid of square tiles at `pitch` px from (x, y). fill(i, j, w, h) returns a layer, a colour
  // or null (leave the ground). Tile edges are rounded so neighbours share edges with no seam or gap.
  // meta.tiles records each tile's box and what filled it.
  mosaic({ x, y, pitch, cols, rows, fill }) {
    const tiles = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = Math.round(x + i * pitch), y0 = Math.round(y + j * pitch), w = Math.round(x + (i + 1) * pitch) - x0, h = Math.round(y + (j + 1) * pitch) - y0;
      const f = fill(i, j, w, h); if (f == null) continue;
      const L = typeof f === 'string' || Array.isArray(f) ? new Layer(w, h).fill(f) : f;
      this.place(L, x0, y0); tiles.push({ i, j, x: x0, y: y0, w, h, kind: typeof f === 'string' ? f : 'layer', meta: L.meta });
    }
    this.meta.tiles = (this.meta.tiles ?? []).concat(tiles); return this;
  }
  // Export: linear to sRGB, then grain in sRGB code values, then a triangular dither and 8-bit rounding.
  // grain: { std (0..1 units), size (correlation length in px; 1 = per pixel), mono }. With size > 1 the
  // grain is white noise blurred to that length and rescaled to the exact std, so it stays isotropic.
  // Grain is the one noise on a sheet not tied to a generator.
  out({ grain = null, dither = true, depth = 8 } = {}) {
    const n = this.w * this.h, top = depth === 16 ? 65535 : 255, o = depth === 16 ? new Uint16Array(n * 4) : new Uint8ClampedArray(n * 4);
    const r = rng(hash(this.seed, 0x6a09e667)), std = grain?.std ?? 0, mono = grain?.mono ?? true, size = grain?.size ?? 1;
    const G = std && size > 1 ? grainField(this.w, this.h, size, r) : null;
    for (let i = 0; i < n; i++) {
      const g0 = G ? G[i] * std : std ? gauss(r) * std : 0;
      for (let c = 0; c < 3; c++) {
        const g = std ? (mono || G ? g0 : gauss(r) * std) : 0;
        const v = (enc(this.px[3 * i + c]) + g) * top + (dither ? r() - r() : 0);
        o[4 * i + c] = v < 0 ? 0 : v > top ? top : Math.round(v);
      }
      o[4 * i + 3] = top;
    }
    return o;
  }
}

// Unit-std noise with correlation length `size` px: white noise, three box passes, exact rescale.
export function grainField(w, h, size, r) {
  let a = new Float32Array(w * h); for (let i = 0; i < a.length; i++) a[i] = gauss(r);
  const rad = Math.max(1, Math.round(size / 2)), b = new Float32Array(w * h);
  const pass = (src, dst, horiz) => {
    const n = horiz ? w : h, m = horiz ? h : w, st = horiz ? 1 : w;
    for (let j = 0; j < m; j++) {
      const base = horiz ? j * w : j; let acc = 0;
      for (let k = -rad; k <= rad; k++) acc += src[base + Math.min(n - 1, Math.max(0, k)) * st];
      for (let i = 0; i < n; i++) { dst[base + i * st] = acc; acc += src[base + Math.min(n - 1, i + rad + 1) * st] - src[base + Math.max(0, i - rad) * st]; }
    }
  };
  for (let it = 0; it < 2; it++) { pass(a, b, true); pass(b, a, false); }
  let s2 = 0; for (let i = 0; i < a.length; i++) s2 += a[i] * a[i];
  const k = 1 / Math.sqrt(s2 / a.length || 1); for (let i = 0; i < a.length; i++) a[i] *= k;
  return a;
}

const ov = (b, s) => { const B = enc(b), S = enc(s), v = B < 0.5 ? 2 * B * S : 1 - 2 * (1 - B) * (1 - S); return toLin(v); };
export const MODES = {
  normal: (b, s) => s, multiply: (b, s) => b * s, screen: (b, s) => b + s - b * s, add: (b, s) => b + s,
  difference: (b, s) => Math.abs(b - s), darken: (b, s) => Math.min(b, s), lighten: (b, s) => Math.max(b, s), overlay: ov,
};

// Chain: every operator in ops.mjs becomes a method that replaces the layer's pixels and returns it.
for (const [name, fn] of Object.entries(OPS)) Layer.prototype[name] = function (...args) { fn(this, ...args); return this; };

export function layer(w, h, { fill = null, seed = 1 } = {}) { const L = new Layer(w, h, { seed }); return fill ? L.fill(fill) : L; }

// A sheet: the ground layer with a mat. inner() gives the art box inside the mat in pixels.
export function sheet(w, h, { ground = '#d4cebe', mat = 0.05, matColour = '#eeece5', seed = 1 } = {}) {
  const S = new Layer(w, h, { seed }).fill(matColour), m = Math.round(mat * Math.min(w, h));
  const inner = { x: m, y: m, w: w - 2 * m, h: h - 2 * m };
  S.place(new Layer(inner.w, inner.h).fill(ground), inner.x, inner.y);
  S.inner = inner; S.u = inner.w / 1000; // one sheet unit: a thousandth of the inner width
  return S;
}

export { OPS };
