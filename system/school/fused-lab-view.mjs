// The fused-attention lab, drawn in Pylon's cannery: the plain kernel's wall of score cans or the fused
// crew's bench, and the counted bytes, the check and any time. Pure in state.
import { INK, lab, plate, floor, scene } from "../../media/school/threads/scene/cannery.mjs";
import { wall, bench } from "../../media/school/fused/scene/segs.mjs";

export function frame(s, A, t) {
  const u = s.total ? s.done / s.total : 0, items = [...floor()];
  if (s.kind === "unfused") items.push(...wall(s.result ? 1 : u)); else items.push(...bench(1));
  items.push(plate(160, 760, 1500, 220, 0.6));
  const r = s.result;
  items.push(lab(A, r ? `${r.N} words, ${r.d} per head: ${r.globalBytes.toLocaleString("en")} bytes to and from the warehouse` : s.running ? `counting ${s.done} of ${s.total}` : "press Count and check", 24, 200, 820));
  if (r) items.push(lab(A, `check against the exact answer: ${s.check.ok ? "passed" : `failed, ${s.check.mismatches} wrong`}`, 22, 200, 870, s.check.ok ? INK.night : INK.ember));
  if (s.timing) items.push(lab(A, s.timing, 20, 200, 920, INK.dim));
  return { background: [0.02, 0.016, 0.012], ...scene(t, A, items), post: { bloom: 0.1, threshold: 1, vignette: 0.35, grain: 0.05, passes: [] } };
}
