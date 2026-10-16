// The tiling lab, drawn in Pylon's cannery: the tables with one tile of C lit (or one cell for the
// can-by-can kernel), the counted reads for the reader's kernel, the check and any time from the
// reader's chip. Pure in state.
import { INK, lab, plate, floor, scene } from "../../media/school/threads/scene/cannery.mjs";
import { table } from "../../media/school/tiling/scene/segs.mjs";

export function frame(s, A, t) {
  const tile = s.kind === "naive" ? 1 : 2, items = [...floor(), ...table(A, "A", (i, j) => i < tile), ...table(A, "B", (i, j) => j < tile), ...table(A, "C", (i, j) => i < tile && j < tile)];
  items.push(plate(200, 740, 1500, 230, 0.6));
  const r = s.result;
  items.push(lab(A, r ? `${r.globalLoads.toLocaleString("en")} reads from the warehouse at ${s.n} wide; ${r.intensity.toFixed(2)} operations per byte` : s.running ? `counting: ${s.done} of ${s.total} crews` : "press Count and check", 24, 240, 800));
  if (r) items.push(lab(A, `check against the main processor: ${s.check.ok ? "passed" : "failed"}`, 22, 240, 850, s.check.ok ? INK.night : INK.ember));
  if (s.timing) items.push(lab(A, s.timing, 20, 240, 900, INK.dim));
  return { background: [0.02, 0.016, 0.012], ...scene(t, A, items), post: { bloom: 0.1, threshold: 1, vignette: 0.35, grain: 0.05, passes: [] } };
}
