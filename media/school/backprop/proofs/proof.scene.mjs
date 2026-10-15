// Visual-direction proofs for lesson F4 (backpropagation): one beat, the trained network's real
// trace for one point (facts.json chain.after): values flow down the chain, then blame flows back
// up. ?dir=A draws literal buckets on posts down the hillside (water level = value, the blame as
// a lit drip climbing back); ?dir=B draws the network as data art (nodes as lamps, weights as
// threads, the forward pass as warm sparks, the blame as ember sparks going the other way).
import { rect, circle, polyline, words } from "../../shared/lib.mjs";
import { pylon } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

export default {
  title: `Backprop proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, F };
  },
  frame(t, ctx) {
    const A = ctx.assets, ch = A.F.chain.after, layers = [ch.input.value, ch.hidden1.value, ch.hidden2.value, ch.output.probs];
    const grads = [null, ch.hidden1.gradOut, ch.hidden2.gradOut, ch.output.gradLogits];
    const fwd = sm(0.3, 2.6, t), back = sm(3.0, 5.6, t), items = [{ shape: rect(0, 0, 1920, 1080), fill: [0.02, 0.025, 0.035, 1], screen: true }];
    const pos = (l, i) => { const n = layers[l].length; return DIR === "A" ? [320 + l * 420 + (i - (n - 1) / 2) * 34, 220 + l * 190 + (i - (n - 1) / 2) * 52] : [360 + l * 400, 540 + (i - (n - 1) / 2) * 92]; };
    // Links between layers.
    for (let l = 0; l < 3; l++) for (let i = 0; i < layers[l].length; i++) for (let j = 0; j < layers[l + 1].length; j++) {
      const p = pos(l, i), q = pos(l + 1, j);
      items.push({ shape: polyline([...p, ...q]), fill: null, stroke: DIR === "A" ? [0.55, 0.45, 0.32, 0.25] : [0.75, 0.82, 0.95, 0.07], width: DIR === "A" ? 2 : 1, blend: DIR === "A" ? undefined : "add" });
      const uF = fwd * 3 - l, uB = back * 3 - (2 - l);
      if (uF > 0 && uF < 1 && (i + j) % 3 === 0) items.push({ shape: circle(p[0] + (q[0] - p[0]) * uF, p[1] + (q[1] - p[1]) * uF, 4, 8), fill: [1, 0.9, 0.7, 0.9], blend: "add" });
      if (uB > 0 && uB < 1 && (i + j) % 3 === 0) items.push({ shape: circle(q[0] + (p[0] - q[0]) * uB, q[1] + (p[1] - q[1]) * uB, 5, 8), fill: [0.95, 0.5, 0.35, 0.95], blend: "add" });
    }
    layers.forEach((vals, l) => vals.forEach((v, i) => {
      const [x, y] = pos(l, i), lit = Math.min(1, Math.abs(v)), on = fwd * 3 >= l - 0.2, g = grads[l] ? grads[l][i] : 0, blamed = back * 3 >= 3 - l - 0.2 && l > 0;
      if (DIR === "A") {
        items.push({ shape: polyline([x - 16, y - 18, x + 16, y - 18, x + 12, y + 18, x - 12, y + 18], true), fill: [0.12, 0.1, 0.08, 1], stroke: [0.6, 0.48, 0.3, 1], width: 2 });
        if (on) items.push({ shape: rect(x - 11, y + 16 - 32 * lit, 22, 32 * lit), fill: v >= 0 ? [0.45, 0.6, 0.8, 0.9] : [0.35, 0.4, 0.55, 0.9] });
        if (blamed) items.push({ shape: circle(x + 22, y - 22, 3 + 10 * Math.min(1, Math.abs(g) * 2), 10), fill: [0.95, 0.5, 0.35, 0.95], blend: "add" });
      } else {
        items.push({ shape: circle(x, y, 26, 20), fill: [1, 0.85, 0.6, on ? 0.08 + 0.6 * lit : 0.05], blend: "add" }, { shape: circle(x, y, 14, 16), fill: [0.1, 0.1, 0.12, 1], stroke: [0.75, 0.82, 0.95, 0.6], width: 1.5 });
        if (blamed) items.push({ shape: circle(x, y, 30 + 30 * Math.min(1, Math.abs(g) * 2), 24), fill: null, stroke: [0.95, 0.5, 0.35, 0.8], width: 3 });
        if (on) items.push({ shape: words(v.toFixed(2), A.mono, 18, x, y + 48, "center"), fill: "#958e80" });
      }
    }));
    items.push({ shape: words(back > 0 ? "blame, passed back: the gradient arriving at each bucket" : "forward: each bucket's value", A.mono, 30, 960, 80, "center"), fill: "#ece5d6", screen: true });
    items.push(...pylon(t, 1745, 1015, 0.45));
    return { background: [0, 0, 0], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.3, threshold: 1, vignette: 0.3, grain: 0.05, passes: [] } };
  },
};
