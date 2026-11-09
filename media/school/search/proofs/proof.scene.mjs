// Visual-direction proofs for lessons A26 (search and sorting) and A27 (edit distance), PROGRESS.md
// step 73. Every number here is an illustration and says so. ?dir=A: a row of shells; one knock at a
// time on the top row, a halving bracket on the bottom row. ?dir=B: the four cost curves on a log-log
// tide board. ?dir=C: the tide table, a grid of small numbers filled cell by cell with the three
// neighbours lit. ?dir=D: the call tree of the naive recursion fanning out beside one table.
import { rect, circle, polyline, words, darkness, GUIDES } from "../../shared/lib.mjs";
import { beach, rerun, INK } from "../../errorbars/scene/tide.mjs";

const DIR = new URL(import.meta.url).searchParams.get("dir") || "A";
const sm = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const EMBER = [0.89, 0.58, 0.45], PAPER = [0.9, 0.86, 0.75];
const lab = (A, s, size, x, y, fill = INK.night, anchor = "left") => ({ shape: words(s, A.mono, size, x, y, anchor), fill, screen: true });

function shells(A, t) {
  const out = [...beach(t)], n = 32, X = (i) => 600 + i * 38, k = Math.floor(sm(0.5, 5, t) * 20);
  for (let i = 0; i < n; i++) out.push({ shape: circle(X(i), 360, 14, 20), fill: i < k ? [0.4, 0.38, 0.35, 1] : [...PAPER, 1] });
  out.push(lab(A, `one at a time: ${k} knocks`, 22, 600, 320));
  let lo = 0, hi = n - 1; const steps = Math.floor(sm(0.5, 5, t) * 5);
  for (let s = 0; s < steps; s++) { const mid = (lo + hi) >> 1; if (20 > mid) lo = mid + 1; else hi = mid; }
  for (let i = 0; i < n; i++) out.push({ shape: circle(X(i), 560, 14, 20), fill: i < lo || i > hi ? [0.4, 0.38, 0.35, 1] : i === 20 ? [...EMBER, 1] : [...PAPER, 1] });
  out.push(lab(A, `halve the beach: ${steps} knocks`, 22, 600, 520), lab(A, "illustration", 20, 1700, 1040, INK.dim));
  return out;
}
function curves(A, t) {
  const out = [...beach(t), { shape: rect(560, 120, 1260, 640, 10), fill: [0.03, 0.03, 0.04, 0.7] }], X = (n) => 620 + (Math.log2(n) - 3) / 13 * 1140, Y = (c) => 720 - Math.log10(Math.max(c, 1)) / 10 * 560;
  const f = { "knock along": (n) => n / 2, "halve": (n) => Math.log2(n), "insertion": (n) => n * n / 4, "merge": (n) => n * Math.log2(n) };
  Object.entries(f).forEach(([k, g], i) => { const pts = []; for (let e = 3; e <= 3 + 13 * sm(0.5, 4, t); e += 0.25) pts.push(X(2 ** e), Y(g(2 ** e)));
    out.push({ shape: polyline(pts), fill: null, stroke: i === 2 ? [...EMBER, 1] : [...PAPER, 0.5 + 0.15 * i], width: 4 }, lab(A, k, 20, pts.at(-2) + 10, pts.at(-1) - 8)); });
  out.push(lab(A, "illustration: comparisons against shells, both scales doubling", 20, 620, 160, INK.dim));
  return out;
}
function table(A, t) {
  const out = [...beach(t)], a = "kitten", b = "sitting", c = 64, x0 = 760, y0 = 180, D = [];
  for (let i = 0; i <= a.length; i++) { D.push([]); for (let j = 0; j <= b.length; j++) D[i][j] = i === 0 ? j : j === 0 ? i : Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); }
  const k = Math.floor(sm(0.5, 5, t) * 56);
  for (let i = 0; i <= a.length; i++) for (let j = 0; j <= b.length; j++) { const idx = i * 8 + j, cur = idx === k;
    out.push({ shape: rect(x0 + j * c, y0 + i * c, c - 4, c - 4, 4), fill: cur ? [...EMBER, 1] : idx < k ? [0.25, 0.23, 0.21, 1] : [0.12, 0.11, 0.1, 1] });
    if (idx < k) out.push(lab(A, String(D[i][j]), 24, x0 + j * c + c / 2 - 2, y0 + i * c + 40, INK.night, "center")); }
  [...a].forEach((ch, i) => out.push(lab(A, ch, 24, x0 - 30, y0 + (i + 1) * c + 40, INK.dim, "center"))); [...b].forEach((ch, j) => out.push(lab(A, ch, 24, x0 + (j + 1) * c + 28, y0 - 14, INK.dim, "center")));
  out.push(lab(A, "illustration: the tide table for kitten and sitting", 20, 760, 860, INK.dim));
  return out;
}
function calls(A, t) {
  const out = [...beach(t)], depth = Math.floor(sm(0.5, 5, t) * 6);
  const node = (x, y, d, w) => { out.push({ shape: circle(x, y, 7, 12), fill: [...PAPER, 1] }); if (d >= depth) return; for (let k = -1; k <= 1; k++) { const nx = x + k * w, ny = y + 90; out.push({ shape: polyline([x, y + 7, nx, ny - 7]), fill: null, stroke: [0.8, 0.76, 0.66, 0.6], width: 2 }); node(nx, ny, d + 1, w / 3); } };
  node(1000, 160, 0, 360);
  out.push(lab(A, `try every way: ${(3 ** (depth + 1) - 1) / 2} calls so far`, 22, 600, 120), lab(A, "illustration", 20, 1700, 1040, INK.dim));
  return out;
}
export default {
  title: `Search and edit distance proof ${DIR}`, duration: 6, fps: 30,
  async load(ctx) {
    const [sans, mono] = await Promise.all([ctx.json("../../../explainers/motion/hanken-500.json"), ctx.json("../../../explainers/motion/conso-400.json")]);
    for (const g of Object.values(GUIDES)) if (g.textures && ctx.motion) for (const [k, v] of Object.entries(g.textures())) ctx.motion.image(k, v);
    return { sans, mono };
  },
  frame(t, ctx) {
    const A = ctx.assets, items = DIR === "A" ? shells(A, t) : DIR === "B" ? curves(A, t) : DIR === "C" ? table(A, t) : calls(A, t);
    return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, darkness(300, 900, 900, 0.25), ...rerun(t, { knock: 1, read: sm(2, 3, t) })], post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [{ pass: "film", preset: "500t-print", ev: 1.6 }] } };
  },
};
