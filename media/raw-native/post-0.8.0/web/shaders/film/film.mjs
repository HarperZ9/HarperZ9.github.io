// The spectral film shader, CPU reference. Scene-linear Rec.709 light in, display-linear
// Rec.709 out (1 = the projected open gate). Passes, as on the GPU (film.wgsl.mjs):
//   expose     gate weave, then the camera negative's layer exposures (spectral, 3 x 3)
//   halo       light that reaches the film base and comes back: red first, ring at 2 t tan(theta_c)
//   develop    characteristic curves and interimage -> each layer's developed dye fraction
//   print      grain on the negative, then the full spectral print and projection
import { haloKernel, radialReturn } from "../crt/halo.mjs";
import { build, curve, interimage } from "./stocks.mjs";
import { varianceTable, depthLayers } from "./grain.mjs";
import { hash3 } from "../common.mjs";

export const FILM_PRESETS = {
  "500t-print": { negative: "neg-500t", remjet: true },
  "500t-no-remjet": { negative: "neg-500t", remjet: false },
  "250d-print": { negative: "neg-250d", remjet: true },
  "bleach-bypass": { negative: "neg-500t", process: "bleach-bypass", remjet: true },
};
const base = { negative: "neg-500t", print: "print-2383", process: "normal", printerPoints: [0, 0, 0], ev: 0,
  gateWidthMm: 24.89, grainScale: 1, grainAmount: 1, remjet: true, pressurePlate: 0.05, emulsionSigmaUm: 4.2, halationReach: [0.25, 0.06, 0], weaveUm: 6, jitterUm: 1.5, seed: 1 };

export function resolveFilm(preset, overrides, input, out) {
  const p = { ...base, ...(typeof preset === "string" ? FILM_PRESETS[preset] : preset || {}), ...(overrides || {}) };
  const t = build(p), umPerPx = (p.gateWidthMm * 1000) / out.w, jTable = varianceTable();
  // Returned light exposes the emulsion; the part the turbid emulsion scatters back down (albedo
  // about 0.4, low confidence) returns again. Only the kernel shape is used; its strength is below.
  // pressurePlate: diffuse reflectance behind the base (matte black anodised, about 0.05, low
  // confidence); it fills the inside of the ring. 0 turns it off.
  const baseGlass = { thickness: 0.125, n: 1.49, transmission: 1, albedo: 0.4, cell: 0.02, backReflectance: p.pressurePlate };
  const hk = haloKernel(baseGlass, { mmPerPx: umPerPx / 1000, maxCells: 25 });
  const sum = hk.weights.reduce((a, b) => a + b, 0), kappa = radialReturn(baseGlass, 0.001, 5).kappa;
  return {
    p, t, input, out, umPerPx, jTable,
    grainContrast: t.grainUm.map((r, l) => 1 / Math.sqrt(depthLayers(r, t.neg.span[l], t.sigmaD48, jTable))),
    // At a coarse scale the whole ring falls inside one cell: no halo to draw.
    halo: { q: hk.q, R: hk.R, weights: hk.weights.map((w) => (sum > 0 ? w / sum : 0)), ringMm: hk.ringMm },
    haloStrength: p.halationReach.map((r) => r * kappa * (p.remjet ? 0.03 : 1)),
    grainUm: t.grainUm.map((r) => r * p.grainScale),
    mtf: mtfWeights(p.emulsionSigmaUm / umPerPx),
  };
}

// Gate weave in output pixels for frame f: slow drift from two incommensurate sines plus
// per-frame jitter from the pull-down, both deterministic in the seed.
export function weave(plan, f) {
  const { weaveUm, jitterUm, seed } = plan.p, s = (k) => hash3(seed, k, 7) * 2 * Math.PI;
  const tt = f / 24;
  const wx = weaveUm * (0.6 * Math.sin(2 * Math.PI * 0.7 * tt + s(1)) + 0.4 * Math.sin(2 * Math.PI * 2.3 * tt + s(2))) + jitterUm * (hash3(seed, f, 11) - 0.5);
  const wy = weaveUm * (0.6 * Math.sin(2 * Math.PI * 0.5 * tt + s(3)) + 0.4 * Math.sin(2 * Math.PI * 1.9 * tt + s(4))) + jitterUm * (hash3(seed, f, 13) - 0.5);
  return [wx / plan.umPerPx, wy / plan.umPerPx];
}

function sampleScene(scene, x, y) {
  const W = scene.width, H = scene.height, fx = Math.min(W - 1, Math.max(0, x)), fy = Math.min(H - 1, Math.max(0, y));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const at = (xx, yy, c) => scene.data[(yy * W + xx) * 4 + c];
  return [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x1, y0, c) * tx) * (1 - ty) + (at(x0, y1, c) * (1 - tx) + at(x1, y1, c) * tx) * ty);
}

export function expose(plan, scene, f) {
  const { out, t } = plan, [dx, dy] = weave(plan, f), H = new Float32Array(out.w * out.h * 4), k = Math.pow(2, plan.p.ev);
  const sx = scene.width / out.w, sy = scene.height / out.h, E = t.E;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const c = sampleScene(scene, (x + 0.5 - dx) * sx - 0.5, (y + 0.5 - dy) * sy - 0.5), i = (y * out.w + x) * 4;
    for (let l = 0; l < 3; l++) H[i + l] = k * (E[l * 3] * c[0] + E[l * 3 + 1] * c[1] + E[l * 3 + 2] * c[2]);
  }
  return H;
}

// Developed dye fraction per layer: the macroscopic density as the fraction of area under
// dye clouds that gives the same mean transmittance (at full dye density span).
export function develop(plan, H, halo) {
  const { out, t } = plan, q = plan.halo.q, gw = Math.ceil(out.w / q), gh = Math.ceil(out.h / q), F = new Float32Array(out.w * out.h * 4);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const i = (y * out.w + x) * 4, hl = upsample(halo, gw, gh, q, x, y), D = [0, 0, 0];
    for (let l = 0; l < 3; l++) {
      const h = Math.max(1e-6, H[i + l] + plan.haloStrength[l] * hl[l]);
      D[l] = curve(Math.log10(h), t.neg.dmin[l], t.neg.span[l], t.neg.k[l], t.neg.x0[l]);
    }
    const Di = interimage(t, D);
    for (let l = 0; l < 3; l++) {
      const span = t.neg.span[l], d = Math.min(span, Math.max(0, Di[l] - t.neg.dmin[l]));
      F[i + l] = (1 - Math.pow(10, -d)) / (1 - Math.pow(10, -span));
    }
  }
  return F;
}
export function upsample(g, gw, gh, q, x, y) {
  const fx = Math.min(gw - 1, Math.max(0, (x + 0.5) / q - 0.5)), fy = Math.min(gh - 1, Math.max(0, (y + 0.5) / q - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const at = (xx, yy, c) => g[(yy * gw + xx) * 4 + c];
  return [0, 1, 2].map((c) => (at(x0, y0, c) * (1 - tx) + at(x1, y0, c) * tx) * (1 - ty) + (at(x0, y1, c) * (1 - tx) + at(x1, y1, c) * tx) * ty);
}

// Emulsion scatter (the film's own MTF): light spreads sideways in the turbid emulsion before
// it is recorded. A gaussian of sigma 4.2 um puts the 50% MTF near 45 cycles/mm (an assumed
// figure for a modern camera negative, low confidence). Normalised weights for a separable
// blur; none when sigma is under 0.15 pixel.
export function mtfWeights(sigmaPx) {
  if (!(sigmaPx >= 0.15)) return new Float32Array([1]);
  const r = Math.min(16, Math.ceil(3 * sigmaPx)), w = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { w[i + r] = Math.exp(-0.5 * (i / sigmaPx) ** 2); s += w[i + r]; }
  for (let i = 0; i < w.length; i++) w[i] /= s;
  return w;
}
export function mtf(plan, H) {
  const w = plan.mtf, r = (w.length - 1) / 2, { w: W, h: Hh } = plan.out;
  if (r === 0) return H;
  const pass = (src, alongY) => {
    const o = new Float32Array(src.length);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let k = -r; k <= r; k++) {
        const xx = alongY ? x : Math.min(W - 1, Math.max(0, x + k)), yy = alongY ? Math.min(Hh - 1, Math.max(0, y + k)) : y;
        s += w[k + r] * src[(yy * W + xx) * 4 + c];
      }
      o[(y * W + x) * 4 + c] = s;
    }
    return o;
  };
  return pass(pass(H, false), true);
}
