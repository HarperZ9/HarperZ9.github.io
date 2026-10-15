// The optimisers lab, drawn: the race on a hill from above (the reader's three walkers, their paths
// and counters), or the spiral network's held-out accuracy for every run the reader has made.
import { rect, circle, polyline, words } from "../../media/school/shared/lib.mjs";
import { pylon } from "../../media/school/vectors/scene/chart.mjs";
import { INK, view, contours, night } from "../../media/school/gradients/scene/terrain.mjs";

export const COL = { sgd: INK.warm, momentum: INK.line, adam: INK.ember };
const HEX = { sgd: "#ddd6c8", momentum: "#bcd2f2", adam: "#e29472" }, NAME = { sgd: "careful steps", momentum: "heavy ball", adam: "Adam" };
const T = (A, s, size, x, y, fill = INK.night, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });
export const hillView = (H) => view({ cx: H.cx, cy: H.cy, U: H.U, tilt: 0, yaw: 0 });

function race(s, A, t) {
  const H = s.hill, V = hillView(H), items = [...night(), ...contours(V, (x, y) => H.f(x, y), H.range, H.levels, { n: 80 })];
  s.runs.forEach((r) => {
    const upto = Math.min(s.k, r.path.length - 1), stride = Math.max(1, Math.floor(upto / 400)), pts = [];
    for (let i = 0; i <= upto; i += stride) { const p = r.path[i]; if (Math.abs(p[0]) > 8 || Math.abs(p[1]) > 8) break; pts.push(...V.P(p[0], p[1], 0)); }
    if (pts.length >= 4) items.push({ shape: polyline(pts), fill: null, stroke: [...COL[r.name], 0.8], width: 2.5, blend: "add" });
    const p = r.path[upto]; if (Math.abs(p[0]) < 8 && Math.abs(p[1]) < 8) items.push({ shape: circle(...V.P(p[0], p[1], 0), 10, 14), fill: [...COL[r.name], 1], blend: "add" });
  });
  items.push({ shape: rect(40, 30, 980, 80 + 40 * s.runs.length, 10), fill: [0.03, 0.035, 0.05, 0.85], screen: true }, T(A, `${H.name}: update ${s.k.toLocaleString("en")}`, 28, 66, 76));
  s.runs.forEach((r, i) => { const p = r.path[Math.min(s.k, r.path.length - 1)]; items.push(T(A, `${NAME[r.name]} (step ${r.hp.lr}): ${r.diverged && s.k >= r.path.length - 1 ? "flew off" : r.stepsToThreshold !== null && s.k >= r.stepsToThreshold ? `down at ${r.stepsToThreshold.toLocaleString("en")}` : `loss ${p[2].toPrecision(3)}`}`, 24, 66, 118 + i * 38, HEX[r.name])); });
  items.push(T(A, "click the map to move the start", 22, 960, 1040, INK.dim, "center"), ...pylon(t, 1745, 1015, 0.45));
  return items;
}

function network(s, A, t) {
  const items = night(), X = (st) => 220 + (st / 4000) * 1100, Y = (v) => 880 - v * 620;
  items.push({ shape: polyline([X(0), Y(0.95), X(4000), Y(0.95)]), fill: null, stroke: [...INK.line, 0.3], width: 1 }, T(A, "95%", 20, X(4000) + 10, Y(0.95) + 6, INK.dim));
  items.push({ shape: polyline([X(0), 880, X(4000), 880]), fill: null, stroke: [...INK.line, 0.4], width: 2 }, T(A, "updates", 20, X(2000), 920, INK.dim, "center"), T(A, "held-out accuracy on the spirals", 22, 220, 220, INK.dim));
  s.nets.forEach((n, i) => {
    const a = i === s.nets.length - 1 ? 1 : 0.35;
    items.push({ shape: polyline(n.curve.flatMap((p) => [X(p.step), Y(p.heldAccuracy)])), fill: null, stroke: [...COL[n.name], a], width: i === s.nets.length - 1 ? 3.5 : 2 });
    if (i >= s.nets.length - 6) items.push(T(A, `${NAME[n.name]}, step ${n.lr}: ${(n.curve.at(-1).heldAccuracy * 100).toFixed(1)}%${n.first ? `, past 95% at ${n.first}` : ""}`, 22, 1380, 300 + (i - Math.max(0, s.nets.length - 6)) * 36, HEX[n.name]));
  });
  if (!s.nets.length) items.push(T(A, "pick a walker and a step, then press Train the network", 26, 760, 520, INK.night, "center"));
  items.push(...pylon(t, 1745, 1015, 0.45));
  return items;
}

export function frame(s, A, t) {
  return { background: [0.02, 0.025, 0.035], camera: { x: 960, y: 540, zoom: 1 }, items: s.mode === "net" ? network(s, A, t) : race(s, A, t), post: { bloom: 0.3, threshold: 1, vignette: 0.32, grain: 0, passes: [] } };
}
