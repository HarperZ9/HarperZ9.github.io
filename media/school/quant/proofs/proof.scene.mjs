// Visual-direction proofs for lessons S18 (quantisation) and K22 (matmul tiling), PROGRESS.md step
// 59. Every number here is an illustration and says so.
// ?dir=A: Rerun's palette: one picture of planks painted with 256 tones, then 16, then 4, with the
// histogram of values and the levels as ticks. ?dir=B: the hull of planks with the error of each
// plank after 4-bit rounding drawn as ember and slate. ?dir=C: the cannery: a crew carries a tray of
// cans to its bench and reuses it, against walking to the warehouse for every can. ?dir=D: the three
// tables A, B and C as grids, one tile of each lit, the tile walking along A's row and B's column.
import { rect, circle, polyline, words, darkness, GUIDES } from "../../shared/lib.mjs";
import { night, glazing, tallow } from "../../attention/scene/room.mjs";
import { grid, tone } from "../../lora/scene/planks.mjs";
import { floor, shelf, CREW, trip } from "../../threads/scene/cannery.mjs";
import { pylon } from "../../vectors/scene/chart.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const INK = "#ece5d6", DIM = "#958e80";
const lab = (A, s, size, x, y, fill = INK, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const W = (() => { const r = lcg(3); return Array.from({ length: 24 }, () => Array.from({ length: 48 }, () => { const u = r() + r() + r() - 1.5; return u * (r() < 0.02 ? 4 : 1); })); })();
const q = (v, levels, s) => Math.max(-1, Math.min(1, Math.round((v / s) * (levels / 2)) / (levels / 2))) * s;

function palette(A, t) {
  const out = [...night(t, { moon: false }), ...glazing()], s = 1.6, lv = t < 2 ? 256 : t < 4 ? 16 : 4;
  out.push(...grid(W.map((r) => r.map((v) => q(v, lv, s))), { at: { x: 560, y: 160 }, cell: 22, scale: s }), lab(A, `${lv} levels`, 30, 560, 740));
  const h = new Array(40).fill(0); W.flat().forEach((v) => { h[Math.max(0, Math.min(39, Math.floor(((v + 2) / 4) * 40)))] += 1; });
  h.forEach((c, i) => out.push({ shape: rect(560 + i * 26, 940 - c * 2.2, 22, c * 2.2), fill: [0.9, 0.86, 0.75, 1], screen: true }));
  for (let k = 0; k <= lv && lv <= 16; k++) out.push({ shape: rect(560 + ((((k / lv) * 2 - 1) * s + 2) / 4) * 1040, 760, 2, 190), fill: [0.89, 0.58, 0.45, 1], screen: true });
  out.push(lab(A, "illustration", 20, 1700, 1040, DIM), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 260, y: 1060, s: 0.45 }));
  return out;
}
function errors(A, t) {
  const out = [...night(t, { moon: false }), ...glazing()], s = 1.6;
  out.push(...grid(W.map((r) => r.map((v) => v - q(v, 16, s))), { at: { x: 560, y: 220 }, cell: 22, scale: 0.12 }), lab(A, "each plank's rounding error at 4 bits", 26, 560, 190), lab(A, "illustration", 20, 1700, 1040, DIM));
  out.push(...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 260, y: 1060, s: 0.45 }));
  return out;
}
function trays(A, t) {
  const out = [...floor(), ...shelf(A, 32, { hot: (i) => i < 8 })], u = sm(1, 3, t);
  out.push({ shape: rect(700, 600, 360, 140, 8), fill: [0.35, 0.28, 0.2, 1], stroke: "#0b0a0c", width: 3 }, lab(A, "the bench: shared memory", 20, 700, 590, DIM));
  for (let k = 0; k < 8; k++) out.push({ shape: rect(170 + k * 36 + (720 - 170) * u, 140 + (620 - 140) * u, 30, 50, 3), fill: [0.89, 0.58, 0.45, 1] });
  for (let w = 0; w < 16; w++) { const x = 720 + (w % 8) * 44, y = 800 + Math.floor(w / 8) * 50; out.push({ shape: circle(x, y, 13, 16), fill: [...CREW[0], 1], stroke: "#0b0a0c", width: 2 }); if (u > 0.9) out.push(trip(x, y - 14, 735 + (w % 8) * 36, 670, CREW[0], 0.6)); }
  out.push(lab(A, "one trip for the tray, many uses at the bench", 26, 300, 1000), lab(A, "illustration", 20, 1700, 1040, DIM), ...pylon(t, 1780, 1010, 0.4));
  return out;
}
function tiles(A, t) {
  const out = [{ shape: rect(0, 0, 1920, 1080), fill: [0.012, 0.011, 0.014, 1] }], n = 8, c = 40, k = Math.floor(sm(0.5, 5, t) * n * 0.999 / 2) * 2;
  const M = (x0, y0, hot, name) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push({ shape: rect(x0 + j * c, y0 + i * c, c - 3, c - 3, 3), fill: hot(i, j) ? [0.89, 0.58, 0.45, 1] : [0.3, 0.27, 0.24, 1] }); out.push(lab(A, name, 26, x0, y0 - 16)); };
  M(200, 300, (i, j) => i < 2 && j >= k && j < k + 2, "A"); M(700, 300, (i, j) => j < 2 && i >= k && i < k + 2, "B"); M(1200, 300, (i, j) => i < 2 && j < 2, "C");
  out.push(lab(A, "one tile of C: walk a tile along A's row and down B's column", 24, 200, 740), lab(A, "illustration", 20, 1700, 1040, DIM), ...pylon(t, 1780, 1010, 0.4));
  return out;
}
export default {
  title: `Quantisation and tiling proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = DIR === "A" ? palette(A, t) : DIR === "B" ? errors(A, t) : DIR === "C" ? trays(A, t) : tiles(A, t);
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, darkness(300, 900, 900, 0.25)], post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
