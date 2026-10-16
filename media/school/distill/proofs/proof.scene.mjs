// Visual-direction proofs for lessons S17 (distillation) and S19 (LoRA), PROGRESS.md step 38.
// Shares come from the next-word lesson's facts (the model after "tallow found a"); the student's
// wheel and the matrix values in these proofs are illustrations, and say so on screen.
// ?dir=A: two brass wheels in the lamp room, the teacher's big and the student's small, with the
// hard label as a single lit slot between them; temperature softens the teacher's wheel.
// ?dir=B: a great ship and a rowing boat on the same route; the ship's wake fans into lanes, one
// per word, shaded by share. ?dir=C: the weight matrix as a hull of 32 x 32 planks; two thin
// strips (B and A) swing in and their product paints the change across every plank.
// ?dir=D: the lamp with a small glass filter clipped over it, the beam's colour shifting.
import { rect, circle, polyline, words, darkness, rad, lin } from "../../shared/lib.mjs";
import { night, glazing, lens, tallow } from "../../attention/scene/room.mjs";
import { wheel, pointer, INK } from "../../nextword/scene/wheel.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const soften = (s, T) => { const w = s.map((p) => p ** (1 / T)), z = w.reduce((a, b) => a + b, 0); return w.map((v) => v / z); };
function spread(F) {
  const top = F.torn.rows[1].model, rest = 1 - top.reduce((a, x) => a + x.p, 0), n = 46 - top.length;
  return { s: [...top.map((w) => w.p), ...new Array(n).fill(rest / n)], names: [...top.map((w) => w.word), ...new Array(n).fill("")] };
}
const note = (A, str) => ({ shape: words(str, A.mono, 24, 960, 1050, "center"), fill: INK.dim, screen: true });

function wheels(A, P, t) {
  const T = 1 + 3 * sm(2.5, 5, t), teach = soften(P.s, T), even = 1 / P.s.length;
  const stud = teach.map((p) => p * 0.8 + even * 0.2 * sm(1, 3, t) + p * 0.2 * (1 - sm(1, 3, t)));
  const hard = P.s.map((_, k) => (k === 0 ? 1 : 0));
  const out = [...wheel(A, teach, P.names, { turn: 0.3, at: { x: 560, y: 520, r: 300 }, pct: (k) => k < 3 }), ...pointer({ x: 560, y: 520, r: 300 })];
  out.push(...wheel(A, stud, P.names, { turn: 0.3, at: { x: 1480, y: 560, r: 190 }, size: 20, a: sm(0.5, 1.5, t) }));
  out.push(...wheel(A, hard, P.names, { turn: 0.3, at: { x: 1060, y: 230, r: 90 }, size: 18, hot: (k) => k === 0, a: sm(0.2, 1, t) }));
  out.push({ shape: words(`teacher, temperature ${T.toFixed(1)}`, A.mono, 28, 560, 900, "center"), fill: INK.night, screen: true },
    { shape: words("student", A.mono, 28, 1480, 820, "center"), fill: INK.night, screen: true },
    { shape: words("the hard label: one word", A.mono, 22, 1060, 360, "center"), fill: INK.ember, screen: true }, note(A, "proof: student wheel is an illustration"));
  return out;
}
function boats(A, P, t) {
  const out = [{ shape: rect(0, 560, 1920, 520), fill: lin(0, 560, 0, 1080, [0, [0.05, 0.07, 0.1, 1]], [1, [0.01, 0.015, 0.02, 1]]) }];
  let a0 = -0.5;
  const span = 1.0 * sm(0.3, 2, t), ox = 520, oy = 640;
  P.s.forEach((p, k) => {
    const da = p * span, a = a0 + da / 2, L = 1500;
    out.push({ shape: polyline([ox, oy, ox + Math.cos(a0) * L, oy + Math.sin(a0) * L * 0.35, ox + Math.cos(a0 + da) * L, oy + Math.sin(a0 + da) * L * 0.35], true),
      fill: k % 2 ? [0.85, 0.8, 0.65, 0.12 + p] : [0.75, 0.7, 0.55, 0.08 + p] });
    if (P.names[k]) out.push({ shape: words(P.names[k], A.sans, 24, ox + Math.cos(a) * 1150, oy + Math.sin(a) * 1150 * 0.35 + 8, "center"), fill: INK.night });
    a0 += da;
  });
  out.push({ shape: polyline([260, 600, 560, 600, 620, 560, 300, 560], true), fill: "#2a2018", stroke: "#0b0a0c", width: 4 },
    { shape: rect(380, 380, 16, 180), fill: "#2a2018" }, { shape: polyline([396, 390, 520, 540, 396, 540], true), fill: "#cdbb92" });
  const bx = 900 + 500 * sm(1, 5, t);
  out.push({ shape: polyline([bx - 60, 760, bx + 60, 760, bx + 80, 740, bx - 80, 740], true), fill: "#3a2c18", stroke: "#0b0a0c", width: 3 });
  out.push(note(A, "proof: the wake's lanes are the teacher's shares"));
  return out;
}
const val = (i, j) => Math.sin(i * 1.7 + j * 0.9) * Math.cos(i * 0.31 - j * 1.3);
function planks(A, t) {
  const out = [], x0 = 520, y0 = 150, c = 22, u = sm(2.5, 5.5, t), sweep = Math.floor(32 * u);
  const b = Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.5)), a = Array.from({ length: 32 }, (_, j) => Math.cos(j * 0.4));
  for (let i = 0; i < 32; i++) for (let j = 0; j < 32; j++) {
    const v = val(i, j) + (i < sweep ? 0.8 * b[i] * a[j] : 0), g = 0.45 + 0.35 * Math.tanh(v);
    out.push({ shape: rect(x0 + j * c, y0 + i * c, c - 2, c - 2, 2), fill: [g * 0.8, g * 0.62, g * 0.4, 1] });
  }
  const sb = sm(0.5, 1.5, t), sa = sm(1, 2, t);
  b.forEach((v, i) => out.push({ shape: rect(x0 - 80, y0 + i * c, c - 2, c - 2, 2), fill: v > 0 ? [0.89, 0.58, 0.45, sb * (0.3 + 0.7 * Math.abs(v))] : [0.35, 0.5, 0.75, sb * (0.3 + 0.7 * Math.abs(v))] }));
  a.forEach((v, j) => out.push({ shape: rect(x0 + j * c, y0 - 80, c - 2, c - 2, 2), fill: v > 0 ? [0.89, 0.58, 0.45, sa * (0.3 + 0.7 * Math.abs(v))] : [0.35, 0.5, 0.75, sa * (0.3 + 0.7 * Math.abs(v))] }));
  out.push({ shape: words("B", A.sans, 34, x0 - 70, y0 - 30, "center"), fill: INK.night, opacity: sb }, { shape: words("A", A.sans, 34, x0 + 32 * c + 30, y0 - 58), fill: INK.night, opacity: sa },
    { shape: words("32 x 32 = 1,024 numbers", A.mono, 28, 1300, 400), fill: INK.night, screen: true },
    { shape: words("rank 1: 32 + 32 = 64 numbers", A.mono, 28, 1300, 450), fill: INK.ember, screen: true, opacity: sa }, note(A, "proof: plank values are an illustration"));
  return out;
}
function filter(A, t) {
  const out = [...lens(t, { a: t * 0.6, lamp: 1, at: { x: 960, y: 520, r: 200 } })], u = sm(1, 3, t);
  out.push({ shape: rect(960 - 230 + 400 * (1 - u), 290, 140, 460, 10), fill: [0.4, 0.75, 0.6, 0.35], stroke: "#b8892e", width: 4 });
  out.push({ shape: polyline([1160, 420, 1900, 300, 1900, 740, 1160, 620], true), blend: "add", fill: lin(1160, 520, 1900, 520, [0, [0.4 + 0.6 * (1 - u), 0.85, 0.55 + 0.1 * u, 0.5]], [1, [1, 0.7, 0.4, 0]]) });
  out.push(note(A, "proof: the clip-on filter stands for the adapter"));
  return out;
}
export default {
  title: `Distillation and LoRA proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../../nextword/facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, F };
  },
  frame(t, ctx) {
    const A = ctx.assets, P = spread(A.F), items = DIR === "B" ? [...night(t)] : [...night(t), ...glazing()];
    items.push(...(DIR === "A" ? wheels(A, P, t) : DIR === "B" ? boats(A, P, t) : DIR === "C" ? planks(A, t) : filter(A, t)));
    items.push(darkness(300, 900, 900, 0.4), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: DIR === "C" ? 230 : 1780, y: 1060, s: 0.45 }));
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.2, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
