// Visual-direction proofs for lessons L13 and L14 (PROGRESS.md). ?dir=A: L13 as crates on Pylon's
// dock, stacked by kind of episode at each look-back share, the look-back score painted on each
// stack's sign. ?dir=B: L13 as a dose curve on Pylon's printed chart. ?dir=C: L14 as a shelf of
// small lighthouses, width by numbers per word, height by floors, lamp brightness by how close the
// model came to the floor. ?dir=D: L14 as the frontier on a log-log chart.
import { rect, circle, polyline, words, darkness, rad } from "../../shared/lib.mjs";
import { night, glazing, tallow } from "../../attention/scene/room.mjs";
import { desk, pylon, K } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const KIND = { copy: "#a5452a", who: "#2d4f7a", plain: "#8e6c47" };
function crates(A, D, t) {
  const out = [...desk(t)], runs = D.lookback.runs;
  runs.forEach((r, i) => { const x = 220 + i * 260, n = 10, look = Math.round(r.lookbackShare * n), up = sm(0.2 + i * 0.4, 1.2 + i * 0.4, t);
    for (let k = 0; k < n; k++) { const kind = k < look / 2 ? "copy" : k < look ? "who" : "plain", y = 900 - k * 62 * up;
      out.push({ shape: rect(x - 70, y - 56, 140, 56, 4), fill: KIND[kind], stroke: K.ink, width: 2, opacity: up }); }
    out.push({ shape: rect(x - 90, 940, 180, 70, 6), fill: K.paper, stroke: K.ink, width: 2 }, { shape: words(`${Math.round(r.lookbackShare * 100)}%`, A.mono, 26, x, 972, "center"), fill: K.ink },
      { shape: words(`${Math.round(r.summary.copyAccuracy * 100)}% right`, A.mono, 22, x, 1000, "center"), fill: K.rust, opacity: sm(2.5, 3.5, t) }); });
  out.push(...pylon(t, 1800, 1050, 0.4));
  return out;
}
function dose(A, D, t) {
  const out = [...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 }], runs = D.lookback.runs, X = (v) => 450 + (v / 0.8) * 1000, Y = (v) => 880 - v * 680, k = Math.ceil(sm(0.3, 4, t) * runs.length);
  out.push({ shape: polyline(runs.slice(0, k).flatMap((r) => [X(r.lookbackShare), Y(r.summary.copyAccuracy)])), fill: null, stroke: K.rust, width: 5 });
  runs.slice(0, k).forEach((r) => out.push({ shape: circle(X(r.lookbackShare), Y(r.summary.copyAccuracy), 9, 16), fill: K.rust }, { shape: words(`${Math.round(r.summary.copyAccuracy * 100)}%`, A.mono, 24, X(r.lookbackShare) + 14, Y(r.summary.copyAccuracy) - 12), fill: K.ink }));
  out.push({ shape: words("share of episodes that need a look back", A.mono, 24, 960, 950, "center"), fill: K.dim }, ...pylon(t, 1745, 1015, 0.5));
  return out;
}
function shelf(A, S, t) {
  const out = [...night(t, { moon: false }), ...glazing(), { shape: rect(120, 860, 1700, 24), fill: "#3a2c18" }], runs = S.grid.runs;
  runs.forEach((r, i) => { const x = 230 + i * 135, w = 20 + r.config.dModel * 1.4, h = 80 + r.config.nLayers * 110, glow = Math.min(1, 0.03 / r.final.excess) * sm(0.3 + i * 0.25, 1 + i * 0.25, t);
    out.push({ shape: polyline([x - w / 2, 860, x - w / 3, 860 - h, x + w / 3, 860 - h, x + w / 2, 860], true), fill: "#2a2420", stroke: "#0b0a0c", width: 2 },
      { shape: circle(x, 860 - h - 14, 60, 32), blend: "add", fill: rad(x, 860 - h - 14, 60, [0, [1, 0.85, 0.5, glow]], [1, [1, 0.6, 0.3, 0]]) },
      { shape: words(`${r.final.excess.toFixed(3)}`, A.mono, 18, x, 910, "center"), fill: "#ece5d6" }); });
  out.push(darkness(300, 900, 1900, 0.3), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 140, y: 1070, s: 0.4 }));
  return out;
}
function frontier(A, S, t) {
  const out = [...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 }], P = S.frontier.points, X = (c) => 420 + ((Math.log10(c) - 7.5) / 4.2) * 1080, Y = (e) => 880 - ((Math.log10(e) + 2) / 2.6) * 700, k = Math.ceil(sm(0.3, 4.5, t) * P.length);
  out.push({ shape: polyline(P.slice(0, k).flatMap((p) => [X(p.compute), Y(p.excess)])), fill: null, stroke: K.rust, width: 4 });
  P.slice(0, k).forEach((p) => out.push({ shape: circle(X(p.compute), Y(p.excess), 6, 12), fill: K.rust }));
  out.push({ shape: words(`slope ${S.frontier.fitExcess.slope.toFixed(2)}`, A.mono, 28, 1200, 300), fill: K.ink }, ...pylon(t, 1745, 1015, 0.5));
  return out;
}
export default {
  title: `Data and scaling proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, D, S] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json"), ctx.json("../../scaling/facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, D, S };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = DIR === "A" ? crates(A, A.D, t) : DIR === "B" ? dose(A, A.D, t) : DIR === "C" ? shelf(A, A.S, t) : frontier(A, A.S, t);
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.2, threshold: 1, vignette: 0.3, grain: 0.04, passes: DIR === "C" ? [{ pass: "film", preset: "500t-print", ev: 1.6 }] : [] } };
  },
};
