// Visual-direction proofs for lessons K21 (threads, workgroups, memory) and L16 (evaluating a
// language model), PROGRESS.md step 53. Every number here is an illustration and says so.
// ?dir=A: the cannery floor from above: 64 workers in crews of 16, a warehouse shelf of cans; a
// crew's trip carries a run of neighbouring cans (one transaction) or scattered ones (many).
// ?dir=B: data art: one line per thread from its id to the address it reads, contiguous then strided.
// ?dir=C: three instruments at the prism (a loss scale, an exact-match tally, a judge's stamp).
// ?dir=D: one model enters the prism and leaves as three score bands that disagree.
import { rect, circle, polyline, words, darkness, pose, GUIDES, SPECTRUM } from "../../shared/lib.mjs";
import { night } from "../../attention/scene/room.mjs";
import { beach, thePrism, PRISM } from "../../errorbars/scene/tide.mjs";
import { pylon } from "../../vectors/scene/chart.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const INK = "#ece5d6", DIM = "#958e80", EMBER = [0.89, 0.58, 0.45];
const CREW = [[0.89, 0.58, 0.45], [0.55, 0.7, 0.85], [0.75, 0.85, 0.6], [0.85, 0.75, 0.55]];
const lab = (A, s, size, x, y, fill = INK, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
const floor = () => [{ shape: rect(0, 0, 1920, 1080), fill: [0.1, 0.09, 0.08, 1] }, ...Array.from({ length: 24 }, (_, i) => ({ shape: rect(i * 80, 0, 2, 1080), fill: [0.2, 0.18, 0.16, 1] }))];

function cannery(A, t) {
  const out = [...floor(), { shape: rect(160, 120, 1600, 90, 6), fill: [0.3, 0.25, 0.2, 1], stroke: "#0b0a0c", width: 3 }, lab(A, "the warehouse: global memory", 22, 170, 110)];
  for (let k = 0; k < 64; k++) out.push({ shape: rect(180 + k * 24.5, 140, 20, 50, 3), fill: [0.85, 0.8, 0.7, 1] });
  const strided = t > 3, u = sm(0.5, 2.5, t) - (strided ? sm(3, 3.5, t) : 0) + (strided ? sm(3.5, 5.5, t) : 0);
  for (let w = 0; w < 64; w++) {
    const c = Math.floor(w / 16), x0 = 300 + (w % 16) * 60 + c * 20, y0 = 520 + c * 110, src = strided ? (w * 7) % 64 : w, tx = 190 + src * 24.5, ty = 200;
    const x = x0 + (tx - x0) * u * 0.0 + 0, y = y0;
    out.push({ shape: circle(x0, y, 14, 16), fill: [...CREW[c], 1], stroke: "#0b0a0c", width: 2 });
    if (w < 16) out.push({ shape: polyline([x0, y - 14, tx, ty]), fill: null, stroke: [...CREW[c], 0.6 * u], width: 2 });
  }
  out.push(lab(A, strided ? "scattered cans: one crew needs many trips" : "neighbouring cans: one crew, one trip", 26, 300, 1000, INK), lab(A, "illustration", 20, 1700, 1040, DIM));
  return out;
}
function art(A, t) {
  const out = [{ shape: rect(0, 0, 1920, 1080), fill: [0.012, 0.011, 0.014, 1] }], strided = t > 3, u = sm(0.3, 2.5, t);
  for (let k = 0; k < 256; k++) { const src = strided ? (k * 33) % 256 : k, c = SPECTRUM[Math.floor(k / 32) % 6];
    out.push({ shape: polyline([160 + k * 6.25, 860, 160 + (160 + src * 6.25 - 160) * u + 0, 200]), fill: null, stroke: [...c, 0.35], width: 1.2, blend: "add" }); }
  out.push(lab(A, "threads", 22, 160, 900, DIM), lab(A, "addresses", 22, 160, 180, DIM), lab(A, "illustration", 20, 1700, 1040, DIM));
  return out;
}
function instruments(A, t) {
  const out = [...beach(t), ...thePrism(0.6)], a = sm(0.5, 2, t);
  out.push({ shape: rect(900, 220, 240, 300, 8), fill: [0.9, 0.86, 0.75, a] }, lab(A, "loss", 24, 1020, 260, "#1d1812", "center", a), lab(A, "0.67", 48, 1020, 400, "#1d1812", "center", a));
  out.push({ shape: rect(1200, 220, 240, 300, 8), fill: [0.9, 0.86, 0.75, a] }, lab(A, "exact match", 24, 1320, 260, "#1d1812", "center", a), lab(A, "97 / 100", 40, 1320, 400, "#1d1812", "center", a));
  out.push({ shape: circle(1640, 370, 130, 40), fill: [0.65, 0.27, 0.16, a] }, lab(A, "judge", 28, 1640, 360, INK, "center", a), lab(A, "8 / 10", 32, 1640, 410, INK, "center", a));
  out.push(lab(A, "illustration", 20, 1700, 1040, DIM));
  return out;
}
function bands(A, t) {
  const out = [...beach(t), ...thePrism(1)], u = sm(0.5, 3, t);
  out.push({ shape: polyline([120, PRISM.y, PRISM.x - 60, PRISM.y]), fill: null, stroke: [1, 0.95, 0.85, 0.9], width: 6 }, lab(A, "one model", 26, 130, PRISM.y - 30));
  [["loss", 0.62, 0], ["exact match", 0.85, 2], ["judge", 0.45, 4]].forEach(([n, v, k], i) => { const y = 300 + i * 200, c = SPECTRUM[k];
    out.push({ shape: polyline([PRISM.x + 70, PRISM.y + 10, 1000, y]), fill: null, stroke: [...c, 0.6 * u], width: 4, blend: "add" }, { shape: rect(1000, y - 16, 700 * v * u, 32, 4), fill: [0.9, 0.86, 0.75, u] }, lab(A, n, 24, 1000, y - 30, INK, "left", u)); });
  out.push(lab(A, "illustration: three scores, three stories", 20, 1300, 1040, DIM));
  return out;
}
export default {
  title: `Threads and evaluation proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = DIR === "A" ? cannery(A, t) : DIR === "B" ? art(A, t) : DIR === "C" ? instruments(A, t) : bands(A, t);
    if (DIR < "C") items.push(...pylon(t, 1780, 1010, 0.4));
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, darkness(300, 900, 900, 0.25)], post: { bloom: 0.2, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
