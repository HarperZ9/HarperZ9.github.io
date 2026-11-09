// The tiling film's segments (lesson K22) in Pylon's cannery (PROGRESS.md, step 59): the tables A, B
// and C as grids, one worker fetching can by can, then a crew carrying tiles to its bench, the counts
// and the missing wait. Every count drawn is a facts.json value (F); timings from film.scene.mjs (T).
import { rect, circle, span, label, C } from "../../shared/lib.mjs";
import { INK, CREW, lab, plate, floor, scene, trip } from "../../threads/scene/cannery.mjs";

const N = 8, CELL = 44, POS = { A: [240, 300], B: [760, 300], C: [1280, 300] };
// A table as an N x N grid; hot(i, j) lights a cell, stale(i, j) marks it in slate.
export function table(A, name, hot = () => false, { stale = () => false, a = 1 } = {}) {
  const [x0, y0] = POS[name], out = [lab(A, name, 30, x0, y0 - 20, INK.night, "left", a)];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) out.push({ shape: rect(x0 + j * CELL, y0 + i * CELL, CELL - 4, CELL - 4, 4), fill: stale(i, j) ? [0.49, 0.61, 0.77, a] : hot(i, j) ? [0.89, 0.58, 0.45, a] : [0.3, 0.27, 0.24, a] });
  return out;
}
const tables = (A, hA, hB, hC, o = {}) => [...table(A, "A", hA, o), ...table(A, "B", hB, o), ...table(A, "C", hC, o)];

export function open(t, A, T, F) { return scene(t, A, [...floor(), ...tables(A, () => false, () => false, () => false, { a: span(t, 0.8, 2) })]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...floor(), ...tables(A, () => false, () => false, () => false, { a: 0.4 }), label(A, "Matmul tiling", 92, 960, 160, C.ink, "center", a, "head")]);
}
// One answer number: row 2 of A times column 5 of B, the products sweeping across.
export function matmul(t, A, T, F) {
  const k = Math.floor(span(t, T.start + 1, T.start + 6) * N), items = [...floor(), ...tables(A, (i, j) => i === 2 && j < k, (i, j) => j === 5 && i < k, (i, j) => i === 2 && j === 5)];
  if (t >= T.reads) items.push(lab(A, `for tables ${F.counts.rows[12].n.toLocaleString("en")} wide: ${F.film.trips[4].naive.toLocaleString("en")} reads for one answer number`, 24, 240, 760, INK.ember, "left", span(t, T.reads, T.reads + 0.8)));
  return scene(t, A, items);
}
// One can at a time: every answer cell fetches its own row and column; the per-number fetch count.
export function naive(t, A, T, F) {
  const done = Math.floor(span(t, T.start, T.start + 10) * N * N), cnt = new Array(N * N).fill(0);
  for (let c = 0; c < done; c++) { const i = Math.floor(c / N); for (let j = 0; j < N; j++) cnt[i * N + j] += 1; }
  const items = [...floor(), ...tables(A, (i, j) => cnt[i * N + j] > 0, () => false, (i, j) => i * N + j < done)];
  items.push(lab(A, `fetches of each number of A so far: ${done ? Math.max(...cnt) : 0} of ${N} here`, 22, 240, 720));
  if (t >= T.all) items.push(lab(A, `at ${F.counts.rows[12].n.toLocaleString("en")} wide: each number fetched ${F.film.perElement[4].naive.toLocaleString("en")} times; ${F.counts.rows[12].globalLoads.toLocaleString("en")} reads in all`, 24, 240, 780, INK.ember, "left", span(t, T.all, T.all + 0.8)));
  return scene(t, A, items);
}
// The tray: a crew's 2 x 2 tile of C; tiles of A walk along its rows and tiles of B down its columns.
export function tray(t, A, T, F) {
  const ph = Math.min(3, Math.floor(span(t, T.carry, T.carry + 12) * 4)), inA = (i, j) => i < 2 && j >= ph * 2 && j < ph * 2 + 2, inB = (i, j) => j < 2 && i >= ph * 2 && i < ph * 2 + 2;
  const items = [...floor(), ...tables(A, inA, inB, (i, j) => i < 2 && j < 2)];
  items.push({ shape: rect(860, 760, 300, 120, 8), fill: [0.35, 0.28, 0.2, 1], stroke: "#0b0a0c", width: 3, screen: true }, lab(A, "the bench: shared memory", 20, 860, 750, INK.dim));
  for (let w = 0; w < 4; w++) items.push({ shape: circle(900 + w * 60, 920, 14, 16), fill: [...CREW[0], 1], stroke: "#0b0a0c", width: 2, screen: true });
  if (t >= T.carry) items.push(lab(A, `tile pair ${ph + 1} of 4 on the bench; the crew waits, works, waits`, 22, 240, 720, INK.night, "left", span(t, T.carry, T.carry + 0.8)));
  if (t >= T.fewer) items.push(lab(A, `tiles ${F.counts.rows[14].T} wide: each number fetched ${F.film.perElement[4].tiled16} times, not ${F.film.perElement[4].naive.toLocaleString("en")}`, 24, 240, 1000, INK.ember, "left", span(t, T.fewer, T.fewer + 0.8)));
  return scene(t, A, items);
}
