// The training-loop lab, drawn on Pylon's dock: the track with the cart at the current lap, the
// station being run lit, and the tally board with the reader's held-out curve (rust) and copy rate
// (blue) against the film's run (faint). Pure in state.
import { rect, circle, polyline, words } from "../../media/school/shared/lib.mjs";
import { K, desk, pylon } from "../../media/school/vectors/scene/chart.mjs";

const TR = { x: 560, y: 560, r: 300 }, BOARD = { x: 1010, y: 160, w: 780, h: 560 }, TAU = Math.PI * 2;
const STATIONS = ["batch", "forward + loss", "backward", "step"];
const X = (v, max) => BOARD.x + 40 + (v / max) * (BOARD.w - 80), Y = (v, max) => BOARD.y + BOARD.h - 40 - (Math.min(v, max) / max) * (BOARD.h - 110);
const line = (pts, max, ymax, stroke, width = 4) => (pts.length > 1 ? [{ shape: polyline(pts.flatMap(([a, b]) => [X(a, max), Y(b, ymax)])), fill: null, stroke, width }] : []);

export function frame(s, A, t) {
  const items = [...desk(t)], { x, y, r } = TR, c = ((s.lap % 1) * TAU) - Math.PI / 2;
  items.push({ shape: circle(x, y, r, 128), fill: null, stroke: "#3a2c1c", width: 20 }, { shape: circle(x, y, r, 128), fill: null, stroke: K.paper2, width: 8 });
  STATIONS.forEach((n, i) => { const b = (i / 4) * TAU - Math.PI / 2, sx = x + Math.cos(b) * r, sy = y + Math.sin(b) * r, w = n.length * 15 + 40, hot = s.running && i === Math.floor((s.lap % 1) * 4);
    items.push({ shape: rect(sx - w / 2, sy - 34, w, 68, 8), fill: hot ? K.rust : K.paper, stroke: K.ink, width: 2 }, { shape: words(n, A.sans, 28, sx, sy + 10, "center"), fill: hot ? "#f3ead2" : K.ink }); });
  items.push({ shape: rect(x + Math.cos(c) * (r - 56) - 26, y + Math.sin(c) * (r - 56) - 18, 52, 36, 6), fill: "#8e6c47", stroke: K.ink, width: 3 },
    { shape: words(`lap ${s.step.toLocaleString("en")}`, A.mono, 40, x, y + 14, "center"), fill: "#f1e4c8" });
  items.push({ shape: rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 });
  const max = s.steps;
  items.push(...line(s.film.map((p) => [p.step, p.heldOut]).filter(([a]) => a <= max), max, 4, [0.35, 0.3, 0.22, 0.35], 3), ...line(s.curve.map((p) => [p.step, p.heldOut]), max, 4, K.rust), ...line(s.curve.map((p) => [p.step, p.copyAccuracy * 4]), max, 4, "#2d4f7a", 3));
  const last = s.curve.at(-1);
  items.push({ shape: words(last ? `lap ${last.step}: held-out loss ${last.heldOut.toFixed(2)}, copies ${Math.round(last.copyAccuracy * 100)}%` : "press Train", A.mono, 24, BOARD.x + 30, BOARD.y + 50), fill: K.ink },
    { shape: words("faint: the film's run", A.mono, 20, BOARD.x + 30, BOARD.y + 84), fill: K.dim });
  items.push(...pylon(t, 1780, 1050, 0.45));
  return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.1, threshold: 1, vignette: 0.38, grain: 0.05, passes: [] } };
}
