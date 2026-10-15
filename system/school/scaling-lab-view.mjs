// The scaling lab, drawn in Tallow's lamp room: the shelf of the film's twelve models, the reader's
// model lit in ember, and the frontier chart with the reader's run (work against gap above the
// floor) drawn over the film's points. Pure in state.
import { night, glazing } from "../../media/school/attention/scene/room.mjs";
import { host } from "../../media/school/embeddings/scene/segs.mjs";
import { shelf, chart } from "../../media/school/scaling/scene/segs.mjs";
import { polyline, circle, words } from "../../media/school/shared/lib.mjs";

const B = { x: 600, y: 140, w: 1240, h: 640 };
const X = (c) => B.x + 60 + ((Math.log10(c) - 7.5) / 4.3) * (B.w - 120), Y = (e) => B.y + B.h - 60 - ((Math.log10(Math.max(e, 0.003)) + 2) / 2.6) * (B.h - 140);

export function frame(s, A, t) {
  const items = [...night(t, { moon: false }), ...glazing()];
  items.push(...shelf(A, s.F, { a: 0.35, hot: (i) => s.F.grid.runs[i].config.dModel === s.d && s.F.grid.runs[i].config.nLayers === s.L }), ...chart(A, s.F, t, { a: 0.9 }));
  const pts = s.curve.filter((p) => p.step > 0 && p.excess > 0);
  if (pts.length > 1) items.push({ shape: polyline(pts.flatMap((p) => [X(p.compute), Y(p.excess)])), fill: null, stroke: [0.55, 0.7, 0.85, 1], width: 4, screen: true });
  pts.forEach((p) => items.push({ shape: circle(X(p.compute), Y(p.excess), 5, 10), fill: [0.55, 0.7, 0.85, 1], screen: true }));
  const last = s.curve.at(-1);
  items.push({ shape: words(last ? `your ${s.d} x ${s.L}: lap ${last.step}, gap above the floor ${last.excess > 0 ? last.excess.toFixed(3) : "below it on these rows"}` : "choose a size and press Train", A.mono, 22, B.x + 30, B.y + 76), fill: [0.7, 0.82, 0.95], screen: true });
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, ...host(t, { rows: [] })],
    post: { bloom: 0.2, threshold: 1, vignette: 0.12, grain: 0, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
}
