// The backprop lab, drawn: on the left the spirals with the network's live boundary and the chosen
// point; on the right the bucket chain for that point (its values and the blame arriving at each
// bucket); and, when shown, the check of every layer against nudging. A display list; pure.
import { rect, circle, words } from "../../media/school/shared/lib.mjs";
import { chain, INK, night } from "../../media/school/backprop/scene/chain.mjs";

const T = (A, s, size, x, y, fill = INK.night, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });
export const MAP = { x: 40, y: 260, size: 420, range: 1.2 };
export const toMap = (u, v) => [MAP.x + ((u + MAP.range) / (2 * MAP.range)) * MAP.size, MAP.y + MAP.size - ((v + MAP.range) / (2 * MAP.range)) * MAP.size];

export function frame(s, A, t) {
  const items = night(), n = s.grid.length, c = MAP.size / n;
  items.push({ shape: rect(MAP.x, MAP.y, MAP.size, MAP.size, 6), fill: [0.05, 0.05, 0.07, 1], stroke: [0.5, 0.5, 0.55, 0.6], width: 1.5 });
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const p = s.grid[j][i]; items.push({ shape: rect(MAP.x + i * c, MAP.y + MAP.size - (j + 1) * c, c + 0.5, c + 0.5), fill: p > 0.5 ? [...INK.ember, 0.3 * (p - 0.5) * 2] : [...INK.water, 0.3 * (0.5 - p) * 2] }); }
  s.held.X.forEach(([u, v], k) => items.push({ shape: circle(...toMap(u, v), 3, 6), fill: s.held.Y[k] ? [...INK.ember, 0.9] : [...INK.water, 0.9] }));
  const [px, py] = toMap(...s.point);
  items.push({ shape: circle(px, py, 12, 16), fill: null, stroke: [1, 1, 1, 0.9], width: 3 });
  items.push(T(A, "click a point to trace it", 22, MAP.x, MAP.y + MAP.size + 34, INK.dim));
  items.push(...chain(A, s.trace, { fwd: 4, back: 3, broken: s.broken ? 2 : -1 }));
  items.push({ shape: rect(40, 30, 1400, 150, 10), fill: [0.03, 0.035, 0.05, 0.85], screen: true },
    T(A, `step ${s.step}: held-out accuracy ${(s.acc * 100).toFixed(1)}%, loss ${s.loss.toFixed(3)}`, 28, 66, 80),
    T(A, `this point: class ${s.trace.label}, the network says ${(s.trace.output.probs[1] * 100).toFixed(0)}% class 1, loss ${s.trace.loss.toFixed(3)}`, 26, 66, 124, INK.emberS));
  if (s.check) {
    const names = Object.keys(s.check.perTensor), X = (v) => 1200 + 50 * (Math.log10(Math.max(v, 1e-12)) + 12);
    items.push({ shape: rect(1130, 620, 760, 400, 10), fill: [0.03, 0.035, 0.05, 0.9], screen: true }, T(A, s.broken ? "check with one link broken" : "check: nudging against the walk back", 24, 1150, 660, s.broken ? INK.emberS : INK.night));
    names.forEach((nm, i) => { const v = s.check.perTensor[nm], bad = v > 1e-3, y = 700 + i * 46; items.push(T(A, nm, 22, 1150, y + 8, INK.dim), { shape: rect(1200, y - 10, Math.max(2, X(v) - 1200), 24, 3), fill: bad ? [...INK.ember, 0.95] : [...INK.warm, 0.8], screen: true }, T(A, v.toExponential(1), 20, Math.min(1800, X(v) + 10), y + 8, bad ? INK.emberS : INK.dim)); });
  }
  return { background: [0.02, 0.025, 0.035], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.25, threshold: 1.0, vignette: 0.3, grain: 0, passes: [] } };
}
