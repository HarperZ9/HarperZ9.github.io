// fractal.js: zero-dep escape-time fractals for the Studio, on the CPU.
// Mandelbrot (smooth + orbit-trap glow + relief), Julia, Burning Ship.
// Renders into a canvas via a typed-array + putImageData (single call).
//
// This is the gated reference: fractal-gl.js draws the same image on the GPU and the Studio prefers
// it, but every preset is rendered through THIS path in system/fractal.test.mjs, and the colour
// recipe both paths follow lives in fractal-color.js. Palettes from
// project-docs/research/fractal-studio/aesthetics-digest.md; presets in fractal-presets.js.

import { preparePalette, rampLinear, relief, reliefDir, encodeChannel, ditherOffset, trapWeight, holdGamut,
         DERIV_RESCALE_AT, DERIV_RESCALE_BY } from "./fractal-color.js";
import { chooseReference, buildBLA, perturbPixel, hasBLA } from "./fractal-perturb.js";
import { viewCentre, decDiff } from "./fractal-hp.js";
import { renderFormulaCPU, renderLyapunovCPU } from "./fractal-formula-cpu.js";
import { FORMULA_TYPES } from "./fractal-formulas.js";
import { BUDDHA_TYPES, renderBuddhabrotCPU } from "./fractal-buddhabrot.js";
import { renderColouredCPU } from "./fractal-colouring-cpu.js";

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

// Burning Ship folds |z| each step, so the map is not holomorphic and one complex derivative does
// not describe it. The kernel carries the whole Jacobian: (dre, dim) = dz/dcx and (ere, eim) =
// dz/dcy. The fold multiplies both by diag(sign x, sign y), the square by 2|z|, and c adds 1 and i.
// The shading reads the gradient of log|z| from both columns, which has no seams at the folds.
function iterBurningShip(cre, cim, maxIter) {
  let zr = 0, zi = 0, n = 0;
  let dre = 0, dim = 0, ere = 0, eim = 0, dseed = 1;
  let trap = Infinity;
  while (n < maxIter && zr * zr + zi * zi <= BAILOUT2) {
    const sx = zr < 0 ? -1 : 1, sy = zi < 0 ? -1 : 1;
    const ar = Math.abs(zr), ai = Math.abs(zi);
    const fdr = sx * dre, fdi = sy * dim, fer = sx * ere, fei = sy * eim;
    dre = 2 * (ar * fdr - ai * fdi) + dseed;
    dim = 2 * (ar * fdi + ai * fdr);
    ere = 2 * (ar * fer - ai * fei);
    eim = 2 * (ar * fei + ai * fer) + dseed;
    const t = ar * ar - ai * ai + cre;
    zi = 2 * ar * ai + cim;
    zr = t;
    const t2 = Math.min(Math.abs(zr), Math.abs(zi));
    if (t2 < trap) trap = t2;
    if (Math.max(dre * dre + dim * dim, ere * ere + eim * eim) > DERIV_RESCALE_AT) {
      dre *= DERIV_RESCALE_BY; dim *= DERIV_RESCALE_BY; ere *= DERIV_RESCALE_BY; eim *= DERIV_RESCALE_BY;
      dseed *= DERIV_RESCALE_BY;
    }
    n++;
  }
  return { n, zr, zi, dre, dim, trap, gx: zr * dre + zi * dim, gy: zr * ere + zi * eim };
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

/**
 * The stops a view draws with: its own gradient (2 to 16 sRGB byte triples, from the palette
 * editor or an import) when it has one, else a named palette.
 */
export function paletteOf(view) {
  const g = view && view.gradient;
  if (Array.isArray(g) && g.length >= 2 && g.length <= 16 && g.every((s) => Array.isArray(s) && s.length === 3 && s.every((v) => v >= 0 && v <= 255))) return g;
  return PALETTES[view && view.palette] || PAL_OCEAN;
}

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

  const pal = paletteOf(opts || {});
  if (FORMULA_TYPES.includes(type)) { renderFormulaCPU(canvas, { ...opts, cx, cy, scale, maxIter }, pal); return; }
  if (type === "lyapunov") { renderLyapunovCPU(canvas, { ...opts, cx, cy, scale, maxIter }, pal); return; }
  if (BUDDHA_TYPES.includes(type)) { renderBuddhabrotCPU(canvas, { ...opts, type, cx, cy, scale, maxIter }, pal); return; }
  if (["mandelbrot", "julia", "burningship"].includes(type) && cpuNeedsPerturbation({ ...opts, scale }, canvas.width)) {
    renderFractalDeepCPU(canvas, { ...opts, type, scale, maxIter, jx, jy }, pal);
    return;
  }
  // Any colouring but the default goes through the colouring layer's CPU twin; the fast kernels
  // below stay exactly the reference the preset tests pin.
  if (opts && opts.colouring && opts.colouring.mode && opts.colouring.mode !== "smooth") {
    renderColouredCPU(canvas, { ...opts, type, cx, cy, scale, maxIter, jx, jy }, pal);
    return;
  }
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
    // Row 0 is the top of the frame, where the GPU programs put the larger imaginary part.
    const y0 = cy - flipY * (py / H - 0.5) * scale * aspect;

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
      const shade = type === "burningship" ? reliefDir(r.gx, r.gy) : relief(r.zr, r.zi, r.dre, r.dim);
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

/**
 * Does this view need perturbation on the CPU? A double resolves about 2^-52 of the centre's
 * magnitude; a pixel step below 2^-48 of it (16 ulps) starts merging neighbours.
 */
export function cpuNeedsPerturbation(view, width) {
  const mag = Math.max(Math.abs(view.cx || 0), Math.abs(view.cy || 0), 1);
  return (view.scale / Math.max(1, width)) < mag * 2 ** -48;
}

/**
 * The CPU's deep path: the same perturbation, rebasing and BLA as the GPU program
 * (fractal-perturb.js), in doubles, then this file's colour recipe. Serves devices without WebGL2
 * and is what the tests render the deep presets through. Down to a view 1e-300 wide.
 */
function renderFractalDeepCPU(canvas, opts, pal) {
  const { type = "mandelbrot", maxIter = 1000, jx = -0.8, jy = 0.156 } = opts;
  const scale = Math.max(1e-300, opts.scale);
  const W = canvas.width, H = canvas.height;
  const px = scale / W;
  const flipY = type === "burningship" ? -1 : 1;
  const c = viewCentre(opts);
  const pick = chooseReference({ kind: type, re: c.re, im: c.im, jRe: jx, jIm: jy, scale, w: W, h: H, maxIter });
  const offX = decDiff(c.re, pick.re, pick.ref.bits), offY = decDiff(c.im, pick.im, pick.ref.bits);
  const bla = hasBLA(type) ? buildBLA(pick.ref, type === "julia" ? -Infinity : Math.log2(Math.hypot(offX, offY) + 0.5 * Math.hypot(W, H) * px) + 1, { julia: type === "julia" }) : null;
  const { lab, tint } = preparePalette(pal);
  const buf = new Uint8ClampedArray(W * H * 4);
  const buf32 = new Uint32Array(buf.buffer);
  const col = [0, 0, 0];
  for (let py = 0; py < H; py++) {
    // Row 0 is the top, the larger imaginary part (the Ship reflected), as in renderFractal.
    const oy = offY - flipY * (py + 0.5 - H / 2) * px;
    for (let x = 0; x < W; x++) {
      const ox = offX + (x + 0.5 - W / 2) * px;
      const r = perturbPixel(pick.ref, ox, oy, maxIter, bla, { derive: true });
      const idx = py * W + x;
      if (r.n >= maxIter) { buf32[idx] = 0xff000000; continue; }
      const logr = 0.5 * Math.log(r.zx * r.zx + r.zy * r.zy);
      const mu = r.n - Math.log(logr / Math.LN2) / Math.LN2;
      rampLinear(lab, mu / 8, col);
      const glow = trapWeight(Math.exp(-r.trap * 4) * 0.30);
      const shade = type === "burningship" ? reliefDir(r.gx, r.gy) : relief(r.zx, r.zy, r.dre, r.dim);
      col[0] = col[0] * shade + tint[0] * glow;
      col[1] = col[1] * shade + tint[1] * glow;
      col[2] = col[2] * shade + tint[2] * glow;
      holdGamut(col);
      const d = ditherOffset(x, py);
      buf32[idx] = (0xff << 24) | (encodeChannel(col[2], d) << 16) | (encodeChannel(col[1], d) << 8) | encodeChannel(col[0], d);
    }
  }
  canvas.getContext("2d", { willReadFrequently: true }).putImageData(new ImageData(buf, W, H), 0, 0);
}
