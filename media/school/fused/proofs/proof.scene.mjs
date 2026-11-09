// Visual-direction proofs for lessons K23 (fused attention) and K24 (fp16, bf16, tensor cores),
// PROGRESS.md step 65. Every number here is an illustration and says so.
// ?dir=A: the cannery: the unfused crew writes the whole score table to the warehouse as a wall of
// cans; the fused crew keeps one tile on its bench with a running-max dial. ?dir=B: tiles of Q rows
// sweeping blocks of K and V, a running max and running sum as two gauges. ?dir=C: three measuring
// jugs (fp32, bf16, fp16): marks spacing is precision, jug height is range. ?dir=D: a number line
// near 110 with the representable values of each format as ticks.
import { rect, circle, polyline, words, darkness, GUIDES } from "../../shared/lib.mjs";
import { floor, shelf } from "../../threads/scene/cannery.mjs";
import { pylon } from "../../vectors/scene/chart.mjs";
import { night, glazing, tallow } from "../../attention/scene/room.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const INK = "#ece5d6", DIM = "#958e80", EMBER = [0.89, 0.58, 0.45];
const lab = (A, s, size, x, y, fill = INK, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });

function wall(A, t) {
  const out = [...floor(), lab(A, "unfused: every score goes to the warehouse", 22, 160, 120), lab(A, "fused: one tile at a time on the bench", 22, 1060, 120)], n = Math.floor(sm(0.5, 4, t) * 256);
  for (let k = 0; k < n; k++) out.push({ shape: rect(160 + (k % 16) * 44, 160 + Math.floor(k / 16) * 40, 38, 34, 3), fill: [0.85, 0.8, 0.7, 1] });
  out.push({ shape: rect(1060, 300, 360, 180, 8), fill: [0.35, 0.28, 0.2, 1], stroke: "#0b0a0c", width: 3 });
  for (let k = 0; k < 16; k++) out.push({ shape: rect(1080 + (k % 8) * 42, 320 + Math.floor(k / 8) * 70, 36, 50, 3), fill: [...EMBER, 1] });
  const ang = -2.2 + 2.6 * sm(0.5, 5, t);
  out.push({ shape: circle(1600, 390, 90, 40), fill: [0.15, 0.13, 0.11, 1], stroke: "#b8892e", width: 4 }, { shape: polyline([1600, 390, 1600 + Math.cos(ang) * 80, 390 + Math.sin(ang) * 80]), fill: null, stroke: [...EMBER, 1], width: 5 }, lab(A, "running max", 20, 1600, 510, DIM, "center"));
  out.push(lab(A, "illustration", 20, 1700, 1040, DIM), ...pylon(t, 1780, 1010, 0.4));
  return out;
}
function sweep(A, t) {
  const out = [{ shape: rect(0, 0, 1920, 1080), fill: [0.012, 0.011, 0.014, 1] }], c = 34, k = Math.floor(sm(0.5, 5, t) * 4) * 4;
  const g = (x0, y0, n, m, hot, name) => { for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out.push({ shape: rect(x0 + j * c, y0 + i * c, c - 3, c - 3, 3), fill: hot(i, j) ? [...EMBER, 1] : [0.3, 0.27, 0.24, 1] }); out.push(lab(A, name, 24, x0, y0 - 14)); };
  g(200, 260, 16, 4, (i) => i < 4, "Q"); g(500, 260, 16, 4, (i) => i >= k && i < k + 4, "K"); g(800, 260, 16, 4, (i) => i >= k && i < k + 4, "V");
  [["running max", 0.4 + 0.5 * sm(0.5, 5, t)], ["running sum", 0.2 + 0.7 * sm(0.5, 5, t)]].forEach(([n, v], i) => { out.push({ shape: rect(1200, 300 + i * 160, 500, 30, 4), fill: [0.3, 0.27, 0.24, 1] }, { shape: rect(1200, 300 + i * 160, 500 * v, 30, 4), fill: [0.9, 0.86, 0.75, 1] }, lab(A, n, 22, 1200, 290 + i * 160)); });
  out.push(lab(A, "illustration", 20, 1700, 1040, DIM));
  return out;
}
function jugs(A, t) {
  const out = [...night(t, { moon: false }), ...glazing()], specs = [["fp32", 700, 64], ["bf16", 700, 8], ["fp16", 380, 16]];
  specs.forEach(([n, h, marks], i) => { const x = 560 + i * 380, y0 = 900, u = sm(0.5, 3, t);
    out.push({ shape: rect(x, y0 - h, 200, h, 10), fill: [0.6, 0.7, 0.8, 0.15], stroke: [0.9, 0.95, 1, 0.7], width: 3 }, { shape: rect(x, y0 - h * 0.55 * u, 200, h * 0.55 * u, 6), fill: [...EMBER, 0.7] });
    for (let m = 1; m < marks; m++) out.push({ shape: rect(x, y0 - (h * m) / marks, 30, 2), fill: [0.9, 0.9, 0.9, 0.8] });
    out.push(lab(A, n, 26, x + 100, y0 + 40, INK, "center")); });
  out.push(lab(A, "illustration: marks are precision, height is range", 20, 1300, 1040, DIM), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 260, y: 1060, s: 0.45 }));
  return out;
}
function line(A, t) {
  const out = [...night(t, { moon: false }), ...glazing()], X = (v) => 300 + ((v - 109) / 2) * 1400;
  [["bf16", 0.5, 360], ["fp16", 0.0625, 520], ["fp32", 1 / 131072, 680]].forEach(([n, step, y]) => {
    out.push({ shape: rect(300, y, 1400, 2), fill: [0.6, 0.55, 0.45, 1] }, lab(A, n, 24, 220, y + 8, INK, "right"));
    if (step >= 0.01) for (let v = Math.ceil(109 / step) * step; v <= 111; v += step) out.push({ shape: rect(X(v) - 1, y - 18, 2, 38), fill: [...EMBER, 1] });
    else out.push({ shape: rect(300, y - 18, 1400, 38), fill: [...EMBER, 0.35] });
  });
  out.push({ shape: rect(X(110.0042) - 2, 300, 4, 420), fill: [0.7, 0.82, 0.95, 1] }, lab(A, "a value near 110", 22, X(110.0042) + 10, 300), lab(A, "illustration", 20, 1700, 1040, DIM), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 160, y: 1060, s: 0.4 }));
  return out;
}
export default {
  title: `Fused attention and precision proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = DIR === "A" ? wall(A, t) : DIR === "B" ? sweep(A, t) : DIR === "C" ? jugs(A, t) : line(A, t);
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, darkness(300, 900, 900, 0.25)], post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
