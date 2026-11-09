// The painterly shader, CPU reference: createPaint(preset, overrides, size).frame(sceneLinear)
// returns display-linear Rec.709. Presets are media, set for the templates the author chose.
import { prep, tensor, gaussWeights, blur4, akf, stroke } from "./abstract.mjs";
import { compose, relief } from "./compose.mjs";
import { createCanvasState, decide, advect, layerWeights, blendNoise } from "./canvas.mjs";

export const PAINT_PRESETS = {
  // Template (a): thick, warped, outlined oil with a hard temperature split; abstract and grotesque.
  "oil-grotesque": { medium: "oil", radius: 7, q: 8, zeta: 0.33, strokeLen: 16, impasto: 1.1, gloss: 0.5, push: 0.35, broken: 0.45, valueBands: 4, lines: 0.9, lineSigma: 1.3, lineSharp: 45, warp: 5, exposure: 2.6 },
  oil: { medium: "oil", radius: 6, q: 8, zeta: 0.33, strokeLen: 10, impasto: 0.6, gloss: 0.4, push: 0.12, lines: 0.2, lineSigma: 1.0, lineSharp: 30, warp: 0, exposure: 2.2, broken: 0.15 },
  gouache: { medium: "matte", radius: 6, q: 10, zeta: 0.33, strokeLen: 8, impasto: 0.25, gloss: 0, push: 0.1, lines: 0.35, lineSigma: 1.0, lineSharp: 30, warp: 0.8, exposure: 2.2, broken: 0.1, valueBands: 5 },
  watercolour: { medium: "water", radius: 5, q: 6, zeta: 0.33, strokeLen: 6, impasto: 0, gloss: 0, push: 0.08, lines: 0.15, lineSigma: 0.9, lineSharp: 25, warp: 0.6, exposure: 1.9, granulation: 0.35, edge: 1.6, dilution: 0.88, broken: 0.08 },
};
const base = { canvasOffset: [0, 0], tensorSigma: 2, granulation: 0, edge: 0, dilution: 1, broken: 0, valueBands: 0 };

export function resolvePaint(preset, overrides, size) {
  const p = { ...base, ...(PAINT_PRESETS[preset] || preset), ...(overrides || {}) };
  return { p, out: { w: size.w, h: size.h }, tw: gaussWeights(p.tensorSigma) };
}

// The canvas sampler: noise at canvas coordinates. Offset mode (no motion vectors): the pixel
// plus the pan offset. Advected mode: two advected layers, blended (canvas.mjs).
export function offsetCanvas(plan) { const [ox, oy] = plan.p.canvasOffset; return { n: (f, x, y) => f(x + ox, y + oy) }; }
export function advectedCanvas(st) { const wts = layerWeights(st); return { wts, n: (f, x, y, m = 0.5) => blendNoise(f, st, wts, x, y, m) }; }

export function createPaint(preset, overrides, size) {
  const plan = resolvePaint(preset, overrides, size);
  let canvas = null;
  return {
    plan,
    // motion (optional): { mv, dist, distPrev } from the renderer, for rotation, zoom and parallax.
    frame(scene, motion = null) {
      let cv;
      if (motion) {
        canvas = canvas || createCanvasState(size.w, size.h);
        decide(canvas); advect(canvas, motion.mv, motion.dist, motion.distPrev); cv = advectedCanvas(canvas);
      } else cv = offsetCanvas(plan);
      const { s, lat } = prep(plan, scene);
      const T = blur4(plan, blur4(plan, tensor(plan, s), plan.tw, false), plan.tw, true);
      const ak = akf(plan, s, lat, T), H = stroke(plan, T, cv);
      const Rl = relief(plan, ak, H, T, cv);
      return { s, T, ak, H, Rl, img: compose(plan, ak, H, Rl, cv), canvas };
    },
  };
}

// Display encode: sRGB with a clamp, to 8 bits (the GPU's encode8 does the same).
export function encodePaint8(img, w, h) {
  const o = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < o.length; i++) {
    if ((i & 3) === 3) { o[i] = 255; continue; }
    const l = Math.min(1, Math.max(0, img[i]));
    o[i] = Math.floor((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255 + 0.5);
  }
  return o;
}
