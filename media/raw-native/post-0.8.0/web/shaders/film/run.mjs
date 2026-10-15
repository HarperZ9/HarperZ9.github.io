// The film shader's last pass (grain, print, projection) and the frame loop, CPU reference.
//   const film = createFilm("500t-print", { ev: 0 }, { w: 1920, h: 1080 }, { w: 1920, h: 1080 });
//   const { img } = film.frame(sceneLinearFrame, frameNo);   // display-linear Rec.709
import { resolveFilm, expose, develop, mtf, FILM_PRESETS } from "./film.mjs";
import { printPixel } from "./stocks.mjs";
import { grainAt } from "./grain.mjs";
import { haloDown, haloConv } from "../crt/glass.mjs";

export { resolveFilm, FILM_PRESETS };

export function printPass(plan, F, f) {
  const { out, t } = plan, img = new Float32Array(out.w * out.h * 4);
  const uAt = (l) => (x, y) => F[(y * out.w + x) * 4 + l];
  const U = [uAt(0), uAt(1), uAt(2)];
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const i = (y * out.w + x) * 4, D = [0, 0, 0];
    for (let l = 0; l < 3; l++) {
      const g = grainAt(x, y, l, plan.grainUm[l], plan.umPerPx, f, U[l], out.w, out.h, plan.jTable, plan.grainContrast[l] * plan.p.grainAmount);
      const span = t.neg.span[l];
      D[l] = t.neg.dmin[l] - Math.log10(Math.max(1e-6, 1 - g * (1 - Math.pow(10, -span))));
    }
    const rgb = printPixel(t, D);
    img[i] = rgb[0]; img[i + 1] = rgb[1]; img[i + 2] = rgb[2]; img[i + 3] = 1;
  }
  return img;
}

export function createFilm(preset, overrides, input, out) {
  const plan = resolveFilm(preset, overrides, input, out);
  let frameNo = 0;
  return {
    plan,
    frame(scene, f = frameNo) {
      const H = mtf(plan, expose(plan, scene, f)), halo = haloConv(plan, haloDown(plan, H));
      const F = develop(plan, H, halo), img = printPass(plan, F, f);
      frameNo = f + 1;
      return { H, F, img };
    },
  };
}

// Display encode for film: the print is already display-referred, so sRGB with a clamp.
export function encodeFilm8(img, w, h) {
  const o = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < o.length; i++) {
    if ((i & 3) === 3) { o[i] = 255; continue; }
    const l = Math.min(1, Math.max(0, img[i]));
    o[i] = Math.floor((l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055) * 255 + 0.5);
  }
  return o;
}
