// Visual-direction proofs for lessons L11 and L12 (PROGRESS.md). ?dir=A: the lighthouse in cutaway,
// the residual stream a beam rising through two floors, each room adding light (beam width by the
// stream's measured norm, log scale), the readout loss on each landing. ?dir=B: the same stream as a
// horizontal channel through four stations on Pylon's printed chart. ?dir=C: L12's loop as a track
// round the dock with four stations and the held-out curve on the tally board. ?dir=D: L12 as a dial
// on Pylon's desk, the hand sweeping laps, the curve drawn as it turns.
import { rect, circle, polyline, words, darkness, rad, lin } from "../../shared/lib.mjs";
import { night, glazing, tallow } from "../../attention/scene/room.mjs";
import { desk, pylon, K } from "../../vectors/scene/chart.mjs";
import { GUIDES } from "../../shared/lib.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const INK = "#ece5d6";
const W = (n) => 10 + 26 * Math.log(1 + n);
function tower(A, B, t) {
  const S = B.stream.trained.steps, L = B.lens.trained, out = [], x = 960, ys = [980, 800, 600, 420, 220], up = sm(0.3, 4.5, t) * 4;
  out.push({ shape: polyline([700, 1060, 760, 120, 1160, 120, 1220, 1060], true), fill: [0.06, 0.06, 0.08, 1], stroke: "#2a2219", width: 6 });
  for (const y of [700, 330]) out.push({ shape: rect(740, y, 440, 10), fill: "#3a2c18" });
  ["attention", "MLP", "attention", "MLP"].forEach((r, i) => { const y = (ys[i] + ys[i + 1]) / 2, a = sm(i, i + 0.6, up);
    out.push({ shape: rect(1230, y - 40, 260, 80, 8), fill: [0.89, 0.84, 0.71, a], stroke: "#2a2219", width: 2 }, { shape: words(r, A.sans, 30, 1360, y + 10, "center"), fill: "#1d1812", opacity: a },
      { shape: polyline([1230, y, 960 + W(S[i + 1].norm) / 2, y]), fill: null, stroke: [1, 0.8, 0.5, a], width: 4 }); });
  for (let i = 0; i < 4; i++) { const u = Math.max(0, Math.min(1, up - i)); if (u <= 0) break;
    const y0 = ys[i], y1 = ys[i] + (ys[i + 1] - ys[i]) * u, w0 = W(S[i].norm), w1 = W(S[i].norm + (S[i + 1].norm - S[i].norm) * u);
    out.push({ shape: polyline([x - w0 / 2, y0, x - w1 / 2, y1, x + w1 / 2, y1, x + w0 / 2, y0], true), blend: "add", fill: [1, 0.78, 0.45, 0.55] }); }
  L.forEach((l, i) => { if (up >= i) out.push({ shape: words(`loss ${l.loss.toFixed(2)}`, A.mono, 26, 680, ys[i] + 8, "right"), fill: INK }); });
  return out;
}
function channel(A, B, t) {
  const S = B.stream.trained.steps, L = B.lens.trained, out = [...desk(t), { shape: rect(150, 200, 1620, 700, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 }], xs = [250, 600, 950, 1300, 1650], go = sm(0.3, 4.5, t) * 4;
  ["attention", "MLP", "attention", "MLP"].forEach((r, i) => out.push({ shape: rect((xs[i] + xs[i + 1]) / 2 - 90, 280, 180, 70, 6), fill: K.paper2, stroke: K.ink, width: 2 }, { shape: words(r, A.sans, 28, (xs[i] + xs[i + 1]) / 2, 325, "center"), fill: K.ink }));
  for (let i = 0; i < 4; i++) { const u = Math.max(0, Math.min(1, go - i)); if (u <= 0) break; const x1 = xs[i] + (xs[i + 1] - xs[i]) * u, h0 = W(S[i].norm), h1 = W(S[i].norm + (S[i + 1].norm - S[i].norm) * u);
    out.push({ shape: polyline([xs[i], 560 - h0 / 2, x1, 560 - h1 / 2, x1, 560 + h1 / 2, xs[i], 560 + h0 / 2], true), fill: [0.62, 0.36, 0.28, 0.8] }); }
  L.forEach((l, i) => { if (go >= i) out.push({ shape: words(`loss ${l.loss.toFixed(2)}`, A.mono, 26, xs[i], 800, "center"), fill: K.ink }); });
  out.push(...pylon(t, 1780, 1040, 0.45));
  return out;
}
function track(A, T, t) {
  const out = [...desk(t)], cx = 760, cy = 560, R = 300, a = t * 1.4, P = T.reproduce.curve, k = Math.min(P.length - 1, Math.floor(sm(0.3, 5.5, t) * (P.length - 1)));
  out.push({ shape: circle(cx, cy, R, 96), fill: null, stroke: "#3a2c1c", width: 18 }, { shape: circle(cx, cy, R, 96), fill: null, stroke: K.paper2, width: 8 });
  ["batch", "forward", "backward", "step"].forEach((s, i) => { const b = (i / 4) * Math.PI * 2 - Math.PI / 2; out.push({ shape: rect(cx + Math.cos(b) * R - 80, cy + Math.sin(b) * R - 32, 160, 64, 6), fill: K.paper, stroke: K.ink, width: 2 }, { shape: words(s, A.sans, 28, cx + Math.cos(b) * R, cy + Math.sin(b) * R + 10, "center"), fill: K.ink }); });
  out.push({ shape: circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 22, 24), fill: "#b8492e", stroke: K.ink, width: 3 });
  out.push({ shape: rect(1200, 240, 600, 420, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 }, { shape: polyline(P.slice(0, k + 1).flatMap((p) => [1230 + (p.step / 2000) * 540, 630 - (p.heldOut / 4) * 360])), fill: null, stroke: "#b8492e", width: 4 },
    { shape: words(`lap ${P[k].step}: held-out ${P[k].heldOut.toFixed(2)}`, A.mono, 26, 1230, 290), fill: K.ink });
  out.push(...pylon(t, 1780, 1040, 0.45));
  return out;
}
function dial(A, T, t) {
  const out = [...desk(t), { shape: rect(330, 110, 1260, 880, 6), fill: K.paper, stroke: "#3a2c1c", width: 4 }], P = T.reproduce.curve, k = Math.min(P.length - 1, Math.floor(sm(0.3, 5.5, t) * (P.length - 1))), cx = 640, cy = 520, R = 220, b = (P[k].step / 2000) * Math.PI * 2 - Math.PI / 2;
  out.push({ shape: circle(cx, cy, R, 96), fill: K.paper2, stroke: K.ink, width: 4 }, { shape: polyline([cx, cy, cx + Math.cos(b) * R, cy + Math.sin(b) * R]), fill: null, stroke: "#b8492e", width: 6 });
  out.push({ shape: polyline(P.slice(0, k + 1).flatMap((p) => [950 + (p.step / 2000) * 560, 860 - (p.heldOut / 4) * 600])), fill: null, stroke: "#b8492e", width: 4 }, { shape: words(`lap ${P[k].step}`, A.mono, 34, cx, cy + R + 60, "center"), fill: K.ink });
  out.push(...pylon(t, 1780, 1040, 0.45));
  return out;
}
export default {
  title: `Block and loop proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono, B, T] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json"), ctx.json("../facts.json"), ctx.json("../../trainloop/facts.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono, B, T };
  },
  frame(t, ctx) {
    const A = ctx.assets, dark = DIR === "A", items = dark ? [...night(t), ...glazing()] : [];
    if (DIR === "A") items.push(...tower(A, A.B, t), darkness(500, 800, 1700, 0.4), ...tallow({ armR: 60, elbR: 40, prop: null, lid: 0.45, look: [6, -2], flame: 1 }, { x: 380, y: 1060, s: 0.5 }));
    else if (DIR === "B") items.push(...channel(A, A.B, t));
    else if (DIR === "C") items.push(...track(A, A.T, t));
    else items.push(...dial(A, A.T, t));
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items, post: { bloom: 0.2, threshold: 1, vignette: 0.3, grain: 0.04, passes: dark ? [{ pass: "film", preset: "500t-print", ev: 1.6 }] : [] } };
  },
};
