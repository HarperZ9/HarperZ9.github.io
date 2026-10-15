// Visual-direction proofs for lesson L8 (embeddings): one beat, the 46 words' places moving from
// the start of training to its end, on the final table's two principal axes (facts.json
// trackOnFinalAxes). ?dir=A: cards hanging in Tallow's lamp room, lit by the lens; ?dir=B: labelled
// dots on Pylon's printed chart.
import { rect, circle, polyline, words, darkness, glow } from "../../shared/lib.mjs";
import { night, glazing, lens, tallow, LENS } from "../../attention/scene/room.mjs";
import { desk, pylon, K } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
export default {
  title: `Embeddings proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, F };
  },
  frame(t, ctx) {
    const A = ctx.assets, S = A.F.training.snapshots, u = sm(0.5, 5.5, t) * (S.length - 1), i = Math.min(S.length - 2, Math.floor(u)), f = u - i;
    const P = S[i].trackOnFinalAxes.map((p, k) => { const q = S[i + 1].trackOnFinalAxes[k]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; });
    const X = (x) => 960 + x * 230, Y = (y) => 560 - y * 170, items = [];
    if (DIR === "A") {
      items.push(...night(t), ...glazing(), ...lens(t, { a: t * 0.8, lamp: 0.8 }));
      A.F.words.forEach((w, k) => { const x = X(P[k][0]), y = Y(P[k][1]), lit = Math.max(0.2, 1 - Math.hypot(x - LENS.x, y - LENS.y) / 1400);
        items.push({ shape: polyline([x, 0, x, y - 22]), fill: null, stroke: [0.4, 0.35, 0.3, 0.4], width: 1 }, { shape: rect(x - 44, y - 22, 88, 40, 3), fill: [0.85 * lit + 0.1, 0.8 * lit + 0.1, 0.68 * lit + 0.08, 1], stroke: "#2a2219", width: 1.5 }, { shape: words(w, A.sans, 22, x, y + 6, "center"), fill: "#1d1812" }); });
      items.push(darkness(LENS.x - 200, LENS.y + 100, 1500, 0.45), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 1700, y: 1060, s: 0.45 }));
    } else {
      items.push(...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: [0.9, 0.85, 0.71, 1], stroke: "#3a2c1c", width: 4 });
      A.F.words.forEach((w, k) => items.push({ shape: circle(X(P[k][0]), Y(P[k][1]), 5, 10), fill: K.ink }, { shape: words(w, A.sans, 22, X(P[k][0]) + 9, Y(P[k][1]) - 6), fill: K.ink }));
      items.push(...pylon(t, 1745, 1015, 0.5));
    }
    items.push({ shape: words(`${Math.round(S[i].fraction * 100 + f * (S[i + 1].fraction - S[i].fraction) * 100)}% of training: same-kind neighbours ${Math.round((S[i].share.top1 + f * (S[i + 1].share.top1 - S[i].share.top1)) * 100)}%`, A.mono, 28, 80, 70), fill: DIR === "A" ? "#ece5d6" : "#1d1812", screen: true });
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.2, threshold: 1, vignette: 0.3, grain: 0.05, passes: DIR === "A" ? [{ pass: "film", preset: "500t-print", ev: 1.6 }] : [] } };
  },
};
