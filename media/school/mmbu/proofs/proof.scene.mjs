// Visual-direction proofs for lesson S20 (our MMBU Challenge entry). ?dir=A: the logbook, each run a
// ruled line with its bar drawn in pencil before the result is inked across it. ?dir=B: the same
// intervals as boats moored against a post at zero. ?dir=C: one set of replies scored against two
// answer keys, the tally flipping sign. ?dir=D: a run's timeline as a lamp's burn line, checkpoints as
// notches, the shutdown gap and the doubled trainer. Values are facts.json values; layout is a proof.
import { rect, circle, polyline, words, darkness } from "../../shared/lib.mjs";
import { host } from "../../embeddings/scene/segs.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { INK } from "../../nextword/scene/wheel.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const EMBER = [0.89, 0.58, 0.45], PAPER = [0.89, 0.84, 0.71], PENCIL = [0.42, 0.4, 0.36];
const lab = (A, s, size, x, y, fill = INK.ink, anchor = "left", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
const RUNS = (F) => [["FT4: the benchmark's own sources", F.ft4.H1, 0], ["FT5: a second pass", F.ft5.K1, 0], ["FT6: the labels' own words", F.ft6.M1, 0], ["FT7: N3, answers no worse", F.ft7.N3, -0.01], ["FT7: N4, the candidacy bar", F.ft7.N4, 0]];

function logbook(A, F, t) {
  const out = [{ shape: rect(470, 120, 1300, 820, 8), fill: [...PAPER, 1], screen: true }, { shape: rect(1118, 120, 4, 820), fill: [0.6, 0.55, 0.45, 0.7], screen: true }];
  const X = (v) => 1130 + (v + 0.03) / 0.09 * 600;
  out.push(lab(A, "the logbook: bar first, result after", 26, 520, 180, INK.ink));
  RUNS(F).forEach(([name, r, bar], i) => { const y = 280 + i * 125, ink = sm(1 + i * 0.6, 1.6 + i * 0.6, t), met = r.lo > bar;
    out.push({ shape: rect(500, y + 40, 1240, 2), fill: [0.6, 0.55, 0.45, 0.6], screen: true }, lab(A, name, 22, 520, y + 24, INK.ink));
    out.push({ shape: rect(X(bar) - 2, y - 26, 4, 64), fill: [...PENCIL, 1], screen: true });
    if (ink > 0) out.push({ shape: rect(X(r.lo), y + 4, (X(r.hi) - X(r.lo)) * ink, 8, 3), fill: met ? [0.16, 0.14, 0.12, 1] : [...EMBER, 1], screen: true },
      { shape: circle(X(r.mean), y + 8, 9, 16), fill: met ? [0.16, 0.14, 0.12, ink] : [...EMBER, ink], screen: true }, lab(A, `${r.mean > 0 ? "+" : ""}${r.mean.toFixed(3)} [${r.lo.toFixed(3)}, ${r.hi.toFixed(3)}]`, 18, 1140, y + 34 + 20, INK.ink, "left", ink)); });
  return out;
}
function moorings(A, F, t) {
  const out = [...night(t, { moon: false }), { shape: rect(0, 640, 1920, 440), fill: [0.05, 0.08, 0.12, 1] }];
  const X = (v) => 960 + v / 0.06 * 600;
  out.push({ shape: rect(X(0) - 8, 300, 16, 420), fill: [0.5, 0.42, 0.3, 1] }, lab(A, "zero", 20, X(0), 290, INK.night, "center"));
  RUNS(F).forEach(([name, r], i) => { const y = 380 + i * 60, met = r.lo > 0;
    out.push({ shape: polyline([X(r.lo), y, X(r.hi), y, X(r.hi) - 20, y + 30, X(r.lo) + 20, y + 30], true), fill: met ? [...PAPER, 0.9] : [...EMBER, 0.9] }, lab(A, name, 18, X(r.hi) + 30, y + 22, INK.night)); });
  return out;
}
function keys(A, F, t) {
  const out = [...night(t, { moon: false }), ...glazing()], V = F.vocab.ft7minusFt6, flip = sm(2, 3.5, t);
  const rows = ["X-ray", "Light Microscopy", "Ultrasound", "Human"], old = ["X-Ray Imaging", "light microscopy", "Ultrasound Imaging", "Tissue Section"];
  rows.forEach((r, i) => { const y = 260 + i * 110;
    out.push({ shape: rect(560, y, 420, 76, 6), fill: [...PAPER, 1] }, lab(A, `reply: ${r}`, 24, 590, y + 48));
    const key = flip < 0.5 ? old[i] : r;
    out.push({ shape: rect(1060, y, 440, 76, 6), fill: [0.16, 0.15, 0.17, 1] }, lab(A, `key: ${key}`, 24, 1090, y + 48, INK.night), lab(A, flip < 0.5 ? "x" : "ok", 30, 1560, y + 50, flip < 0.5 ? INK.ember : INK.night)); });
  const v = flip < 0.5 ? V.original : V.harmonised;
  out.push(lab(A, `FT7 minus FT6, held-out context: ${v.mean > 0 ? "+" : ""}${v.mean.toFixed(3)} [${v.lo.toFixed(3)}, ${v.hi.toFixed(3)}]`, 26, 560, 780, flip < 0.5 ? INK.ember : INK.night));
  return out;
}
function burn(A, F, t) {
  const out = [...night(t, { moon: false }), ...glazing()], S = F.records.survival, X = (s) => 520 + s / 1864 * 1300, u = sm(0.5, 4.5, t);
  out.push({ shape: rect(X(0), 520, (X(1864) - X(0)) * u, 10, 4), fill: [...PAPER, 1] });
  for (let s = 0; s <= 1864 * u; s += S.checkpointEvery) out.push({ shape: rect(X(s) - 1, 500, 2, 50), fill: [0.6, 0.55, 0.45, 1] });
  out.push({ shape: rect(X(S.saveStep) - 3, 440, 6, 160), fill: [...EMBER, 1] }, lab(A, `shutdown: step ${S.saveStep} saved in ${S.saveSeconds} s`, 22, X(S.saveStep) + 14, 450, INK.night));
  out.push({ shape: rect(X(300), 600, X(340) - X(300), 10, 4), fill: [...EMBER, 0.9] }, lab(A, `FT6: two trainers, ${S.dupSteps} steps lost (shown on this line for scale)`, 20, X(300), 650, INK.dim));
  out.push(lab(A, `a checkpoint every ${S.checkpointEvery} steps`, 22, 520, 420, INK.night));
  return out;
}
const scene = {
  title: "S20 proofs", duration: 6, fps: 30, design: [1920, 1080], chapters: [], params: [],
  async load(ctx) {
    const [sans, head, mono, facts] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/hanken-650.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    return { sans, head, mono, F: facts, rows: [] };
  },
  frame(t, ctx) {
    const A = ctx.assets, F = A.F;
    const items = DIR === "A" ? [...night(t, { moon: false }), ...glazing(), ...logbook(A, F, t)] : DIR === "B" ? moorings(A, F, t) : DIR === "C" ? keys(A, F, t) : burn(A, F, t);
    items.push(darkness(380, 700, 1900, 0.3), ...host(t, A), lab(A, "direction proof", 18, 1880, 1060, INK.dim, "right"));
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
  },
};
export default scene;
