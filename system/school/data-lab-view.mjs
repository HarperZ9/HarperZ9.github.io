// The data lab, drawn on Pylon's dock: the reader's crate mix as a stack (copy rust, who blue, plain
// wood, crosses for wrong labels), and a board with the run's held-out loss (rust) and look-back
// accuracy (blue) against the film's default run (faint). Pure in state.
import { rect, polyline, words } from "../../media/school/shared/lib.mjs";
import { K, desk, pylon } from "../../media/school/vectors/scene/chart.mjs";
import { stack } from "../../media/school/data/scene/segs.mjs";

const B = { x: 860, y: 140, w: 860, h: 600 };
const X = (s, max) => B.x + 40 + (s / max) * (B.w - 80), Y = (v) => B.y + B.h - 40 - (Math.min(v, 4) / 4) * (B.h - 110);
const line = (pts, max, col, w = 4) => (pts.length > 1 ? [{ shape: polyline(pts.flatMap(([s, v]) => [X(s, max), Y(v)])), fill: null, stroke: col, width: w }] : []);

export function frame(s, A, t) {
  const marks = Math.round(s.noise * 10), every = marks ? Math.floor(10 / marks) : 0;
  const items = [...desk(t), ...stack(A, 420, s.look, { marked: (k) => every > 0 && k % every === 0 && k / every < marks, sign: s.pool ? `${s.pool} rows, repeated` : "fresh rows", score: `${Math.round(s.look * 100)}% look back` })];
  items.push({ shape: rect(B.x, B.y, B.w, B.h, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 });
  const max = s.steps;
  items.push(...line(s.film.filter((p) => p.step <= max).map((p) => [p.step, p.heldOut]), max, [0.35, 0.3, 0.22, 0.35], 3), ...line(s.curve.map((p) => [p.step, p.heldOut]), max, K.rust), ...line(s.curve.map((p) => [p.step, p.lookback * 4]), max, "#2d4f7a", 3));
  const last = s.curve.at(-1);
  items.push({ shape: words(last ? `lap ${last.step}: held-out loss ${last.heldOut.toFixed(2)}; look-back words ${Math.round(last.lookback * 100)}% right` : "choose a mix and press Train", A.mono, 22, B.x + 30, B.y + 46), fill: K.ink },
    { shape: words("rust: held-out loss; blue: look-back right (top = 100%); faint: the film's default run", A.mono, 18, B.x + 30, B.y + 78), fill: K.dim });
  items.push(...pylon(t, 1790, 1050, 0.42));
  return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.1, threshold: 1, vignette: 0.38, grain: 0.05, passes: [] } };
}
