// The precision lab, drawn in Tallow's lamp room: three number lines around the reader's number with
// the values each format can store as ticks and the stored value in ember, then any running sum and
// model score as lines of text. Pure in state.
import { rect } from "../../media/school/shared/lib.mjs";
import { roomQ, scene, lab, plate } from "../../media/school/quant/scene/segs.mjs";

const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472" };
export function frame(s, A, t) {
  const items = [...roomQ(t), plate(520, 120, 1360, 560, 0.6)];
  if (s.places) {
    const w = 4 * Math.max(s.places[0].step, s.places[1].step), from = s.x - w, X = (v) => 600 + ((v - from) / (2 * w)) * 1200;
    s.places.forEach((p, i) => { const y = 230 + i * 150;
      items.push({ shape: rect(600, y, 1200, 2), fill: [0.6, 0.55, 0.45, 1], screen: true }, lab(A, p.name, 22, 580, y + 8, INK.night, "right"));
      if (p.step >= (2 * w) / 200) { for (let v = Math.ceil(from / p.step) * p.step; v <= s.x + w; v += p.step) items.push({ shape: rect(X(v) - 1, y - 14, 2, 30), fill: [0.9, 0.86, 0.75, 1], screen: true }); }
      else items.push({ shape: rect(600, y - 14, 1200, 30), fill: [0.9, 0.86, 0.75, 0.3], screen: true });
      items.push({ shape: rect(X(p.stored) - 3, y - 24, 6, 50), fill: [0.89, 0.58, 0.45, 1], screen: true }, lab(A, `${p.stored} (off by ${p.err.toPrecision(2)})`, 18, 1800, y - 22, INK.dim, "right")); });
    items.push({ shape: rect(X(s.x) - 1, 180, 2, 360), fill: [0.7, 0.82, 0.95, 1], screen: true }, lab(A, `your number: ${s.x}`, 20, X(s.x) + 8, 170, [0.7, 0.82, 0.95]));
  } else items.push(lab(A, "type a number and press Show the marks", 24, 600, 380));
  items.push(plate(620, 720, 1260, 220, 0.6));
  if (s.sums) items.push(lab(A, `adding ${s.sums.step}: ${s.sums.rows.map((r) => `${r.format} ends at ${r.sum}${r.stuckAt !== null ? ` (stuck at ${r.stuckAt})` : ""}`).join("; ")}`, 20, 660, 780));
  if (s.scoreLine) items.push(lab(A, s.scoreLine, 20, 660, 840, s.running ? INK.dim : INK.night));
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
