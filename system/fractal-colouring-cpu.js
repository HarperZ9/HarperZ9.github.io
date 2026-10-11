// fractal-colouring-cpu.js: the CPU twin of the colouring layer, for the three classic sets.
//
// fractal.js keeps its own fast kernels for the default (smooth) colouring, which the preset
// tests pin. Any other colouring comes here: one kernel for the Mandelbrot, Julia and Burning Ship
// that also gathers the orbit statistics (traps, the triangle inequality average) and keeps the
// derivative's magnitude for the distance estimate, then colourizeCPU(), line for line the GLSL
// colourize() in fractal-colouring.js. Histogram equalisation runs as two passes over the frame.

import { preparePalette, rampLinear, relief, reliefDir, encodeChannel, ditherOffset, trapWeight, holdGamut } from "./fractal-color.js";
import { colourSettings, MODE_INDEX } from "./fractal-colouring.js";

const BAILOUT2 = 65536, LN2 = Math.LN2;

function iterate(type, x, y, jx, jy, maxIter, s) {
  const julia = type === "julia", ship = type === "burningship";
  let zr = julia ? x : 0, zi = julia ? y : 0;
  const cr = julia ? jx : x, ci = julia ? jy : y;
  let dre = julia ? 1 : 0, dim = 0, ere = 0, eim = julia ? 1 : 0, seed = julia ? 0 : 1, dk = 0;
  let n = 0;
  let pt = Infinity, ln = Infinity, cross = Infinity, tia = 0, tiaPrev = 0, tiaN = 0, imgHit = false, ix = 0, iy = 0;
  const cl = Math.hypot(cr, ci);
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    const pr = zr, pi = zi;
    if (ship) {
      const sx = zr < 0 ? -1 : 1, sy = zi < 0 ? -1 : 1, ar = Math.abs(zr), ai = Math.abs(zi);
      const fdr = sx * dre, fdi = sy * dim, fer = sx * ere, fei = sy * eim;
      dre = 2 * (ar * fdr - ai * fdi) + seed; dim = 2 * (ar * fdi + ai * fdr);
      ere = 2 * (ar * fer - ai * fei); eim = 2 * (ar * fei + ai * fer) + seed;
      const t = ar * ar - ai * ai + cr; zi = 2 * ar * ai + ci; zr = t;
    } else {
      const d1 = 2 * (zr * dre - zi * dim) + seed, d2 = 2 * (zr * dim + zi * dre);
      dre = d1; dim = d2;
      const t = zr * zr - zi * zi + cr; zi = 2 * zr * zi + ci; zr = t;
    }
    // The orbit statistics, as orbitStep() in the GLSL.
    const dx = zr - s.trapP[0], dy = zi - s.trapP[1];
    pt = Math.min(pt, dx * dx + dy * dy);
    ln = Math.min(ln, Math.abs(dx * s.trapDir[1] - dy * s.trapDir[0]));
    cross = Math.min(cross, Math.min(Math.abs(zr), Math.abs(zi)));
    if (Math.abs(dx) < s.trapSize && Math.abs(dy) < s.trapSize) { imgHit = true; ix = dx / (2 * s.trapSize) + 0.5; iy = dy / (2 * s.trapSize) + 0.5; }
    const zp2 = pr * pr + pi * pi, lo = Math.abs(zp2 - cl), hi = zp2 + cl;
    if (hi - lo > 1e-12) { tiaPrev = tia; tiaN++; tia += ((Math.hypot(zr, zi) - lo) / (hi - lo) - tia) / tiaN; }
    if (Math.max(dre * dre + dim * dim, ere * ere + eim * eim) > 1e18) { dre *= 1e-9; dim *= 1e-9; ere *= 1e-9; eim *= 1e-9; seed *= 1e-9; dk++; }
    n++;
  }
  return { n, zr, zi, dre, dim, gx: zr * dre + zi * dim, gy: ship ? zr * ere + zi * eim : zr * -dim + zi * dre, dk,
    pt, ln, cross, tia, tiaPrev, imgHit, ix, iy };
}

/** The GLSL colourize(), on the CPU. Writes linear light into col; returns false for the interior. */
export function colourizeCPU(lab, s, r, mu, shade, dePx, glow, cdf, col) {
  const m = s.mode, N = lab.length;
  const ramp = (t) => rampLinear(lab, t * s.density + s.offset, col);
  const sh = () => { col[0] *= shade; col[1] *= shade; col[2] *= shade; };
  if (m === 1) {
    ramp(Math.log2(Math.max(dePx, 1e-6)) * 0.6);
    const k = Math.min(1, Math.max(0, dePx)); const fade = k * k * (3 - 2 * k);
    col[0] *= shade * fade; col[1] *= shade * fade; col[2] *= shade * fade;
    return true;
  }
  if (m === 2) { ramp(-Math.log2(Math.sqrt(r.pt) + 1e-6) * 0.75); sh(); return true; }
  if (m === 3) { ramp(-Math.log2(r.ln + 1e-6) * 0.75); sh(); return true; }
  if (m === 4) { ramp(-Math.log2(r.cross + 1e-6) * 0.75); sh(); return true; }
  if (m === 5) {
    if (r.imgHit && s.imagePixels) {
      const { w, h, data } = s.imagePixels;
      const px = Math.min(w - 1, Math.max(0, Math.floor(r.ix * w))), py = Math.min(h - 1, Math.max(0, Math.floor((1 - r.iy) * h)));
      const i = (py * w + px) * 4;
      const dec = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      col[0] = dec(data[i]); col[1] = dec(data[i + 1]); col[2] = dec(data[i + 2]);
      return true;
    }
    ramp(mu / 8); col[0] *= shade * 0.35; col[1] *= shade * 0.35; col[2] *= shade * 0.35;
    return true;
  }
  if (m === 6) {
    const f = Math.min(1, Math.max(0, 1 + Math.log2(5.5451774 / Math.max(Math.log(Math.hypot(r.zr, r.zi)), 1e-6))));
    ramp((r.tiaPrev + (r.tia - r.tiaPrev) * f) * 12); sh(); return true;
  }
  if (m === 7 && cdf) { rampLinear(lab, cdf(mu) * N * s.density + s.offset, col); sh(); return true; }
  ramp(mu / 8);
  col[0] = col[0] * shade + glow[0]; col[1] = col[1] * shade + glow[1]; col[2] = col[2] * shade + glow[2];
  return true;
}

/** Render a classic set with a non-default colouring on the CPU. */
export function renderColouredCPU(canvas, opts, pal) {
  const { type = "mandelbrot", cx = -0.5, cy = 0, scale = 3.5, maxIter = 300, jx = -0.8, jy = 0.156 } = opts;
  const s = colourSettings(opts);
  const { lab, tint } = preparePalette(pal);
  const W = canvas.width, H = canvas.height, aspect = H / W;
  const flipY = type === "burningship" ? -1 : 1;
  const pixel = scale / W;
  const res = new Array(W * H);
  const mus = [];
  for (let py = 0; py < H; py++) {
    const y0 = cy - flipY * (py / H - 0.5) * scale * aspect;
    for (let px = 0; px < W; px++) {
      const r = iterate(type, cx + (px / W - 0.5) * scale, y0, jx, jy, maxIter, s);
      if (r.n < maxIter) {
        const log_r = 0.5 * Math.log(r.zr * r.zr + r.zi * r.zi);
        r.mu = r.n - Math.log(log_r / LN2) / LN2;
        r.log_r = log_r;
        mus.push(r.mu);
      }
      res[py * W + px] = r;
    }
  }
  let cdf = null;
  if (s.mode === MODE_INDEX.histogram && mus.length) {
    const sorted = Float64Array.from(mus).sort();
    cdf = (mu) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= mu) lo = m + 1; else hi = m; } return lo / sorted.length; };
  }
  const buf = new Uint8ClampedArray(W * H * 4);
  const buf32 = new Uint32Array(buf.buffer);
  const col = [0, 0, 0], glow = [0, 0, 0];
  for (let p = 0; p < W * H; p++) {
    const r = res[p];
    if (r.n >= maxIter) { buf32[p] = 0xff000000; continue; }
    const shade = type === "burningship" ? reliefDir(r.gx, r.gy) : relief(r.zr, r.zi, r.dre, r.dim);
    const dmag = Math.hypot(r.dre, r.dim);
    const dePx = Math.pow(2, Math.log2(0.5 * Math.exp(r.log_r) * r.log_r) - Math.log2(Math.max(dmag, 1e-300)) - r.dk * 29.8973529 - Math.log2(pixel));
    const gw = trapWeight(Math.exp(-r.cross * 4) * 0.30);
    glow[0] = tint[0] * gw; glow[1] = tint[1] * gw; glow[2] = tint[2] * gw;
    colourizeCPU(lab, s, r, r.mu, shade, dePx, glow, cdf, col);
    holdGamut(col);
    const d = ditherOffset(p % W, (p / W) | 0);
    buf32[p] = (0xff << 24) | (encodeChannel(col[2], d) << 16) | (encodeChannel(col[1], d) << 8) | encodeChannel(col[0], d);
  }
  canvas.getContext("2d", { willReadFrequently: true }).putImageData(new ImageData(buf, W, H), 0, 0);
}
