// The threads lab, drawn on Pylon's cannery floor: the first warp's 32 threads and the 32-byte blocks
// their reads touch for the chosen stride, then the counted trips for the whole job and any time
// from the reader's own chip. Pure in state.
import { rect } from "../../media/school/shared/lib.mjs";
import { INK, CREW, lab, plate, floor, scene, trip } from "../../media/school/threads/scene/cannery.mjs";
import { blocksShelf } from "../../media/school/threads/scene/later.mjs";

const P = 6.5, X0 = 120;
export function frame(s, A, t) {
  const els = Array.from({ length: 32 }, (_, i) => (s.stride === 1 ? i : i * s.stride)), shown = els.filter((e) => e < 256);
  const items = [...floor(), ...blocksShelf(A, new Set(shown.map((e) => Math.floor((e * 4) / 32))))];
  els.forEach((e, i) => { const x = 140 + i * 52, y = 560; items.push({ shape: rect(x - 12, y - 12, 24, 24, 4), fill: [...CREW[0], 1], stroke: "#0b0a0c", width: 2 });
    if (e < 256) items.push(trip(x, y - 12, X0 + e * P + P / 2, 235, CREW[0], 0.5)); });
  items.push(lab(A, `the first warp: 32 threads, ${s.stride === 1 ? "neighbouring reads" : `reads ${s.stride} apart`}${shown.length < 32 ? " (some reach past this shelf)" : ""}`, 20, 140, 620, INK.dim));
  items.push(plate(120, 680, 1500, 260, 0.6));
  const r = s.result;
  items.push(lab(A, r ? `${r.workgroups.toLocaleString("en")} crews of ${r.wg}, ${r.idleThreads} idle, ${r.transactions[32].total.toLocaleString("en")} 32-byte trips` : s.running ? `counting: ${s.done.toLocaleString("en")} crews` : "press Count", 26, 160, 750));
  if (r && s.base) items.push(lab(A, `${(r.transactions[32].total / s.base).toFixed(2)} times the trips of neighbouring reads`, 24, 160, 810, INK.ember));
  if (s.timing) items.push(lab(A, s.timing, 20, 160, 870, INK.dim));
  return { background: [0.02, 0.016, 0.012], ...scene(t, A, items), post: { bloom: 0.1, threshold: 1, vignette: 0.35, grain: 0.05, passes: [] } };
}
