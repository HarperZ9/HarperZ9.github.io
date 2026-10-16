// The edit-distance film's segments (lesson A27) at the tide line (PROGRESS.md, step 73): letters as
// tiles, the naive recursion as a call tree fanning out, and the tide table filled square by square
// with the three neighbours lit. Every value drawn is a facts.json value (F); the tables and alignments
// are the facts' own (F.film.tables). Timings from the cue map in film.scene.mjs (T).
import { rect, circle, polyline, words, label, C } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";

export const EMBER = [0.89, 0.58, 0.45], PAPER = [0.9, 0.86, 0.75];
// Letter tiles for a row of an alignment; mark(i) true lights tile i in ember.
export function tiles(A, s, x, y, mark = () => false, a = 1, w = 52) {
  return [...s].flatMap((ch, i) => [{ shape: rect(x + i * w, y - 40, w - 6, 54, 4), fill: mark(i) ? [...EMBER, a] : ch === "-" ? [0.2, 0.19, 0.18, a] : [...PAPER, a], screen: true },
    { shape: words(ch === "-" ? "" : ch, A.mono, 28, x + i * w + (w - 6) / 2, y, "center"), fill: "#1d1812", opacity: a, screen: true }]);
}
// The tide table for one facts table: filled up to cell k (row-major), the current cell and its three
// neighbours lit; path: cells to light as the traceback.
export function tideTable(A, tb, x0, y0, c, k, { path = [], a = 1 } = {}) {
  const out = [], m = tb.a.length, n = tb.b.length, cur = [Math.floor(k / (n + 1)), k % (n + 1)];
  for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) { const idx = i * (n + 1) + j, on = path.some(([p, q]) => p === i && q === j), nb = idx === k || (i === cur[0] - 1 && (j === cur[1] || j === cur[1] - 1)) || (i === cur[0] && j === cur[1] - 1);
    out.push({ shape: rect(x0 + j * c, y0 + i * c, c - 4, c - 4, 4), fill: on ? [...EMBER, a] : idx === k ? [...EMBER, 0.8 * a] : nb && idx < k ? [0.4, 0.37, 0.33, a] : idx < k ? [0.24, 0.22, 0.2, a] : [0.11, 0.1, 0.09, a], screen: true });
    if (idx < k || on) out.push(lab(A, String(tb.D[i][j]), Math.round(c * 0.38), x0 + j * c + c / 2 - 2, y0 + i * c + c * 0.62, INK.night, "center", a)); }
  [...tb.a].forEach((ch, i) => out.push(lab(A, ch === " " ? "_" : ch, Math.round(c * 0.38), x0 - c * 0.45, y0 + (i + 1) * c + c * 0.62, INK.dim, "center", a)));
  [...tb.b].forEach((ch, j) => out.push(lab(A, ch === " " ? "_" : ch, Math.round(c * 0.38), x0 + (j + 1) * c + c / 2 - 2, y0 - c * 0.25, INK.dim, "center", a)));
  return out;
}
// The traceback path for a facts table: from the corner back along the recorded choices.
export function pathOf(tb) {
  const out = []; let i = tb.a.length, j = tb.b.length;
  while (i > 0 || j > 0) { out.push([i, j]); const ch = tb.choice[i][j]; if (ch === "delete") i--; else if (ch === "insert") j--; else { i--; j--; } }
  out.push([0, 0]);
  return out;
}
// The naive recursion's call tree to a depth: three children per call.
export function callTree(x, y, depth, w, a = 1) {
  const out = [], node = (cx, cy, d, ww) => { out.push({ shape: circle(cx, cy, 6, 12), fill: [...PAPER, a], screen: true }); if (d >= depth) return;
    for (let k = -1; k <= 1; k++) { const nx = cx + k * ww, ny = cy + 80; out.push({ shape: polyline([cx, cy + 6, nx, ny - 6]), fill: null, stroke: [0.8, 0.76, 0.66, 0.6 * a], width: 2, screen: true }); node(nx, ny, d + 1, ww / 3); } };
  node(x, y, 0, w);
  return out;
}
const K = (F) => F.film.tables[0];
export function open(t, A, T, F) { return scene(t, A, [...beach(t), ...tideTable(A, K(F), 760, 200, 64, Math.floor(span(t, 0.5, 3.5) * 20))]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...tideTable(A, K(F), 760, 260, 64, 20, { a: 0.35 }), label(A, "Dynamic programming", 84, 960, 170, C.ink, "center", a, "head")]);
}
export function problem(t, A, T, F) {
  const al = K(F).alignment, on = t >= T.edits, items = [...beach(t), lab(A, "the fewest single-letter edits: insert, delete, change", 22, 640, 260, INK.dim, "left", span(t, T.start + 1, T.start + 2))];
  items.push(...tiles(A, on ? al.top : K(F).a, 640, 420, (i) => on && al.marks[i] !== " "), ...tiles(A, on ? al.bottom : K(F).b, 640, 520, (i) => on && al.marks[i] !== " "));
  if (on) items.push(lab(A, `edit distance: ${K(F).distance}`, 30, 640, 640, INK.night, "left", span(t, T.edits, T.edits + 0.8)));
  return scene(t, A, items);
}
export function naive(t, A, T, F) {
  const P = F.pairs.rows, items = [...beach(t), ...callTree(1180, 220, Math.floor(span(t, T.start + 1, T.kitten) * 5), 380)];
  if (t >= T.kitten) items.push(plate(620, 680, 1200, 120, 0.6), lab(A, `kitten and sitting: ${P[0].naiveCallsRun.toLocaleString("en")} calls`, 24, 660, 726, INK.night, "left", span(t, T.kitten, T.kitten + 0.8)));
  if (t >= T.intention) items.push(lab(A, `intention and execution: ${P[1].naiveCallsRun.toLocaleString("en")} calls`, 24, 660, 772, INK.ember, "left", span(t, T.intention, T.intention + 0.8)));
  return scene(t, A, items);
}
