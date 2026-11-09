// The quantisation lab, drawn in Tallow's lamp room: the second floor's query, key and value table of
// the reader's quantised model as a hull of planks, beside the full-precision one, and the scores.
// Pure in state.
import { grid, maxAbs } from "../../media/school/lora/scene/planks.mjs";
import { roomQ, scene, lab, plate } from "../../media/school/quant/scene/segs.mjs";

const rows = (flat) => Array.from({ length: 32 }, (_, i) => Array.from(flat.subarray(i * 96, (i + 1) * 96)));
export function frame(s, A, t) {
  const full = rows(s.baseTable), sc = maxAbs(full), items = [...roomQ(t)];
  items.push(lab(A, "full precision", 20, 560, 100), ...grid(full, { at: { x: 560, y: 120 }, cell: 8, scale: sc }));
  items.push(lab(A, s.label, 20, 560, 420), ...grid(rows(s.table), { at: { x: 560, y: 440 }, cell: 8, scale: sc }));
  items.push(plate(560, 740, 1300, 200, 0.6));
  const r = s.result;
  items.push(lab(A, r ? `loss ${r.loss.value.toFixed(4)}, rise ${r.loss.diff >= 0 ? "+" : ""}${r.loss.diff.toFixed(4)} [${r.loss.diffLo.toFixed(4)}, ${r.loss.diffHi.toFixed(4)}]` : s.running ? `scoring ${s.scored} rows` : "press Quantise and score", 24, 600, 800));
  if (s.bytes) items.push(lab(A, `${s.bytes.total.toLocaleString("en")} bytes, ${Math.round(s.bytes.ratio * 100)}% of 32-bit`, 22, 600, 860));
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
