// Visual-direction proofs for lesson F5 (optimisers): the race on Rosenbrock's narrow valley, each
// walker at the step facts.json chose, run here with the lesson's own update rules and synced by
// update count on a log clock. ?dir=A: the F3 relief in fog with three trails; ?dir=B: from above
// on the contour map, with Adam's per-direction step drawn as an ellipse at its lantern.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";
import { pylon } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";
import { INK, view, relief, contours, night } from "../../gradients/scene/terrain.mjs";
import { ROSENBROCK } from "../../../../system/school/gradients.mjs";
import { run2d, RACE_BASE } from "../../../../system/school/optimisers.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const COL = { sgd: INK.warm, momentum: INK.line, adam: INK.ember };

export default {
  title: `Optimisers proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    const E = F.races.rosenbrock.entrants, runs = {};
    for (const n of ["sgd", "momentum", "adam"]) runs[n] = run2d(ROSENBROCK, [-1.2, 1], n, { ...RACE_BASE[n], lr: E[n].chosenLr }, { steps: 17000, threshold: 1e-4 });
    return { sans, mono, F, runs };
  },
  frame(t, ctx) {
    const A = ctx.assets, k = Math.floor(10 ** (4.25 * Math.min(1, t / 5.5))), f = (x, y) => ROSENBROCK.f(x, y), lg = (z) => 2.3 * Math.log10(1 + Math.max(0, z));
    const V = DIR === "A" ? view({ cx: 0, cy: 1, U: 220, tilt: 1, yaw: -0.3, h: lg, hz: 60 }) : view({ cx: -0.1, cy: 1.05, U: 230, tilt: 0, yaw: 0 });
    const items = night();
    if (DIR === "A") items.push(...relief(V, f, [[-2, 2], [-1, 3]], { rows: 30 }));
    else items.push(...contours(V, f, [[-2, 2], [-1, 3]], [0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000], { n: 90 }));
    const lines = [];
    for (const [n, r] of Object.entries(A.runs)) {
      const upto = Math.min(k, r.path.length - 1), stride = Math.max(1, Math.floor(upto / 400)), pts = [];
      for (let i = 0; i <= upto; i += stride) pts.push(...V.P(r.path[i][0], r.path[i][1], DIR === "A" ? f(r.path[i][0], r.path[i][1]) : 0));
      const [x, y, fv] = r.path[upto], here = V.P(x, y, DIR === "A" ? f(x, y) : 0);
      items.push({ shape: polyline(pts.length >= 4 ? pts : [...here, ...here]), fill: null, stroke: [...COL[n], 0.8], width: 2.5, blend: "add" }, { shape: circle(...here, 10, 14), fill: [...COL[n], 1], blend: "add" });
      if (DIR === "B" && n === "adam" && r.path[upto]) items.push({ shape: polyline(Array.from({ length: 33 }, (_, j) => { const a = (j / 32) * Math.PI * 2; return [here[0] + 46 * Math.cos(a), here[1] + 14 * Math.sin(a)]; }).flat(), true), fill: null, stroke: [...INK.ember, 0.6], width: 2 });
      lines.push(`${n.padEnd(9)} loss ${fv.toPrecision(3)}${r.stepsToThreshold !== null && k >= r.stepsToThreshold ? "  (down)" : ""}`);
    }
    items.push({ shape: words(`update ${k.toLocaleString("en")}`, A.mono, 34, 80, 80), fill: "#ece5d6", screen: true });
    lines.forEach((s, i) => items.push({ shape: words(s, A.mono, 26, 80, 130 + i * 38), fill: ["#ddd6c8", "#bcd2f2", "#e29472"][i], screen: true }));
    items.push(...pylon(t, 1745, 1015, 0.45));
    return { background: [0.02, 0.025, 0.035], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.3, threshold: 1, vignette: 0.32, grain: 0.05, passes: [] } };
  },
};
