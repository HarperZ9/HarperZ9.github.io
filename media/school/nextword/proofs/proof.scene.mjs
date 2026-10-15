// Visual-direction proofs for lessons L9 and L15: one beat, the model's next-word spread after
// "tallow found a" (facts.json torn.rows.1: the eight likeliest words; the other 38 share the rest
// evenly in this proof only), then the real word arriving. ?dir=A: a rail of 46 lamps in the
// gallery, brightness by share; ?dir=B: the lighthouse beam split into 46 rays over the sea, width
// by share; ?dir=C: a brass wheel with one slot per word, slot angle by share.
import { rect, circle, polyline, words, darkness, glow, rad, lin } from "../../shared/lib.mjs";
import { night, glazing, lens, tallow, LENS } from "../../attention/scene/room.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const INK = "#ece5d6", DIM = "#958e80", EMBER = [0.89, 0.58, 0.45];
function spread(F) {
  const top = F.torn.rows[1].model, rest = 1 - top.reduce((a, x) => a + x.p, 0), n = 46 - top.length;
  return [...top, ...Array.from({ length: n }, (_, i) => ({ word: "", p: rest / n, i }))];
}
function rail(A, P, t, hit) {
  const out = [], x0 = 120, step = 1680 / 45;
  P.forEach((w, k) => {
    const x = x0 + k * step, y = 420, b = Math.sqrt(w.p / P[0].p) * sm(0.3 + k * 0.01, 1.5 + k * 0.01, t);
    out.push({ shape: rect(x - 1, 120, 2, y - 140), fill: [0.3, 0.27, 0.24, 1] }, { shape: circle(x, y, 12, 16), fill: "#2a2016", stroke: "#0b0a0c", width: 2 });
    if (b > 0.01) out.push({ shape: circle(x, y, 18 + 90 * b, 48), blend: "add", fill: rad(x, y, 18 + 90 * b, [0, [1, 0.85, 0.55, 0.95 * b]], [1, [1, 0.6, 0.3, 0]]) });
    if (w.word) out.push({ shape: words(w.word, A.sans, 22, x, y + 70, "center"), fill: k === hit ? "#e29472" : INK });
  });
  return out;
}
function rays(A, P, t, hit) {
  const out = [], ox = 300, oy = 560;
  let a0 = -0.95;
  const span = 1.9 * sm(0.3, 1.6, t);
  P.forEach((w, k) => {
    const da = w.p * span, a = a0 + da / 2, L = 1500;
    out.push({ shape: polyline([ox, oy, ox + Math.cos(a0) * L, oy + Math.sin(a0) * L, ox + Math.cos(a0 + da) * L, oy + Math.sin(a0 + da) * L], true), blend: "add",
      fill: lin(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L, [0, [1, 0.85, 0.55, 0.5]], [1, [1, 0.65, 0.3, 0.04]]) });
    if (w.word) out.push({ shape: words(w.word, A.sans, 26, ox + Math.cos(a) * 1050, oy + Math.sin(a) * 1050 + 8, "center"), fill: k === hit ? "#e29472" : INK });
    a0 += da;
  });
  return out;
}
function wheel(A, P, t, hit) {
  const out = [], cx = 1100, cy = 560, R = 400, turn = t * 0.6;
  out.push({ shape: circle(cx, cy, R + 24, 128), fill: "#3a2c18", stroke: "#0b0a0c", width: 6 });
  let a0 = turn;
  P.forEach((w, k) => {
    const da = w.p * Math.PI * 2, pts = [cx, cy];
    for (let s = 0; s <= 12; s++) { const a = a0 + (da * s) / 12; pts.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
    out.push({ shape: polyline(pts, true), fill: k % 2 ? "#cdbb92" : "#e3d6b5", stroke: "#2a2219", width: 1.5 });
    if (k === hit) out.push({ shape: polyline(pts, true), fill: [...EMBER, 0.55] });
    if (w.word) { const a = a0 + da / 2; out.push({ shape: words(w.word, A.sans, 24, cx + Math.cos(a) * R * 0.68, cy + Math.sin(a) * R * 0.68 + 8, "center"), fill: "#1d1812" }); }
    a0 += da;
  });
  out.push({ shape: polyline([cx + R + 40, cy, cx + R - 20, cy - 18, cx + R - 20, cy + 18], true), fill: "#b8892e", stroke: "#0b0a0c", width: 3 });
  return out;
}
export default {
  title: `Next-word proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, F] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, F };
  },
  frame(t, ctx) {
    const A = ctx.assets, P = spread(A.F), hit = t > 3.5 ? 1 : -1, items = [...night(t), ...glazing()];
    items.push(...(DIR === "A" ? rail(A, P, t, hit) : DIR === "B" ? rays(A, P, t, hit) : wheel(A, P, t, hit)));
    if (DIR === "B") items.push(...lens(t, { a: t * 0.6, lamp: 1, at: { x: 300, y: 560, r: 120 } }));
    items.push(darkness(300, 900, 900, 0.4), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: DIR === "B" ? 1760 : 260, y: 1060, s: 0.5 }));
    items.push({ shape: words("tallow found a ...", A.mono, 34, 960, 80, "center"), fill: INK, screen: true });
    if (hit >= 0) items.push({ shape: words(`it was ${P[hit].word}: share ${Math.round(P[hit].p * 100)}%, surprise ${(-Math.log(P[hit].p)).toFixed(2)}`, A.mono, 30, 960, 1030, "center"), fill: "#e29472", screen: true });
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.25, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
