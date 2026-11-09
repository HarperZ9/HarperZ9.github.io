// The gradients lab, drawn: the hill in fog (a toy surface as a contour map from above or as a
// relief, the reader's path on it) or the dial (the attention model's loss as its last matrix is
// scaled, with the reader's steps on it). A Motion display list; pure in (state, time).
import { rect, circle, polyline, words } from "../../media/school/shared/lib.mjs";
import { pylon } from "../../media/school/vectors/scene/chart.mjs";
import { INK, view, relief, contours, path, night } from "../../media/school/gradients/scene/terrain.mjs";

const T = (A, s, size, x, y, fill = INK.night, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });

export function hillView(s) {
  const S = s.surface, [[x0, x1], [y0, y1]] = S.range, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return view({ cx, cy, U: 760 / (x1 - x0), tilt: s.tilt, yaw: s.tilt ? -0.4 : 0, h: S.h, hz: 55, oy: 540 });
}

function hill(s, A, t) {
  const S = s.surface, V = hillView(s), f = (x, y) => S.f(x, y), items = night();
  if (s.tilt < 1) items.push(...contours(V, f, S.range, S.levels, { a: 1 }));
  if (s.tilt > 0) items.push(...relief(V, f, S.range, { rows: 26 }));
  if (s.path.length) items.push(...path(V, f, s.path, s.path.length - 1, INK.ember));
  const last = s.path[s.path.length - 1];
  items.push({ shape: rect(40, 30, 900, 150, 10), fill: [0.03, 0.035, 0.05, 0.85], screen: true },
    T(A, `${S.name}: step ${s.step}, ${s.path.length - 1} steps taken`, 28, 66, 80),
    T(A, last ? `here (${last[0].toFixed(2)}, ${last[1].toFixed(2)}): loss ${fmt(S.f(last[0], last[1]))}` : "click the map to place your start", 28, 66, 124, INK.emberS));
  if (s.tilt === 0) items.push(T(A, "seen from above: the lines are equal heights", 22, 960, 1040, INK.dim, "center"));
  items.push(...pylon(t, 1745, 1015, 0.45));
  return items;
}

function dial(s, A, t) {
  const items = night(), X = (v) => 300 + v * 420, Y = (l) => 920 - (l / 4) * 700;
  items.push({ shape: polyline([X(0), 920, X(3), 920]), fill: null, stroke: [...INK.line, 0.5], width: 2 }, { shape: polyline([X(0), 920, X(0), 200]), fill: null, stroke: [...INK.line, 0.5], width: 2 });
  items.push({ shape: polyline(s.curve.flatMap(([v, l]) => [X(v), Y(Math.min(4, l))])), fill: null, stroke: [...INK.warm, 0.9], width: 3 });
  for (const v of [0, 1, 2, 3]) items.push(T(A, v === 1 ? "1 (as trained)" : String(v), 22, X(v), 960, INK.dim, "center"));
  if (s.dpath.length) {
    items.push({ shape: polyline(s.dpath.flatMap(([v, l]) => [X(Math.max(-0.1, Math.min(3.1, v))), Y(Math.min(4, l))])), fill: null, stroke: [...INK.ember, 0.7], width: 2 });
    const [v, l] = s.dpath[s.dpath.length - 1];
    items.push({ shape: circle(X(Math.max(-0.1, Math.min(3.1, v))), Y(Math.min(4, l)), 11, 14), fill: [...INK.ember, 1], blend: "add" });
  }
  const last = s.dpath[s.dpath.length - 1];
  items.push({ shape: rect(1050, 30, 830, 150, 10), fill: [0.03, 0.035, 0.05, 0.85], screen: true },
    T(A, `dial step ${s.dstep}, ${Math.max(0, s.dpath.length - 1)} steps`, 28, 1076, 80),
    T(A, last ? `s = ${last[0].toFixed(3)}: loss ${last[1].toFixed(4)}, slope ${last[2].toFixed(3)}` : "press Step to start at the dial's start", 28, 1076, 124, INK.emberS));
  items.push(T(A, "held-out loss as the last matrix is scaled by s; every point from the model's own forward and backward pass", 22, 960, 1040, INK.dim, "center"));
  return items;
}

const fmt = (v) => (Math.abs(v) >= 1e5 ? v.toExponential(2) : v.toFixed(4));
export function frame(s, A, t) {
  return { background: [0.02, 0.025, 0.035], camera: { x: 960, y: 540, zoom: 1 }, items: s.mode === "dial" ? dial(s, A, t) : hill(s, A, t),
    post: { bloom: 0.3, threshold: 1.0, vignette: 0.32, grain: 0, passes: [] } };
}
