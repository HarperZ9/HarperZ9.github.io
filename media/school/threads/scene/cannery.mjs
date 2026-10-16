// The cannery (PROGRESS.md, step 53), Pylon's place for the GPU lessons: a floor of workers (threads)
// in crews coloured by workgroup, the warehouse shelf of cans (global memory) above, and trips drawn
// as lines from worker to can. Every count drawn is a facts.json value; nothing here invents one.
import { rect, circle, polyline, words, darkness } from "../../shared/lib.mjs";
import { pylon } from "../../vectors/scene/chart.mjs";

export const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", paper: [0.85, 0.8, 0.7, 1] };
export const CREW = [[0.89, 0.58, 0.45], [0.55, 0.7, 0.85], [0.75, 0.85, 0.6], [0.85, 0.75, 0.55]];
export const lab = (A, s, size, x, y, fill = INK.night, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
export const plate = (x, y, w, h, a = 0.7) => ({ shape: rect(x, y, w, h, 10), fill: [0.03, 0.03, 0.04, a], screen: true });
export function floor() {
  const out = [{ shape: rect(0, 0, 1920, 1080), fill: [0.1, 0.09, 0.08, 1] }];
  for (let i = 0; i < 24; i++) out.push({ shape: rect(i * 80, 0, 2, 1080), fill: [0.2, 0.18, 0.16, 1] });
  return out;
}
export const scene = (t, A, items, talk = 0) => ({ items: [...items, darkness(300, 900, 900, 0.25), ...pylon(t, 1780, 1010, 0.4, { talk })], camera: { x: 960, y: 540, zoom: 1 } });
// The shelf: n cans from x0 at pitch p; hot(i) lights a can, guard(i) marks a guard can past the end.
export function shelf(A, n, { x0 = 160, y = 140, p = 36, hot = () => false, guard = () => false, label = "the warehouse: global memory", a = 1 } = {}) {
  const out = [{ shape: rect(x0 - 20, y - 20, n * p + 30, 90, 6), fill: [0.3, 0.25, 0.2, a], stroke: "#0b0a0c", width: 3 }, lab(A, label, 20, x0 - 10, y - 30, INK.dim, "left", a)];
  for (let i = 0; i < n; i++) out.push({ shape: rect(x0 + i * p, y, p - 6, 50, 3), fill: guard(i) ? [0.49, 0.61, 0.77, a] : hot(i) ? [0.89, 0.58, 0.45, a] : [...INK.paper.slice(0, 3), a] });
  return out;
}
// Workers in rows of crews: map is a list of {workgroup, local, global, runs}; at(i) gives a worker's place.
export function workers(map, at, { hot = () => false, idleCone = true, a = 1 } = {}) {
  const out = [];
  map.forEach((w, i) => { const [x, y] = at(i), c = CREW[w.workgroup % CREW.length];
    out.push({ shape: circle(x, y, 13, 16), fill: w.runs ? [...c, a] : [0.3, 0.28, 0.25, a], stroke: hot(i) ? "#ece5d6" : "#0b0a0c", width: hot(i) ? 4 : 2 });
    if (!w.runs && idleCone) out.push({ shape: polyline([x - 7, y - 14, x, y - 32, x + 7, y - 14], true), fill: [0.95, 0.55, 0.2, a] }); });
  return out;
}
export const trip = (x0, y0, x1, y1, col, a = 0.7) => ({ shape: polyline([x0, y0, x1, y1]), fill: null, stroke: [...col, a], width: 2 });
