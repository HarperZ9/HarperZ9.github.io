// The lighthouse in cutaway (PROGRESS.md, step 28): the residual stream is a beam rising from the
// ground floor through two floors to the lamp. Its width at each landing is the stream's measured
// norm (facts.json stream.trained.steps, log scale); each floor has two rooms on its landing,
// attention then the MLP, which add light to the beam. Readouts sit on the landings' left.
import { rect, circle, polyline, words } from "../../shared/lib.mjs";

export const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", ink: "#1d1812", paper: "#e3d6b5", off: "#4a4238" };
// Landings, bottom to top: the embedding, after l0.attn, l0.mlp, l1.attn, l1.mlp.
export const YS = [960, 790, 620, 450, 280];
export const ROOMS = [["l0.attn", "attention"], ["l0.mlp", "MLP"], ["l1.attn", "attention"], ["l1.mlp", "MLP"]];
export const width = (n) => 10 + 26 * Math.log(1 + n);
const X = 960;

export function shell() {
  const out = [{ shape: polyline([720, 1060, 770, 150, 1150, 150, 1200, 1060], true), fill: [0.05, 0.05, 0.07, 1], stroke: "#2a2219", width: 6 }];
  for (const y of [705, 365]) out.push({ shape: rect(748, y, 424, 10), fill: "#3a2c18" });
  out.push({ shape: polyline([770, 150, 960, 70, 1150, 150], true), fill: "#2a2016", stroke: "#0b0a0c", width: 4 });
  return out;
}
// The beam from the ground to height u (0..4 landings climbed), widths from the norms.
export function beam(norms, u, { a = 1, cut = -1 } = {}) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const v = Math.max(0, Math.min(1, u - i));
    if (v <= 0) break;
    const y0 = YS[i], y1 = YS[i] + (YS[i + 1] - YS[i]) * v, w0 = width(norms[i]), w1 = width(norms[i] + (norms[i + 1] - norms[i]) * v), dead = cut >= 0 && i >= cut;
    out.push({ shape: polyline([X - w0 / 2, y0, X - w1 / 2, y1, X + w1 / 2, y1, X + w0 / 2, y0], true), blend: "add", fill: dead ? [0.5, 0.35, 0.3, 0.35 * a] : [1, 0.78, 0.45, 0.55 * a] });
  }
  return out;
}
// A room on its landing: box, name, and the feed into the beam. state: "on", "off", "lit".
export function room(A, i, { a = 1, state = "on", heads = null, label = null } = {}) {
  const y = (YS[i] + YS[i + 1]) / 2, off = state === "off", lit = state === "lit";
  const out = [{ shape: rect(1240, y - 42, 280, 84, 8), fill: off ? [0.2, 0.18, 0.16, a] : lit ? [0.89, 0.58, 0.45, a] : [0.89, 0.84, 0.71, a], stroke: "#2a2219", width: 2 },
    { shape: words(label || ROOMS[i][1], A.sans, 30, 1380, y + 10, "center"), fill: off ? INK.dim : INK.ink, opacity: a },
    { shape: polyline([1240, y, X + 30, y]), fill: null, stroke: off ? [0.4, 0.35, 0.3, 0.5 * a] : [1, 0.8, 0.5, 0.9 * a], width: 4, dash: off ? [8, 8] : undefined }];
  if (heads) heads.forEach((h, k) => out.push({ shape: rect(1540 + k * 96, y - 30, 84, 60, 6), fill: h ? [0.89, 0.84, 0.71, a] : [0.2, 0.18, 0.16, a], stroke: "#2a2219", width: 2 },
    { shape: words(`head ${k + 1}`, A.sans, 20, 1582 + k * 96, y + 7, "center"), fill: h ? INK.ink : INK.dim, opacity: a }));
  return out;
}
// The layer-norm tap: a small lens beside the beam where a room takes its rescaled copy.
export const tap = (i, a = 1) => { const y = (YS[i] + YS[i + 1]) / 2; return [{ shape: circle(X + 70, y, 16, 24), fill: [0.55, 0.7, 0.85, 0.85 * a], stroke: "#0b0a0c", width: 2 }]; };
// A readout on landing i (left of the tower).
export const readout = (A, i, s, a = 1, fill = INK.night) => ({ shape: words(s, A.mono, 26, 885, YS[i] + 8, "right"), fill, opacity: a, screen: true });
