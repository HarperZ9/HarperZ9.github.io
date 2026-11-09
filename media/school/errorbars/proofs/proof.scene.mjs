// Visual-direction proofs for lessons E23 (error bars) and E24 (when the check can be fooled),
// PROGRESS.md step 46. Rerun under the prism at the tide line. Every number here is an
// illustration and says so on screen; the films use facts.json.
// ?dir=A: one score's beam enters the prism and leaves as a band; each bootstrap resample is a ray
// that lands as a tick on a ruler; the band is the interval. ?dir=B: a bean machine: resampled
// means fall as beads into columns, brackets at the middle 95 percent. ?dir=C: pretty shells pass
// a checker's gate that looks only at shine; Rerun taps each and some crumble. ?dir=D: a tide
// chart with the checker's reward rising and true correctness falling.
import { rect, circle, polyline, words, darkness, pose, GUIDES, SPECTRUM } from "../../shared/lib.mjs";
import { night } from "../../attention/scene/room.mjs";
import { prism } from "../../attention/scene/data.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const INK = "#ece5d6", DIM = "#958e80", EMBER = [0.89, 0.58, 0.45];
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const MEANS = (() => { const r = lcg(7); return Array.from({ length: 400 }, () => 0.72 + 0.03 * gauss(r)); })();
const lab = (A, s, size, x, y, fill = INK, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
const shore = () => [{ shape: rect(0, 820, 1920, 260), fill: [0.16, 0.13, 0.1, 1] }, { shape: rect(0, 810, 1920, 14), fill: [0.5, 0.55, 0.6, 0.25] }];
const rerun = (t, x, y, s = 0.45, extra = {}) => pose(GUIDES.rerun.parts({ stalk: 1.2, look: [-6, -4], flare: 0.9, ...extra }), { x, y, s });

function band(A, t) {
  const px = 620, py = 520, out = [...prism(px, py, 1, 1.6)], X = (v) => 1000 + ((v - 0.62) / 0.2) * 800, n = Math.floor(sm(1, 5, t) * MEANS.length);
  out.push({ shape: polyline([120, py, px - 60, py]), fill: null, stroke: [1, 0.95, 0.85, 0.9], width: 6 }, lab(A, "one score: 0.72", 26, 140, py - 24));
  for (let i = 0; i < n; i++) { const v = MEANS[i], c = SPECTRUM[Math.min(5, Math.floor(((v - 0.66) / 0.12) * 6))] || SPECTRUM[0];
    out.push({ shape: polyline([px + 70, py + 10, X(v), 760]), fill: null, stroke: [...c, 0.05], width: 1.5, blend: "add" }, { shape: rect(X(v) - 1, 760, 2, 24), fill: [...c, 0.5] }); }
  const s = [...MEANS].sort((a, b) => a - b), lo = s[10], hi = s[389];
  out.push({ shape: rect(1000, 800, 800, 2), fill: [0.8, 0.75, 0.65, 0.6] }, { shape: rect(X(lo), 790, X(hi) - X(lo), 6), fill: [...EMBER, sm(5, 5.5, t)] }, lab(A, `95% of resamples: ${lo.toFixed(2)} to ${hi.toFixed(2)}`, 26, X(lo), 860, INK, "left", sm(5, 5.5, t)));
  return out;
}
function beans(A, t) {
  const out = [], n = Math.floor(sm(0.5, 5, t) * MEANS.length), cols = new Map(), X = (v) => 400 + ((v - 0.62) / 0.2) * 1200, w = 1200 / 40;
  for (let i = 0; i < n; i++) { const k = Math.round((X(MEANS[i]) - 400) / w), h = cols.get(k) || 0; cols.set(k, h + 1); out.push({ shape: circle(400 + k * w, 780 - h * 11, 5, 10), fill: [0.9, 0.86, 0.75, 1] }); }
  const s = [...MEANS].sort((a, b) => a - b), lo = s[10], hi = s[389], a = sm(5, 5.5, t);
  out.push({ shape: rect(X(lo), 300, 3, 490), fill: [...EMBER, a] }, { shape: rect(X(hi), 300, 3, 490), fill: [...EMBER, a] }, lab(A, `middle 95%: ${lo.toFixed(2)} to ${hi.toFixed(2)}`, 26, X(lo) + 10, 290, INK, "left", a));
  for (let k = 0; k < 6; k++) out.push({ shape: circle(260 + (k % 3) * 40, 200 + Math.floor(k / 3) * 40 + 10 * Math.sin(t * 3 + k), 16, 16), fill: [0.85, 0.75, 0.6, 1], stroke: "#2a2219", width: 2 });
  out.push(lab(A, "rows drawn again, with replacement", 22, 200, 160, DIM));
  return out;
}
function shells(A, t) {
  const out = [{ shape: rect(860, 380, 30, 420), fill: [0.45, 0.4, 0.35, 1] }, lab(A, "the checker: is it shiny?", 24, 760, 360, INK)], tap = sm(3, 5.5, t);
  for (let i = 0; i < 10; i++) { const x = 300 + i * 150 + 200 * sm(0.5, 3, t), weak = i % 3 !== 0, crumble = weak && x > 1100 ? tap : 0;
    out.push({ shape: circle(x, 760 + 30 * crumble, 34 * (1 - 0.4 * crumble), 24), fill: [0.95, 0.85, 0.65, 1 - 0.7 * crumble], stroke: "#2a2219", width: 2 }); }
  out.push(lab(A, "checker: 10 of 10 pass", 26, 300, 900, INK), lab(A, "tapped: 4 of 10 hold", 26, 1200, 900, EMBER, "left", tap), lab(A, "illustration", 20, 960, 1040, DIM, "center"));
  return out;
}
function chart(A, t) {
  const out = [{ shape: rect(360, 140, 1300, 700, 8), fill: [0.9, 0.85, 0.72, 1], stroke: "#3a2c1c", width: 4 }], X = (s) => 440 + s * 1150, n = Math.floor(sm(0.5, 5, t) * 60);
  const rew = Array.from({ length: n }, (_, i) => [X(i / 59), 760 - 560 * (1 - Math.exp(-i / 15))]), cor = Array.from({ length: n }, (_, i) => [X(i / 59), 760 - 560 * (0.6 * Math.exp(-i / 25) + 0.1)]);
  if (n > 1) out.push({ shape: polyline(rew.flat()), fill: null, stroke: "#1d1812", width: 5 }, { shape: polyline(cor.flat()), fill: null, stroke: [0.65, 0.27, 0.16, 1], width: 5 });
  out.push(lab(A, "reward the checker pays", 24, 1260, 230, "#1d1812"), lab(A, "answers that are right", 24, 1260, 700, [0.65, 0.27, 0.16]), lab(A, "illustration", 20, 960, 1040, DIM, "center"));
  return out;
}
export default {
  title: `Error bars and gaming proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = [...night(t), ...shore()];
    items.push(...(DIR === "A" ? band(A, t) : DIR === "B" ? beans(A, t) : DIR === "C" ? shells(A, t) : chart(A, t)));
    items.push(darkness(300, 900, 900, 0.35), ...rerun(t, 200, 980), lab(A, DIR < "C" ? "illustration: 400 resampled means" : "", 20, 960, 1040, DIM, "center"));
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.25, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
