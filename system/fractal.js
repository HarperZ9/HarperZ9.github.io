// fractal.js: zero-dep escape-time fractals for the Studio, on the CPU.
// Mandelbrot (smooth + orbit-trap glow + relief), Julia, Burning Ship.
// Renders into a canvas via a typed-array + putImageData (single call).
//
// This is the gated reference: fractal-gl.js draws the same image on the GPU and the Studio prefers
// it, but every preset is rendered through THIS path in system/fractal.test.mjs, and the colour
// recipe both paths follow lives in fractal-color.js. Palettes from
// project-docs/research/fractal-studio/aesthetics-digest.md; presets in fractal-presets.js.

import { preparePalette, rampLinear, relief, encodeChannel, ditherOffset, trapWeight, holdGamut,
         DERIV_RESCALE_AT, DERIV_RESCALE_BY } from "./fractal-color.js";

const LOG2 = Math.log(2);
// Bailout R=256 (R^2=65536), needed for the smooth-coloring formula to be accurate.
const BAILOUT = 256;
const BAILOUT2 = BAILOUT * BAILOUT;

// ── Core math ──────────────────────────────────────────────────────────────

// Standard Mandelbrot escape-time. bailout param kept for test compat; internal
// renders use BAILOUT=256 for smooth coloring.
export function escapeTime(cre, cim, maxIter, bailout = 4) {
  let zr = 0, zi = 0, n = 0;
  const b2 = bailout * bailout;
  while (n < maxIter && zr * zr + zi * zi <= b2) {
    const t = zr * zr - zi * zi + cre;
    zi = 2 * zr * zi + cim;
    zr = t;
    n++;
  }
  return { n, zr, zi };
}

// Smooth (normalized) iteration count, which eliminates integer banding.
// Formula: n + 1 - log(log|z|) / log2  (Quilez / van Nieuwpoort).
// Returns n unchanged if |z| <= 1 or non-finite (interior / edge cases).
export function smoothMu(n, zr, zi) {
  const m = Math.sqrt(zr * zr + zi * zi);
  if (m <= 1 || !Number.isFinite(m)) return n;
  return n + 1 - Math.log(Math.log(m)) / LOG2;
}

// ── Iteration kernels ──────────────────────────────────────────────────────

// All three kernels carry the orbit derivative dz/dc alongside z (Cheritat / Robert Munafo), which
// is what relief() shades from. `dseed` is the derivative's additive term; it is rescaled with dz
// whenever dz grows large, which keeps the ratio z/dz that the shading reads exact while stopping dz
// from running away. The same rescale runs in the GLSL kernels at the same threshold.
function iterMandelbrot(cre, cim, maxIter) {
  let zr = 0, zi = 0, n = 0;
  let dre = 0, dim = 0, dseed = 1;
  let trap = Infinity;                       // cross orbit trap: min(|re|,|im|)
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    // Update derivative: dz_{n+1} = 2*z_n*dz_n + 1
    const dre2 = 2 * (zr * dre - zi * dim) + dseed;
    const dim2 = 2 * (zr * dim + zi * dre);
    dre = dre2; dim = dim2;
    // Update z: z_{n+1} = z_n^2 + c
    const t = zr * zr - zi * zi + cre;
    zi = 2 * zr * zi + cim;
    zr = t;
    // Cross orbit trap (aesthetics-digest §4, "single highest-leverage technique")
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    if (dre * dre + dim * dim > DERIV_RESCALE_AT) {
      dre *= DERIV_RESCALE_BY; dim *= DERIV_RESCALE_BY; dseed *= DERIV_RESCALE_BY;
    }
    n++;
  }
  return { n, zr, zi, dre, dim, trap };
}

// Julia: the seed is the pixel and c is fixed, so the derivative is dz/dz0. It starts at 1 and has
// no additive term, because dc/dz0 is zero.
function iterJulia(x, y, jx, jy, maxIter) {
  let zr = x, zi = y, n = 0;
  let dre = 1, dim = 0;
  let trap = Infinity;
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    const dre2 = 2 * (zr * dre - zi * dim);
    const dim2 = 2 * (zr * dim + zi * dre);
    dre = dre2; dim = dim2;
    const t = zr * zr - zi * zi + jx;
    zi = 2 * zr * zi + jy;
    zr = t;
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    if (dre * dre + dim * dim > DERIV_RESCALE_AT) {
      dre *= DERIV_RESCALE_BY; dim *= DERIV_RESCALE_BY;
    }
    n++;
  }
  return { n, zr, zi, dre, dim, trap };
}

// Burning Ship folds |z| each step, so the map is not holomorphic and this is the sign-folded chain
// rule rather than a true complex derivative. It picks a shading direction; it is never used to
// estimate a distance.
function iterBurningShip(cre, cim, maxIter) {
  let zr = 0, zi = 0, n = 0;
  let dre = 0, dim = 0, dseed = 1;
  let trap = Infinity;
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    if (zr < 0) dre = -dre;
    if (zi < 0) dim = -dim;
    const ar = Math.abs(zr), ai = Math.abs(zi);
    const dre2 = 2 * (ar * dre - ai * dim) + dseed;
    const dim2 = 2 * (ar * dim + ai * dre);
    dre = dre2; dim = dim2;
    const t = ar * ar - ai * ai + cre;
    zi = 2 * ar * ai + cim;
    zr = t;
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    if (dre * dre + dim * dim > DERIV_RESCALE_AT) {
      dre *= DERIV_RESCALE_BY; dim *= DERIV_RESCALE_BY; dseed *= DERIV_RESCALE_BY;
    }
    n++;
  }
  return { n, zr, zi, dre, dim, trap };
}

// ── Palettes ────────────────────────────────────────────────────────────────
// From aesthetics-digest.md, all 4+ ramps as [r,g,b] stop arrays.

// Ramp 1, Ember (deep zoom fractals, high contrast)
const PAL_EMBER = [
  [0x0d,0x02,0x08], [0x3b,0x0a,0x1f], [0x8b,0x1a,0x2e],
  [0xe0,0x5a,0x1a], [0xf7,0xc5,0x50], [0xff,0xfb,0xe8],
];

// Ramp 2, Ocean Trench (deep zoom, calm + structural; best for minibrots)
const PAL_OCEAN = [
  [0x00,0x08,0x10], [0x00,0x22,0x44], [0x00,0x44,0x88],
  [0x00,0x77,0xb6], [0x00,0xb4,0xd8], [0xca,0xf0,0xf8],
];

// Ramp 4, Dusk Plasma (versatile; fractal boundary sings in violet-magenta zone)
const PAL_DUSK = [
  [0x0b,0x00,0x26], [0x2d,0x00,0x4e], [0x7b,0x00,0x80],
  [0xc7,0x32,0x80], [0xf7,0x8c,0x40], [0xff,0xfa,0xaa],
];

// Ramp 6, Bone & Rust (poster, vintage; good for Burning Ship)
const PAL_BONE = [
  [0x1a,0x10,0x08], [0x3d,0x20,0x10], [0x8b,0x45,0x20],
  [0xc0,0x70,0x40], [0xe8,0xc0,0x90], [0xf5,0xea,0xd8],
];

// Ramp 7, Terminal Green (retro; strong for Julia dendrites)
const PAL_TERMINAL = [
  [0x00,0x00,0x00], [0x00,0x18,0x00], [0x00,0x38,0x00],
  [0x00,0x60,0x00], [0x00,0xaa,0x00], [0x88,0xff,0x88],
];

export const PALETTES = {
  ember:    PAL_EMBER,
  ocean:    PAL_OCEAN,
  dusk:     PAL_DUSK,
  bone:     PAL_BONE,
  terminal: PAL_TERMINAL,
};

// ── Presets ────────────────────────────────────────────────────
// The eighteen named views moved to fractal-presets.js. Re-exported here so every existing importer
// of PRESETS from this module keeps working.

export { PRESETS } from "./fractal-presets.js";

// ── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Draw one Mandelbrot / Julia / Burning Ship frame into `canvas` on the CPU.
 * opts: { type, cx, cy, scale, maxIter, palette, jx, jy }.
 *
 * The pixel recipe, in order: escape iteration with the orbit derivative, smooth (normalized)
 * iteration count, palette lookup by Catmull-Rom in linear light, cross orbit-trap glow toward the
 * lightest stop, Lambert relief from the derivative, then one encode to display values with a
 * triangular dither. Every step has a named twin in fractal-glsl-lib.js, which is how the GPU frame
 * and this one stay the same image.
 */
export function renderFractal(canvas, opts) {
  const {
    type = "mandelbrot",
    cx = -0.5, cy = 0,
    scale = 3.5,
    maxIter = 300,
    palette = "ocean",
    jx = -0.8, jy = 0.156,
  } = opts || {};

  const pal = PALETTES[palette] || PAL_OCEAN;
  const { lab, tint: glowTint } = preparePalette(pal);   // stops in OKLab, plus the lightest in linear
  const W = canvas.width, H = canvas.height;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const aspect = H / W;

  // Use Uint32Array for single 4-byte write per pixel (ABGR little-endian).
  const buf = new Uint8ClampedArray(W * H * 4);
  const buf32 = new Uint32Array(buf.buffer);

  // Orbit-trap glow: cross trap (aesthetics-digest "make it special" move #3)
  // at 30% opacity blended over smooth-coloring base.
  const TRAP_OPACITY = 0.30;
  const col = [0, 0, 0];                      // scratch, so the pixel loop allocates nothing

  // Burning Ship: negate im (Wikipedia: "virtually all images reflected vertically")
  const flipY = type === "burningship" ? -1 : 1;

  for (let py = 0; py < H; py++) {
    const y0 = cy + flipY * (py / H - 0.5) * scale * aspect;

    for (let px = 0; px < W; px++) {
      const x0 = cx + (px / W - 0.5) * scale;

      let r;
      if (type === "julia")            r = iterJulia(x0, y0, jx, jy, maxIter);
      else if (type === "burningship") r = iterBurningShip(x0, y0, maxIter);
      else                             r = iterMandelbrot(x0, y0, maxIter);

      const idx = py * W + px;

      if (r.n >= maxIter) {
        buf32[idx] = 0xff000000;              // interior: black, and no dither on it
        continue;
      }

      // Smooth coloring (R=256 bailout used in iter kernels)
      const r2 = r.zr * r.zr + r.zi * r.zi;
      const log_r = Math.log(r2) * 0.5;        // log|z|
      const mu = r.n - Math.log(log_r / Math.LN2) / Math.LN2;

      // Base colour from smooth mu, cycled over the palette every 8 iterations for visual density.
      rampLinear(lab, mu / 8, col);

      // Relief shades the base; the cross trap then ADDS light on top. Both act on radiance, so the
      // shading cannot shift hue, and the glow cannot drain one. trapWeight() carries the authored
      // 0.30 across from code values, where it was drawn, into the radiance this line composites in.
      const glow = trapWeight(Math.exp(-r.trap * 4) * TRAP_OPACITY);
      const shade = relief(r.zr, r.zi, r.dre, r.dim);
      col[0] = col[0] * shade + glowTint[0] * glow;
      col[1] = col[1] * shade + glowTint[1] * glow;
      col[2] = col[2] * shade + glowTint[2] * glow;
      holdGamut(col);
      const d = ditherOffset(px, py);
      const cr = encodeChannel(col[0], d);
      const cg = encodeChannel(col[1], d);
      const cb = encodeChannel(col[2], d);

      // ABGR on little-endian
      buf32[idx] = (0xff << 24) | (cb << 16) | (cg << 8) | cr;
    }
  }

  const imgData = new ImageData(buf, W, H);
  g.putImageData(imgData, 0, 0);
}
