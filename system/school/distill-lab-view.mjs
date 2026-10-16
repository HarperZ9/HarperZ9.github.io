// The distillation lab, drawn in Tallow's lamp room: the teacher's wheel after "tallow found a" at
// the chosen temperature (left), the reader's student's wheel for the same words, live (right), and
// a board with the student's held-out loss over the film's runs (faint). Pure in state.
import { rect, polyline, words, darkness } from "../../media/school/shared/lib.mjs";
import { host } from "../../media/school/embeddings/scene/segs.mjs";
import { night, glazing } from "../../media/school/attention/scene/room.mjs";
import { wheel, pointer, INK } from "../../media/school/nextword/scene/wheel.mjs";

const TW = { x: 680, y: 380, r: 220 }, SW = { x: 1170, y: 420, r: 150 }, B = { x: 1380, y: 140, w: 500, h: 560 };
const LMAX = 5;
const X = (s, max) => B.x + 50 + (s / max) * (B.w - 90), Y = (v) => B.y + B.h - 50 - (Math.min(v, LMAX) / LMAX) * (B.h - 130);
const line = (pts, max, col, w = 4) => (pts.length > 1 ? [{ shape: polyline(pts.flatMap(([s, v]) => [X(s, Math.max(max, 1)), Y(v)])), fill: null, stroke: col, width: w }] : []);
const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a });
// Order slots by the teacher's T 1 shares so the two wheels line up word for word.
const order = (s) => s.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i);

export function frame(s, A, t) {
  const o = order(s.teacher1), pick = (d) => o.map((i) => d[i]), names = o.map((i) => s.vocab[i]);
  const items = [...night(t, { moon: false }), ...glazing()];
  items.push(...wheel(A, pick(s.teacher), names, { at: TW, pct: (k) => k < 3, minLabel: 0.045, size: 24 }), ...pointer(TW));
  items.push(...wheel(A, pick(s.student), names, { at: SW, minLabel: 0.06, size: 20 }), ...pointer(SW));
  items.push(lab(A, s.target === "hard" ? "the text's words: one slot each time" : s.target === "argmax" ? "the teacher's top word, as if certain" : s.target === "oracle" ? `the rules' own odds, temperature ${s.T}` : `the teacher, temperature ${s.T}`, 22, TW.x, TW.y + TW.r + 60, INK.night, "center"),
    lab(A, "your student", 22, SW.x, SW.y + SW.r + 60, INK.night, "center"), lab(A, 'after "tallow found a"', 22, 900, 80, INK.dim, "center"));
  items.push({ shape: rect(B.x, B.y, B.w, B.h, 8), fill: [0.05, 0.05, 0.06, 0.85], stroke: "#3a2c18", width: 3 });
  for (const v of [1, 2, 3, 4]) items.push({ shape: rect(B.x + 50, Y(v), B.w - 90, 1), fill: [0.6, 0.55, 0.45, 0.25] }, lab(A, `${v}`, 16, B.x + 22, Y(v) + 6, INK.dim));
  items.push({ shape: rect(B.x + 50, Y(s.teacherLoss), B.w - 90, 2), fill: [0.89, 0.58, 0.45, 0.5] }, lab(A, `teacher ${s.teacherLoss.toFixed(2)}`, 16, B.x + B.w - 40, Y(s.teacherLoss) - 8, INK.ember, "right"));
  const max = s.steps;
  for (const c of s.film) items.push(...line(c.points.filter((p) => p.step <= max).map((p) => [p.step, p.heldOut]), max, [0.75, 0.7, 0.6, 0.3], 3));
  items.push(...line(s.curve.map((p) => [p.step, p.heldOut]), max, INK.ember));
  const last = s.curve.at(-1);
  items.push(lab(A, last ? `step ${last.step}: held-out loss ${last.heldOut.toFixed(2)}` : "choose a teacher and press Train", 22, B.x + 30, B.y + 44),
    lab(A, `ember: your student; faint: the film's ${s.filmLabel}`, 16, B.x + 30, B.y + 74, INK.dim));
  items.push(darkness(300, 900, 1900, 0.3), ...host(t, A));
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
