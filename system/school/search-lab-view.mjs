// The search lab, drawn at Rerun's tide line: the row as bars by size (at most 256 drawn; larger rows
// are sampled evenly), the places being compared in ember, a search's last range as a bracket, and the
// running count. Pure in state.
import { rect } from "../../media/school/shared/lib.mjs";
import { lab, plate, beach, scene, INK } from "../../media/school/errorbars/scene/tide.mjs";

export function frame(s, A, t) {
  const a = s.a, n = a.length, cols = Math.min(256, n), step = n / cols, w = 1160 / cols, x0 = 640, base = 700, H = 520;
  let max = 1; for (let i = 0; i < n; i++) if (a[i] > max) max = a[i];
  const items = [...beach(t), plate(600, 100, 1240, 760, 0.6)];
  const hot = (i0, i1) => s.mark && s.mark.some((m) => m >= i0 && m < i1);
  for (let c = 0; c < cols; c++) { const i0 = Math.floor(c * step), i1 = Math.floor((c + 1) * step), v = a[i0], h = 6 + (H * v) / max;
    items.push({ shape: rect(x0 + c * w, base - h, Math.max(1, w - (w > 3 ? 1 : 0)), h), fill: hot(i0, Math.max(i1, i0 + 1)) ? [0.89, 0.58, 0.45, 1] : [0.9, 0.86, 0.75, 0.85], screen: true }); }
  if (s.range && s.range[0] <= s.range[1]) items.push({ shape: rect(x0 + (s.range[0] / step) * w, base + 14, Math.max(4, ((s.range[1] - s.range[0] + 1) / step) * w), 6), fill: [0.7, 0.82, 0.95, 1], screen: true });
  items.push(lab(A, n > cols ? `${n.toLocaleString("en")} shells, every ${Math.round(step)}th drawn` : `${n} shells`, 20, x0, 150, INK.dim));
  items.push(lab(A, s.line || "press Sort, or Look for a shell", 22, x0, 780, s.running ? INK.dim : INK.night));
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
