// Visual-direction proofs for lesson F6 (the held-out set): one beat, three fits (degrees 1, 3 and
// 15, from facts.json) through 16 training points, with the 500 held-out points shown and the
// curves clipped to the chart. ?dir=A: plotted on Pylon's printed chart, the F1 look; ?dir=B: the
// same plot in the dark data-art look.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";
import { pylon, desk } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
export default {
  title: `Held-out proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, F };
  },
  frame(t, ctx) {
    const A = ctx.assets, p = A.F.poly, X = (x) => 960 + x * 560, Y = (y) => 560 - y * 300, light = DIR === "A", items = [];
    const ink = light ? [0.11, 0.09, 0.07] : [0.93, 0.9, 0.84], held = light ? [0.35, 0.42, 0.55] : [0.55, 0.65, 0.85];
    if (light) items.push(...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 });
    else items.push({ shape: rect(0, 0, 1920, 1080), fill: [0.02, 0.025, 0.035, 1], screen: true });
    items.push({ shape: polyline([X(-1), Y(0), X(1), Y(0)]), fill: null, stroke: [...ink, 0.3], width: 1.5 });
    p.held.x.forEach((x, i) => items.push({ shape: circle(X(x), Y(p.held.y[i]), 4, 8), fill: [...held, 0.5] }));
    const show = { 1: [0.5, ink], 3: [2.0, light ? [0.2, 0.35, 0.55] : [0.55, 0.85, 1]], 15: [3.5, [0.65, 0.27, 0.16]] };
    for (const [d, [t0, col]] of Object.entries(show)) {
      if (t < t0) continue;
      const ys = p.curves.byDegree[d], pts = [];
      p.curves.x.forEach((x, i) => { const y = Math.max(-1.7, Math.min(1.7, ys[i])); pts.push(X(x), Y(y)); });
      items.push({ shape: polyline(pts), fill: null, stroke: [...col, 0.95], width: 4 });
    }
    p.train.x.forEach((x, i) => items.push({ shape: circle(X(x), Y(p.train.y[i]), 9, 12), fill: [...ink, 1] }));
    const label = (s, y, col) => ({ shape: words(s, A.mono, 28, 380, y), fill: col, screen: true });
    items.push(label(`degree 1: held-out error ${p.degrees[1].heldRmse.toFixed(2)}`, 170, light ? "#1d1812" : "#ece5d6"));
    if (t >= 2) items.push(label(`degree 3: held-out error ${p.degrees[3].heldRmse.toFixed(2)}`, 210, light ? "#2d4f7a" : "#bcd2f2"));
    if (t >= 3.5) items.push(label(`degree 15: training error ${p.degrees[15].trainRmse.toExponential(1)}, held-out ${p.degrees[15].heldRmse.toFixed(0)}`, 250, "#a5452a"));
    items.push(...pylon(t, 1745, 1015, 0.5));
    return { background: [0.02, 0.016, 0.012], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: light ? 0.1 : 0.3, threshold: 1, vignette: 0.35, grain: 0.05, passes: [] } };
  },
};
