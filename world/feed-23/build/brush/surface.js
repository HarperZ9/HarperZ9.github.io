// brush/surface.js: the paint surface. Float32, linear light, premultiplied RGBA.
// Float accumulation is what keeps thousands of low-flow dabs from banding: an 8-bit canvas rounds every glaze,
// and the rounding error stacks into steps. Here nothing is rounded until export, and export dithers.
import { toSrgb, hash2 } from './core.js';
import { Grain } from './grain.js';

export class Surface {
  constructor(w, h) {
    if (!(w >= 1 && h >= 1)) throw new RangeError('surface: size must be at least 1 x 1');
    this.w = w | 0; this.h = h | 0; this.px = new Float32Array(this.w * this.h * 4); this.dabs = 0; this.dirty = null;
  }

  // Fill with an opaque linear colour, or a vertical gradient between two (top, bottom).
  fill(top, bottom = top) {
    const { w, h, px } = this;
    for (let y = 0; y < h; y++) {
      const t = h > 1 ? y / (h - 1) : 0, r = top[0] + (bottom[0] - top[0]) * t, g = top[1] + (bottom[1] - top[1]) * t, b = top[2] + (bottom[2] - top[2]) * t;
      for (let x = 0, i = y * w * 4; x < w; x++, i += 4) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 1; }
    }
    return this;
  }

  // The dab footprint: canvas pixel (x, y) to tip space (u, v). Major axis along `angle`, stretched by aspect.
  _frame(x, y, p) {
    const f = this._frame0(x, y, p), d = this.dirty;
    this.dirty = d ? { x0: Math.min(d.x0, f.x0), y0: Math.min(d.y0, f.y0), x1: Math.max(d.x1, f.x1), y1: Math.max(d.y1, f.y1) } : { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 };
    return f;
  }

  // Take and reset the changed rectangle (inclusive pixel bounds), for blitting only what a stroke touched.
  takeDirty() { const d = this.dirty; this.dirty = null; return d; }

  _frame0(x, y, p) {
    // below RMIN px the tip is sampled at RMIN and its alpha scaled by area, so tiny dabs keep their ink between pixels
    const RMIN = 1.25, r = Math.max(RMIN, p.radius), small = p.radius < RMIN ? (p.radius / RMIN) ** 2 : 1;
    const asp = Math.max(1, p.aspect ?? 1), c = Math.cos(p.angle ?? 0), s = Math.sin(p.angle ?? 0), ext = r * asp + 1;
    return { r, asp, c, s, small, x0: Math.max(0, Math.floor(x - ext)), x1: Math.min(this.w - 1, Math.ceil(x + ext)), y0: Math.max(0, Math.floor(y - ext)), y1: Math.min(this.h - 1, Math.ceil(y + ext)) };
  }

  // Small footprints cover few pixel centres, so point sampling over- or under-inks them depending on where the
  // dab lands. Scale so the sampled sum equals the tip's true integral: the same ink wherever the dab falls.
  _norm(tip, x, y, f) {
    let S = 0;
    for (let yy = f.y0; yy <= f.y1; yy++) for (let xx = f.x0; xx <= f.x1; xx++) {
      const dx = xx + 0.5 - x, dy = yy + 0.5 - y, u = (dx * f.c + dy * f.s) / (f.r * f.asp), v = (-dx * f.s + dy * f.c) / f.r;
      S += tip.sample(u, v);
    }
    const E = tip.integral * f.r * f.asp * f.r;
    return S > 1e-9 ? Math.min(4, E / S) : 0;
  }

  // Deposit one dab. p: { radius, aspect, angle, color: linear rgb, alpha, mode, grain, grainDepth,
  //   shade: { color: linear rgb, dir: [x, y] unit, lo, hi } } (shade: normal mode only)
  dab(tip, x, y, p) {
    const f = this._frame(x, y, p), { w, px } = this, col = p.color, mode = p.mode || 'normal';
    const gr = p.grain, gd = p.grainDepth ?? 0, sh = p.shade ? { lo: -0.3, hi: 0.85, ...p.shade } : null;
    let A = (p.alpha ?? 1) * f.small;
    if (f.r < 3) A *= this._norm(tip, x, y, f);
    for (let yy = f.y0; yy <= f.y1; yy++) {
      const dy = yy + 0.5 - y;
      for (let xx = f.x0; xx <= f.x1; xx++) {
        const dx = xx + 0.5 - x, u = (dx * f.c + dy * f.s) / (f.r * f.asp), v = (-dx * f.s + dy * f.c) / f.r;
        if (u * u + v * v > 2) continue;
        let a = tip.sample(u, v) * A;
        if (gr && gd) a *= 1 - gd + gd * 2 * gr.at(xx, yy); // mean 1: grain moves paint around, it does not thin it
        if (a <= 1e-5) continue;
        if (a > 1) a = 1;
        const i = (yy * w + xx) * 4;
        if (mode === 'normal') {
          const k = 1 - a;
          let c0 = col[0], c1 = col[1], c2 = col[2];
          if (sh) {
            // two-colour dab: shade from body to lit colour along the light direction, so one stamp is a lit lump
            let t = ((dx * sh.dir[0] + dy * sh.dir[1]) / (f.r * f.asp) - sh.lo) / (sh.hi - sh.lo); t = t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
            c0 += (sh.color[0] - c0) * t; c1 += (sh.color[1] - c1) * t; c2 += (sh.color[2] - c2) * t;
          }
          px[i] = c0 * a + px[i] * k; px[i + 1] = c1 * a + px[i + 1] * k; px[i + 2] = c2 * a + px[i + 2] * k; px[i + 3] = a + px[i + 3] * k;
        } else if (mode === 'add') {
          px[i] += col[0] * a; px[i + 1] += col[1] * a; px[i + 2] += col[2] * a; px[i + 3] = Math.max(px[i + 3], a);
        } else if (mode === 'screen') {
          for (let c = 0; c < 3; c++) { const s = col[c] * a; px[i + c] = px[i + c] + s - px[i + c] * s; }
          px[i + 3] = a + px[i + 3] * (1 - a);
        } else if (mode === 'erase') {
          const k = 1 - a; px[i] *= k; px[i + 1] *= k; px[i + 2] *= k; px[i + 3] *= k;
        } else throw new Error(`surface: unknown mode "${mode}"`);
      }
    }
    this.dabs++;
  }

  // Smudge: lay the finger's carried pixels down through the tip, then let the finger pick up what is there.
  // finger: { n, data: Float32Array(n*n*4), ready } ; p.strength 0..1 ; p.length 0..1 (how long it carries)
  smear(tip, x, y, p, finger) {
    const f = this._frame(x, y, p), { w, px } = this, n = finger.n, fd = finger.data, S = (p.strength ?? 0.8) * f.small;
    if (finger.ready) {
      for (let yy = f.y0; yy <= f.y1; yy++) {
        const dy = yy + 0.5 - y;
        for (let xx = f.x0; xx <= f.x1; xx++) {
          const dx = xx + 0.5 - x, u = (dx * f.c + dy * f.s) / (f.r * f.asp), v = (-dx * f.s + dy * f.c) / f.r;
          if (u < -1 || u > 1 || v < -1 || v > 1) continue;
          let a = tip.sample(u, v) * S;
          if (p.grain && p.grainDepth) a *= 1 - p.grainDepth + p.grainDepth * 2 * p.grain.at(xx, yy);
          if (a <= 1e-5) continue;
          if (a > 1) a = 1;
          // bilinear read of the finger: nearest leaves hard steps once a smear is wider than its 24 cells
          const fx = Math.min(n - 1.001, Math.max(0, (u * 0.5 + 0.5) * n - 0.5)), fy = Math.min(n - 1.001, Math.max(0, (v * 0.5 + 0.5) * n - 0.5));
          const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = (yy * w + xx) * 4;
          const i00 = (iy * n + ix) * 4, i10 = i00 + 4, i01 = i00 + n * 4, i11 = i01 + 4;
          for (let c = 0; c < 4; c++) {
            const top = fd[i00 + c] + (fd[i10 + c] - fd[i00 + c]) * tx, bot = fd[i01 + c] + (fd[i11 + c] - fd[i01 + c]) * tx;
            px[i + c] += (top + (bot - top) * ty - px[i + c]) * a;
          }
        }
      }
    }
    const keep = finger.ready ? (p.length ?? 0.85) : 0;
    for (let j = 0; j < n; j++) for (let i2 = 0; i2 < n; i2++) {
      const u = ((i2 + 0.5) / n) * 2 - 1, v = ((j + 0.5) / n) * 2 - 1;
      const cx = x + u * f.r * f.asp * f.c - v * f.r * f.s, cy = y + u * f.r * f.asp * f.s + v * f.r * f.c;
      const q = this.read(cx, cy), fi = (j * n + i2) * 4;
      for (let c = 0; c < 4; c++) fd[fi + c] = fd[fi + c] * keep + q[c] * (1 - keep);
    }
    finger.ready = true; this.dabs++;
  }

  // Film grain over the finished painting: monochrome, clumped (a gradient-noise texture at `period` px), scaled
  // so it moves each channel by about `amount` of its value. The quality spec (R4) asks for a correlation width of
  // 1.9 to 3.1 px at 1x, spectral centroid 0.18 to 0.24 cycles per px, chroma ratio under 0.45: one luminance field.
  filmGrain({ period = 2.6, amount = 0.006, seed = 29 } = {}) {
    // amount is in display units (about 1.5 code values at 0.006): the grain is added after a square-root lift,
    // so shadows carry it as visibly as highlights, as film grain does, instead of vanishing under a multiply
    const g = new Grain({ period: Math.max(1, period), kind: 'paper', seed }), { w, h, px } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = amount * 2 * (g.at(x, y) - 0.5), i = (y * w + x) * 4, a = px[i + 3];
      if (a <= 1e-6) continue;
      for (let c = 0; c < 3; c++) { const v = Math.sqrt(Math.max(0, px[i + c] / a)) + n; px[i + c] = v > 0 ? v * v * a : 0; }
    }
    return this;
  }

  // Premultiplied sample at a canvas point, clamped to the edge.
  read(x, y) {
    const xi = Math.min(this.w - 1, Math.max(0, Math.floor(x))), yi = Math.min(this.h - 1, Math.max(0, Math.floor(y))), i = (yi * this.w + xi) * 4, px = this.px;
    return [px[i], px[i + 1], px[i + 2], px[i + 3]];
  }

  // Mean colour under a disc (13 samples): what a wet brush picks up. Returns unpremultiplied rgb and alpha.
  pick(x, y, r) {
    let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
    const pts = [[0, 0]];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, rr = k % 2 ? 0.35 : 0.7; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    for (const [u, v] of pts) { const q = this.read(x + u * r, y + v * r); s0 += q[0]; s1 += q[1]; s2 += q[2]; s3 += q[3]; }
    const a = s3 / pts.length;
    return a > 1e-6 ? { rgb: [s0 / pts.length / a, s1 / pts.length / a, s2 / pts.length / a], a } : { rgb: [0, 0, 0], a: 0 };
  }

  // 8-bit sRGB, straight alpha, for a canvas. Triangular dither (two hashes) hides the last step of quantisation.
  // rect: optional { x0, y0, x1, y1 } inclusive; the result is that rectangle only, row-major.
  toRGBA8({ dither = true, seed = 7, rect = null } = {}) {
    const { w, px } = this, r = rect ?? { x0: 0, y0: 0, x1: w - 1, y1: this.h - 1 }, rw = r.x1 - r.x0 + 1, rh = r.y1 - r.y0 + 1;
    const out = new Uint8ClampedArray(rw * rh * 4);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const i = (y * w + x) * 4, o = ((y - r.y0) * rw + (x - r.x0)) * 4, a = Math.min(1, px[i + 3]), n = dither ? hash2(x, y, seed) - hash2(x, y, seed + 1) : 0;
      for (let c = 0; c < 3; c++) {
        const lin = a > 1e-6 ? Math.min(1, Math.max(0, px[i + c] / a)) : 0;
        out[o + c] = Math.round(toSrgb(lin) * 255 + n);
      }
      out[o + 3] = Math.round(a * 255 + (a > 0 && a < 1 ? n : 0)); // soft alpha edges (a halo on a transparent layer) get dither too
    }
    return out;
  }

  // 16-bit sRGB, straight alpha: the lossless master. Sixteen bits leave no visible steps, so no dither.
  toRGBA16() {
    const { w, h, px } = this, out = new Uint16Array(w * h * 4);
    for (let i = 0; i < w * h * 4; i += 4) {
      const a = Math.min(1, px[i + 3]);
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(toSrgb(a > 1e-6 ? Math.min(1, Math.max(0, px[i + c] / a)) : 0) * 65535);
      out[i + 3] = Math.round(a * 65535);
    }
    return out;
  }
}
