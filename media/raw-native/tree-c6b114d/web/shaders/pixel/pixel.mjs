// Perspective-stable pixel art, CPU reference: the frame loop with probe cells and crossfade.
//   const px = createPixel({ N: 128, cell: 0.5 }, { w, h });
//   px.frame({ eye, target, fovy })  -> { img (linear RGBA), origin, blend }
// When the camera enters a new cell the previous probe is kept and the view crossfades to the
// new one with a 4 x 4 Bayer threshold. The paper leaves the timing open. Here each frame
// advances the blend by the larger of 1 / fadeFrames and the distance moved over fadeCells of a
// cell, so a fast camera finishes its fade before the next cell and a still one in fadeFrames.
import { captureProbe, shadeProbe, snapOrigin } from "./probe.mjs";
import { camera, splat, resolve } from "./splat.mjs";

export const PIXEL_DEFAULTS = { N: 128, cell: 0.5, bands: 6, outline: 0.22, crease: 0.08, expand: 1.15, fadeFrames: 12, fadeCells: 0.15 };
export function fadeStep(o, lastEye, eye) {
  const moved = lastEye ? Math.hypot(eye[0] - lastEye[0], eye[1] - lastEye[1], eye[2] - lastEye[2]) : 0;
  return Math.max(1 / o.fadeFrames, moved / (o.fadeCells * o.cell));
}

export function createPixel(options, size) {
  const o = { ...PIXEL_DEFAULTS, ...options };
  let cur = null, prev = null, fade = 1, lastEye = null;
  const probe = (origin) => { const pr = captureProbe(origin, o.N); return { pr, col: shadeProbe(pr, o) }; };
  return {
    options: o,
    frame({ eye, target, fovy = 0.75 }) {
      const origin = snapOrigin(eye, o.cell);
      if (!cur || origin.some((v, i) => v !== cur.pr.origin[i])) { prev = cur; cur = probe(origin); fade = prev ? 0 : 1; }
      fade = Math.min(1, fade + fadeStep(o, lastEye, eye)); lastEye = eye.slice();
      const cam = camera(eye, target, fovy, size.w, size.h);
      const a = { vis: splat(cur.pr, cam, o.expand), col: cur.col }, b = prev && fade < 1 ? { vis: splat(prev.pr, cam, o.expand), col: prev.col } : null;
      return { img: resolve(cam, a, b, fade, o.bands), origin, blend: fade, cam, vis: a.vis, probe: cur.pr };
    },
  };
}

export function encodePixel8(img, w, h) {
  const o = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < o.length; i++) {
    if ((i & 3) === 3) { o[i] = 255; continue; }
    const l = Math.min(1, Math.max(0, img[i]));
    o[i] = Math.floor((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255 + 0.5);
  }
  return o;
}
