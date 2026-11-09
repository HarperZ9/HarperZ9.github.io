// Visual-direction proofs for lessons K25 (the denoiser's tensor-core parity) and E25 (Flywheel and
// re-derivable evaluation), PROGRESS.md step 71. Every number here is an illustration and says so.
// ?dir=A: the glint: a patch of image as tiles on the sand, one tile blazing; the prism reads it twice
// (32-bit, 16-bit) and a fixed slot on a gauge shows the bound; the 16-bit needle lands outside.
// ?dir=B: the gate that does not move: a post at the bound and each attempt as a stone thrown at it,
// every stone stopping past the post. ?dir=C: the shell's receipt: fifty beads threaded by a tree of
// strings to one knot; flipping one bead lights its path to the knot. ?dir=D: the ledger: stated and
// recomputed hashes side by side, compared character by character.
import { rect, circle, polyline, words, darkness, GUIDES } from "../../shared/lib.mjs";
import { beach, rerun, thePrism, INK } from "../../errorbars/scene/tide.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const EMBER = [0.89, 0.58, 0.45], SLATE = [0.7, 0.82, 0.95];
const lab = (A, s, size, x, y, fill = INK.night, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });

function glint(A, t) {
  const out = [...beach(t)], c = 30;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const hot = i === 4 && j === 4, g = 0.25 + 0.1 * Math.sin(i * 1.7 + j);
    out.push({ shape: rect(760 + j * c, 300 + i * c, c - 2, c - 2, 2), fill: hot ? [1, 0.95, 0.8, 1] : [g, g * 0.9, g * 0.8, 1], blend: hot ? "add" : undefined }); }
  out.push(...thePrism(sm(1, 2, t)), lab(A, "one bright pixel, read twice", 22, 760, 270));
  const g = (y, name, v, col) => { const X = (e) => 1240 + Math.min(e, 0.15) / 0.15 * 520;
    out.push({ shape: rect(1240, y, 520, 8, 3), fill: [0.3, 0.27, 0.24, 1] }, { shape: rect(1240, y - 14, X(0.01) - 1240, 36, 3), fill: [...SLATE, 0.25] },
      { shape: rect(X(v * sm(1.5, 4, t)) - 3, y - 22, 6, 52), fill: [...col, 1] }, lab(A, name, 22, 1240, y - 34)); };
  g(420, "32-bit: inside the bound", 0.003, INK.paper.slice(0, 3)); g(580, "16-bit: past the bound", 0.107, EMBER);
  out.push(lab(A, "the slot is the bound; it does not move", 20, 1240, 680, INK.dim), lab(A, "illustration", 20, 1700, 1040, INK.dim));
  return out;
}
function gate(A, t) {
  const out = [...beach(t)], X = (e) => 500 + (e / 0.12) * 1200, rows = [["all 16-bit", 0.107], ["head in 32-bit", 0.051], ["three layers in 32-bit", 0.034], ["six layers in 32-bit", 0.034]];
  out.push({ shape: rect(X(0.01) - 6, 220, 12, 600), fill: [...SLATE, 1] }, lab(A, "the bound", 22, X(0.01), 200, INK.night, "center"));
  rows.forEach(([n, v], i) => { const u = sm(1 + i * 0.8, 2 + i * 0.8, t), y = 300 + i * 120;
    out.push(lab(A, n, 22, 500, y - 20, INK.dim), { shape: circle(500 + (X(v) - 500) * u, y + 10, 16, 24), fill: [...EMBER, 1] }); });
  out.push(lab(A, "illustration: each fix gets closer; none reaches the post", 20, 500, 900, INK.dim));
  return out;
}
function tree(A, t) {
  const out = [...beach(t)], n = 16, flip = t > 3 ? 5 : -1, X = (i) => 360 + i * 80;
  for (let i = 0; i < n; i++) out.push({ shape: circle(X(i), 760, 18, 24), fill: i === flip ? [...EMBER, 1] : i % 5 === 3 ? [0.4, 0.38, 0.35, 1] : [...INK.paper] });
  let level = Array.from({ length: n }, (_, i) => [X(i), 760, i === flip]), y = 760;
  while (level.length > 1) { const next = []; y -= 110;
    for (let k = 0; k < level.length; k += 2) { const a = level[k], b = level[k + 1], x = (a[0] + b[0]) / 2, hot = a[2] || b[2];
      for (const p of [a, b]) out.push({ shape: polyline([p[0], p[1] - 18, x, y + 12]), fill: null, stroke: hot ? [...EMBER, 1] : [0.8, 0.76, 0.66, 0.7], width: 3 });
      next.push([x, y, hot]); }
    level = next; }
  out.push({ shape: circle(level[0][0], y, 26, 32), fill: flip >= 0 ? [...EMBER, 1] : [...INK.paper] }, lab(A, flip >= 0 ? "one bead changed: the knot no longer matches" : "every bead tied to one knot", 22, level[0][0] + 40, y + 8));
  out.push(lab(A, "illustration: 16 of the receipt's 50 rows", 20, 1300, 1040, INK.dim));
  return out;
}
function ledger(A, t) {
  const out = [...beach(t), { shape: rect(420, 200, 1240, 520, 10), fill: [0.9, 0.86, 0.75, 0.95] }];
  const stated = "4f1c9a07be52d3e8", got = t > 3 ? "4f1c9a07be52d3e9" : stated, k = Math.floor(sm(1, 3, t) * 16);
  out.push(lab(A, "stated", 26, 480, 330, "#1d1812"), lab(A, "recomputed", 26, 480, 450, "#1d1812"));
  for (let i = 0; i < 16; i++) { const same = stated[i] === got[i];
    out.push(lab(A, stated[i], 34, 760 + i * 52, 330, "#1d1812", "center"));
    if (i < k || t > 3) out.push(lab(A, got[i], 34, 760 + i * 52, 450, same ? "#1d1812" : "#b5482e", "center")); }
  out.push(lab(A, t > 3 ? "one byte changed: the last character differs" : "same bytes, same hash", 24, 480, 600, "#1d1812"), lab(A, "illustration", 20, 1700, 1040, INK.dim));
  return out;
}
export default {
  title: `Denoiser and receipts proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = DIR === "A" ? glint(A, t) : DIR === "B" ? gate(A, t) : DIR === "C" ? tree(A, t) : ledger(A, t);
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, darkness(300, 900, 900, 0.25), ...rerun(t, { knock: 1, read: sm(2, 3, t) })], post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
