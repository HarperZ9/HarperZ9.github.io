// gradfield.mjs: the grainy gradient-field poster generator (feed set 29, family a). Simple geometry carries all the
// colour; the colour comes from physics (thin-film interference, the spectral locus); film grain and a TPDF dither
// finish it. Six motifs in motifs.mjs: capsules, spheres, wedges, metaballs, subdivide, steps.
//
//   import { poster, SPEC } from './gradfield.mjs';
//   const R = poster({ motif: 'spheres', w: 1024, h: 1280, seed: 'a1' });   // linear raster { w, h, px }
//   writePNG('out.png', R, { grainSd: R.grainSd, seed: 'a1' });              // grain is applied at encode
//
// Synthesised, not copied: the motif list is the author's description of the posters (SOURCES.md, still set a), the
// soft-gradient behaviour is measured from clips 4QeJ, hcKy, u19Q and AUCd, and the colour model is ours (film and
// spectral ramps), so no poster's palette is reproduced.
import { raster, clamp, cover, rng } from './lib/field.mjs';
import { hexLin, filmRamp, spectralRamp, rampLUT } from './lib/color.mjs';
import { MOTIFS } from './motifs.mjs';

export const SPEC = {
  id: 'gradfield.poster',
  inputs: { seed: 'string', motif: `one of ${Object.keys(MOTIFS).join(', ')}` },
  params: {
    w: { min: 64, max: 7680, default: 1024, unit: 'px' }, h: { min: 64, max: 7680, default: 1280, unit: 'px' },
    palette: { options: ['film', 'spectral', 'ink'], default: 'film', unit: 'ramp source' },
    span: { min: 0.1, max: 1, default: 0.62, unit: 'share of the ramp one shape walks' },
    ground: { default: '#d6d0c6', unit: 'hex (warm grey); dark grounds such as #121014 work' },
    grainSd: { min: 0, max: 14, default: 5, unit: 'code values (8-bit) of mono grain, applied at encode; R4 range 0.3 to 6, heavier is a declared setting' },
    grainSigma: { min: 0.5, max: 2, default: 0.8, unit: 'px; the grain autocorrelation FWHM is 3.33 x this (R4: 1.9 to 3.1 px)' },
    aberration: { min: 0, max: 12, default: 0, unit: 'px of red and blue shift (chromatic split)' },
    t: { min: 0, max: 1, default: 0, unit: 'loop phase; every motif returns to its start at t = 1' },
  },
  determinism: 'same seed and params give the same float raster, byte for byte (tests/gradfield.test.mjs)',
  budget: '1024 x 1280 in node: capsules 0.2 s, spheres 0.6 s, metaballs 1.5 s (measured in tests, see PROGRESS.md)',
  export: 'tools/render.mjs: 3840 px long side, 16-bit PNG master plus 8-bit preview (QUALITY-SPEC O1)',
};

export function makeRamp(palette, r) {
  if (palette === 'spectral') { const W = [[440, 575], [520, 650], [565, 690], [420, 520]][Math.floor(r() * 4)]; return spectralRamp(9, W[0], W[1]); }
  if (palette === 'ink') return ['#1d2a5c', '#3557c8', '#e4572e', '#f2b134', '#f4ede1'].map(hexLin);
  const d0 = 180 + r() * 260; return filmRamp(9, d0, d0 + 260 + r() * 140, { k: 2.2 });
}

// Soft-shape renderer shared by the shape motifs. A prim is { bbox: [x0, y0, x1, y1], d(x, y) -> signed px,
// fill(x, y, d, out) -> out [r, g, b], shadow?: { dx, dy, soft, alpha } }. Shadows go down first, then fills.
export function drawPrims(R, prims, { edge = 0 } = {}) {
  const { w, h, px } = R, out = [0, 0, 0];
  const box = (b, pad) => [Math.max(0, Math.floor(b[0] - pad)), Math.max(0, Math.floor(b[1] - pad)), Math.min(w - 1, Math.ceil(b[2] + pad)), Math.min(h - 1, Math.ceil(b[3] + pad))];
  for (const p of prims) {
    const s = p.shadow; if (!s) continue;
    const [x0, y0, x1, y1] = box([p.bbox[0] + s.dx, p.bbox[1] + s.dy, p.bbox[2] + s.dx, p.bbox[3] + s.dy], s.soft * 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const a = s.alpha * cover(p.d(x + 0.5 - s.dx, y + 0.5 - s.dy), s.soft); if (a <= 0) continue;
      const k = 3 * (y * w + x); px[k] *= 1 - a; px[k + 1] *= 1 - a; px[k + 2] *= 1 - a;
    }
  }
  for (const p of prims) {
    const [x0, y0, x1, y1] = box(p.bbox, 2 + edge);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = p.d(x + 0.5, y + 0.5), a = cover(d, edge); if (a <= 0) continue;
      p.fill(x + 0.5, y + 0.5, d, out); const k = 3 * (y * w + x);
      px[k] += (out[0] - px[k]) * a; px[k + 1] += (out[1] - px[k + 1]) * a; px[k + 2] += (out[2] - px[k + 2]) * a;
    }
  }
  return R;
}

// Chromatic split: red sampled `a` px to the left, blue `a` px to the right, with linear interpolation.
export function aberrate(R, a) {
  if (!a) return R;
  const { w, h, px } = R, src = Float32Array.from(px);
  const at = (x, y, c) => { const xf = clamp(x, 0, w - 1), i = Math.floor(xf), u = xf - i, j = Math.min(w - 1, i + 1); return src[3 * (y * w + i) + c] * (1 - u) + src[3 * (y * w + j) + c] * u; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { px[3 * (y * w + x)] = at(x - a, y, 0); px[3 * (y * w + x) + 2] = at(x + a, y, 2); }
  return R;
}

export function poster(o = {}) {
  const p = { motif: 'capsules', seed: 'gradfield', ...Object.fromEntries(Object.entries(SPEC.params).map(([k, v]) => [k, v.default])), ...o };
  const make = MOTIFS[p.motif]; if (!make) throw new Error(`gradfield: unknown motif "${p.motif}" (have ${Object.keys(MOTIFS).join(', ')})`);
  const r = rng(`${p.seed}:${p.motif}`), ramp = makeRamp(p.palette, r), ctx = { ...p, t: ((p.t % 1) + 1) % 1, r, ramp, lut: rampLUT(ramp), unit: Math.min(p.w, p.h) / 1024 };
  const R = raster(p.w, p.h, hexLin(p.ground));
  make(R, ctx, p[p.motif] || {});
  aberrate(R, p.aberration * ctx.unit);
  R.grainSd = p.grainSd; R.grainSigma = p.grainSigma * Math.max(1, ctx.unit * 0.75); R.ramp = ramp;
  return R;
}
