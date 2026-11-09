// The scaling film's segments (lesson L14), in Tallow's lamp room (PROGRESS.md, step 31): a shelf of
// twelve small lighthouses, one per trained model (width by numbers per word, height by floors, lamp
// by how close the model came to the floor), and the frontier on a log-log chart. Every number is a
// facts.json value (F).
import { rect, circle, polyline, words, span, label, C, darkness, rad } from "../../shared/lib.mjs";
import { night, glazing } from "../../attention/scene/room.mjs";
import { host } from "../../embeddings/scene/segs.mjs";

const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472" };
const lab = (A, s, size, x, y, fill = INK.night, anchor = "center", a = 1) => ({ shape: words(s, A.mono, size, x, y, anchor), fill, opacity: a, screen: true });
const base = (t, lamp = 1) => [...night(t, { moon: false }), ...glazing(), { shape: rect(560, 820, 1320, 22), fill: "#3a2c18" }];
const scene = (t, A, items) => ({ items: [...items, darkness(380, 760, 1900, 0.3), ...host(t, A)], camera: { x: 960, y: 540, zoom: 1 } });
const X0 = 640, DX = 108;
const name = (r) => `${r.config.dModel}x${r.config.nLayers}`;

// One small lighthouse per run; lit(i) 0..1, hot(i) in ember, show the gap when gap(i).
export function shelf(A, F, { lit = () => 1, hot = () => false, gap = () => false, a = 1 } = {}) {
  const out = [];
  F.grid.runs.forEach((r, i) => {
    const x = X0 + i * DX, w = 18 + r.config.dModel * 1.1, h = 70 + r.config.nLayers * 100, g = Math.min(1, 0.03 / r.final.excess) * lit(i);
    out.push({ shape: polyline([x - w / 2, 820, x - w / 3, 820 - h, x + w / 3, 820 - h, x + w / 2, 820], true), fill: hot(i) ? [0.45, 0.25, 0.18, a] : [0.16, 0.14, 0.12, a], stroke: "#0b0a0c", width: 2 });
    if (g > 0.01) out.push({ shape: circle(x, 820 - h - 12, 54, 32), blend: "add", fill: rad(x, 820 - h - 12, 54, [0, [1, 0.85, 0.5, g * a]], [1, [1, 0.6, 0.3, 0]]) });
    out.push(lab(A, name(r), 21, x, 868, INK.dim, "center", a));
    if (gap(i)) out.push(lab(A, r.final.excess.toFixed(3), 21, x, 900, hot(i) ? INK.ember : INK.night, "center", a));
  });
  return out;
}
// The frontier chart on a dark plate: log compute across, log gap above the floor up.
export function chart(A, F, t, { upto = 1, a = 1, papers = 0 } = {}) {
  const P = F.frontier.points, B = { x: 600, y: 140, w: 1240, h: 640 }, X = (c) => B.x + 60 + ((Math.log10(c) - 7.5) / 4.3) * (B.w - 120), Y = (e) => B.y + B.h - 60 - ((Math.log10(e) + 2) / 2.6) * (B.h - 140);
  const k = Math.max(1, Math.ceil(upto * P.length)), out = [{ shape: rect(B.x, B.y, B.w, B.h, 10), fill: [0.03, 0.03, 0.04, 0.82 * a], screen: true }];
  out.push({ shape: polyline(P.slice(0, k).flatMap((p) => [X(p.compute), Y(p.excess)])), fill: null, stroke: [0.89, 0.58, 0.45, a], width: 4, screen: true });
  P.slice(0, k).forEach((p) => out.push({ shape: circle(X(p.compute), Y(p.excess), 6, 12), fill: [0.89, 0.58, 0.45, a], screen: true }));
  out.push(lab(A, "work (floating-point operations, log scale)", 20, B.x + B.w / 2, B.y + B.h - 16, INK.dim, "center", a), lab(A, "gap above the floor (log scale)", 20, B.x + 30, B.y + 40, INK.dim, "left", a));
  if (upto >= 1) out.push(lab(A, `slope ${F.frontier.fitExcess.slope.toFixed(2)}`, 26, B.x + B.w - 60, B.y + 90, INK.ember, "right", a));
  return out;
}

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.6);
  return { items: [...base(t), ...shelf(A, F, { lit: (i) => (i === 0 ? lit : 0) }), darkness(400, 700, 300 + 1300 * lit, 0.95 - 0.5 * lit), ...host(t, A, { flame: lit })], camera: { x: 960, y: 540, zoom: 1.05 - 0.05 * span(t, 0, 4) } };
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...base(t), ...shelf(A, F, { lit: (i) => span(t, T.say + i * 0.4, T.say + 1 + i * 0.4) }), label(A, "Scaling", 110, 1250, 200, C.ink, "center", a, "head"), label(A, "bigger, longer, how much", 36, 1250, 260, INK.dim, "center", span(t, T.sub, T.sub + 0.6) * a)]);
}
export function shelfSeg(t, A, T, F) {
  const items = [...base(t), ...shelf(A, F, { lit: (i) => span(t, T.score + i * 0.25, T.score + 0.8 + i * 0.25), gap: () => t >= T.score })];
  items.push(lab(A, "each lighthouse: numbers per word x floors", 22, 1250, 80, INK.dim, "center", span(t, T.start + 1, T.start + 2)), lab(A, `floor ${F.floor}: the rules' own loss; lamp brightness: closeness to it`, 22, 1250, 120, INK.night, "center", span(t, T.score, T.score + 0.6)));
  return scene(t, A, items);
}
// Bigger: the smallest, the two-floor 16, then the rest; the seed spread as dots.
export function bigger(t, A, T, F) {
  const show = (i) => (i === 0 && t >= T.small) || (i === 4 && t >= T.mid) || ((i === 7 || i === 11) && t >= T.big) || t >= T.seeds;
  const items = [...base(t), ...shelf(A, F, { hot: (i) => (i === 0 && t >= T.small && t < T.mid) || (i === 4 && t >= T.mid && t < T.big) || ((i === 7 || i === 11) && t >= T.big && t < T.seeds), gap: show, lit: (i) => (show(i) ? 1 : 0.3) })];
  if (t >= T.seeds) {
    const N = F.noise, B = { x: 640, y: 150, w: 1180, h: 180 }, X = (e) => B.x + 40 + (e / 0.04) * (B.w - 80), g = span(t, T.seeds, T.seeds + 1);
    items.push({ shape: rect(B.x, B.y, B.w, B.h, 10), fill: [0.03, 0.03, 0.04, 0.82 * g], screen: true });
    [["16x2, three seeds", N.d16], ["32x2, three seeds", N.d32]].forEach(([n, s], k) => {
      items.push(lab(A, n, 20, B.x + 30, B.y + 56 + k * 70, INK.night, "left", g), { shape: rect(X(s.heldOut.min - F.floor), B.y + 40 + k * 70, Math.max(4, X(s.heldOut.max - F.floor) - X(s.heldOut.min - F.floor)), 24, 4), fill: [0.89, 0.58, 0.45, 0.8 * g], screen: true },
        lab(A, `gap ${(s.heldOut.min - F.floor).toFixed(3)} to ${(s.heldOut.max - F.floor).toFixed(3)}`, 20, B.x + B.w - 30, B.y + 58 + k * 70, INK.dim, "right", g));
    });
  }
  return scene(t, A, items);
}
export function compute(t, A, T, F) {
  const items = [...base(t), ...shelf(A, F, { a: 0.35 }), ...chart(A, F, t, { upto: span(t, T.best, T.line + 2), a: span(t, T.start, T.start + 1) })];
  if (t >= T.size) items.push(lab(A, `best size against work: slope ${F.frontier.fitSizeAtBudget.slope.toFixed(2)}`, 24, 1220, 820, INK.night, "center", span(t, T.size, T.size + 0.6)));
  return scene(t, A, items);
}
// The papers: Kaplan's range; Chinchilla against Gopher, parameters and tokens as bars.
export function papers(t, A, T, F) {
  const H = F.papers.hoffmann, items = [...base(t), ...shelf(A, F, { a: 0.3 }), { shape: rect(600, 140, 1240, 640, 10), fill: [0.03, 0.03, 0.04, 0.85], screen: true }];
  items.push(lab(A, `Kaplan and colleagues, 2020: ${F.papers.kaplan.nRange}`, 24, 640, 210, INK.night, "left", span(t, T.start, T.start + 0.6)));
  if (t >= T.hoff) {
    const g = span(t, T.hoff, T.hoff + 1), row = (y, v, max, col, text) => { const w = (v / max) * 640; return [{ shape: rect(900, y, w, 34, 4), fill: [...col, g], screen: true }, lab(A, text, 20, 912 + w, y + 24, INK.night, "left", g)]; };
    const grey = [0.6, 0.55, 0.5], ember = [0.89, 0.58, 0.45];
    items.push(lab(A, "Hoffmann and colleagues, 2022", 24, 640, 300, INK.night, "left", g), lab(A, "parameters", 20, 640, 380, INK.dim, "left", g), lab(A, "training tokens", 20, 640, 500, INK.dim, "left", g),
      ...row(355, H.gopher.params, H.gopher.params, grey, `Gopher ${H.gopher.params / 1e9} billion`), ...row(400, H.chinchilla.params, H.gopher.params, ember, `Chinchilla ${H.chinchilla.params / 1e9} billion`),
      ...row(475, H.gopher.tokens, H.chinchilla.tokens, grey, `Gopher ${H.gopher.tokens / 1e9} billion`), ...row(520, H.chinchilla.tokens, H.chinchilla.tokens, ember, `Chinchilla ${H.chinchilla.tokens / 1e12} trillion`));
  }
  if (t >= T.ours) items.push(lab(A, `our shelf: ${F.grid.runs[0].params.nonEmbedding.toLocaleString("en")} to ${F.grid.runs.at(-1).params.nonEmbedding.toLocaleString("en")} numbers`, 24, 640, 680, INK.ember, "left", span(t, T.ours, T.ours + 0.6)));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...base(t), ...shelf(A, F, { lit: () => 1 - 0.6 * dim, a: 1 - 0.3 * dim })]);
}
