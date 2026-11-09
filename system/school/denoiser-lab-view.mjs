// The denoiser lab, drawn at Rerun's tide line: the stand-in image as tiles coloured by each pixel's
// difference from the exact value (log scale, ember past the bound), the glint outlined, and the worst
// difference on a gauge with the bound as a fixed slot. Pure in state.
import { rect } from "../../media/school/shared/lib.mjs";
import { lab, plate, beach, scene, INK } from "../../media/school/errorbars/scene/tide.mjs";
import { gauge } from "../../media/school/denoiser/scene/segs.mjs";

export function frame(s, A, t) {
  const r = s.result, c = 34, x0 = 600, y0 = 100, items = [...beach(t), plate(560, 60, 1300, 900, 0.6)];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const e = r ? r.errorMap[y * s.w + x] : 0, over = r && e > s.bound, u = r ? Math.max(0, Math.min(1, (Math.log10(Math.max(e, 1e-8)) + 8) / 6)) : 0;
    items.push({ shape: rect(x0 + x * c, y0 + y * c, c - 3, c - 3, 2), fill: over ? [0.89, 0.58, 0.45, 1] : [0.2 + 0.6 * u, 0.2 + 0.55 * u, 0.22 + 0.45 * u, 1], screen: true });
  }
  if (s.glint) items.push({ shape: rect(x0 + s.glint.x * c - 4, y0 + s.glint.y * c - 4, c + 5, c + 5, 3), fill: null, stroke: [0.7, 0.82, 0.95, 1], width: 3, screen: true });
  items.push(lab(A, "each tile: one pixel's difference from the exact value; ember: past the bound", 20, x0, y0 + s.h * c + 30, INK.dim));
  if (r) items.push(...gauge(A, x0, y0 + s.h * c + 110, 1000, `worst difference (the bound is the slot, ${s.bound})`, r.maxAbs, 1, Math.max(0.12, r.maxAbs * 1.1), s.bound, r.within ? [0.9, 0.86, 0.75] : [0.89, 0.58, 0.45]));
  else items.push(lab(A, "press Run the check", 24, x0, y0 + s.h * c + 110, INK.night));
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
