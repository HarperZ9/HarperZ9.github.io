// The LoRA lab, drawn in Tallow's lamp room: the change the reader's run has made to the second
// floor's query, key and value table (32 inputs by 96 outputs) as a hull of planks, and a board
// with the new habit (answer right, ember) and the old skill (look-back words right, slate) over
// the steps, against the film's full fine-tune (faint). Pure in state.
import { rect, polyline, words, darkness } from "../../media/school/shared/lib.mjs";
import { host } from "../../media/school/embeddings/scene/segs.mjs";
import { night, glazing } from "../../media/school/attention/scene/room.mjs";
import { grid, INK } from "../../media/school/lora/scene/planks.mjs";

const G = { x: 640, y: 150, cell: 9 }, B = { x: 620, y: 600, w: 1240, h: 400 };
const X = (s, max) => B.x + 50 + (s / Math.max(max, 1)) * (B.w - 90), Y = (v) => B.y + B.h - 50 - v * (B.h - 140);
const line = (pts, max, col, w = 4) => (pts.length > 1 ? [{ shape: polyline(pts.flatMap(([s, v]) => [X(s, max), Y(v)])), fill: null, stroke: col, width: w }] : []);
const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a });

export function frame(s, A, t) {
  const items = [...night(t, { moon: false }), ...glazing()];
  items.push(lab(A, "change to the second floor's query, key and value table, 32 x 96", 22, G.x, G.y - 40), ...grid(s.change, { at: G, cell: G.cell, scale: s.scale }));
  items.push(lab(A, s.trained ? `${s.method}: ${s.trained.toLocaleString("en")} numbers trained of ${s.total.toLocaleString("en")}` : "choose a method and press Train", 22, G.x, G.y + 32 * G.cell + 54),
    lab(A, s.strips ? `strips: ${s.strips}` : "", 20, G.x, G.y + 32 * G.cell + 88, INK.dim));
  items.push({ shape: rect(B.x, B.y, B.w, B.h, 8), fill: [0.05, 0.05, 0.06, 0.85], stroke: "#3a2c18", width: 3 });
  for (const v of [0.25, 0.5, 0.75, 1]) items.push({ shape: rect(B.x + 50, Y(v), B.w - 90, 1), fill: [0.6, 0.55, 0.45, 0.25] }, lab(A, `${v * 100}%`, 15, B.x + 12, Y(v) + 6, INK.dim));
  const max = s.steps;
  items.push(...line(s.film.filter((p) => p.step <= max).map((p) => [p.step, p.answer]), max, [0.89, 0.58, 0.45, 0.28], 3));
  items.push(...line(s.curve.map((p) => [p.step, p.answer]), max, INK.ember), ...line(s.curve.map((p) => [p.step, p.copy]), max, INK.slate, 3));
  const last = s.curve.at(-1);
  items.push(lab(A, last ? `step ${last.step}: answer ${Math.round(last.answer * 100)}% right; old look-back ${Math.round(last.copy * 100)}%` : "", 21, B.x + 26, B.y + 44),
    lab(A, "ember: the new habit; slate: the old skill; faint: the film's full fine-tune", 15, B.x + 26, B.y + 74, INK.dim));
  items.push(darkness(300, 900, 1900, 0.3), ...host(t, A));
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
