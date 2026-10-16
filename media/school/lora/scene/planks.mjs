// The hull of planks (PROGRESS.md, step 38), for lesson S19: a weight matrix drawn as a grid of
// planks, one per number, its value as the plank's tone (ember for positive, slate for negative,
// depth by size). The adapter's two strips, B (a column) and A (a row), sit beside the grid, and
// their product B A is drawn as its own grid before it is added. Every value drawn comes from
// facts.json; nothing here invents a number.
import { rect, words } from "../../shared/lib.mjs";

export const INK = { night: "#ece5d6", dim: "#958e80", ember: "#e29472", slate: "#7d9cc4", wood: "#3a2c18" };
const POS = [0.89, 0.58, 0.45], NEG = [0.49, 0.61, 0.77], MID = [0.24, 0.2, 0.16];

// Tone for value v against a scale: ember or slate, mixed from the dark plank colour.
export function tone(v, scale, a = 1) {
  const u = Math.min(1, Math.abs(v) / (scale || 1)), c = v >= 0 ? POS : NEG;
  return [MID[0] + (c[0] - MID[0]) * u, MID[1] + (c[1] - MID[1]) * u, MID[2] + (c[2] - MID[2]) * u, a];
}
export const maxAbs = (rows) => rows.reduce((m, r) => Math.max(m, ...r.map(Math.abs)), 0);

// A grid of planks. M: rows of numbers. at: top-left corner. cell: plank pitch in pixels.
// upto(i): how much of row i is shown (0 to 1), for a sweep. a: opacity.
export function grid(M, { at = { x: 0, y: 0 }, cell = 20, scale = maxAbs(M), upto = () => 1, a = 1, frame = true } = {}) {
  const rows = M.length, cols = M[0].length, out = [];
  if (frame) out.push({ shape: rect(at.x - 10, at.y - 10, cols * cell + 18, rows * cell + 18, 6), fill: INK.wood, stroke: "#0b0a0c", width: 3, opacity: a });
  for (let i = 0; i < rows; i++) {
    const shown = Math.floor(cols * upto(i));
    for (let j = 0; j < shown; j++) out.push({ shape: rect(at.x + j * cell, at.y + i * cell, cell - 2, cell - 2, 2), fill: tone(M[i][j], scale, a) });
  }
  return out;
}

// A strip: one column (vertical) or one row (horizontal) of planks.
export function strip(v, { at, cell = 20, vertical = true, scale = Math.max(...v.map(Math.abs)), a = 1 } = {}) {
  const out = [{ shape: rect(at.x - 6, at.y - 6, (vertical ? 1 : v.length) * cell + 10, (vertical ? v.length : 1) * cell + 10, 4), fill: INK.wood, stroke: "#0b0a0c", width: 2, opacity: a }];
  v.forEach((x, k) => out.push({ shape: rect(at.x + (vertical ? 0 : k * cell), at.y + (vertical ? k * cell : 0), cell - 2, cell - 2, 2), fill: tone(x, scale, a) }));
  return out;
}

// The outer product s * b a, as rows.
export const outer = (b, aRow, s = 1) => b.map((x) => aRow.map((y) => s * x * y));
// W + D, elementwise.
export const add = (W, D) => W.map((r, i) => r.map((x, j) => x + D[i][j]));

// A caption under a grid, in the mono face.
export const caption = (A, str, x, y, fill = INK.night, a = 1, size = 26) => ({ shape: words(str, A.mono, size, x, y, "center"), fill, opacity: a, screen: true });
