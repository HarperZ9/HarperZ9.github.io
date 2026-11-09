// The tiling film's later segments (lesson K22): the reads counted for the three kernels, work per
// byte, the missing wait (a stale can in the tile), what the count leaves out, and the close. Every
// value drawn is a facts.json value (F).
import { rect, span } from "../../shared/lib.mjs";
import { INK, lab, plate, floor, scene } from "../../threads/scene/cannery.mjs";
import { table } from "./segs.mjs";

export function count(t, A, T, F) {
  const R = F.counts.rows, rows = [[R[12], "one can at a time", T.start + 1], [R[13], `tiles of ${R[13].T}`, T.start + 3], [R[14], `tiles of ${R[14].T}`, T.start + 5]], W = 1100 / R[12].globalLoads, items = [...floor(), plate(200, 200, 1500, 600)];
  rows.forEach(([r, name, at], i) => { const a = span(t, at, at + 1), y = 300 + i * 140; if (a <= 0) return;
    items.push(lab(A, `${name}: ${r.globalLoads.toLocaleString("en")} reads`, 24, 260, y - 14, INK.night, "left", a), { shape: rect(260, y, Math.max(3, r.globalLoads * W * a), 44, 4), fill: i ? [0.89, 0.58, 0.45, 1] : [0.85, 0.8, 0.7, 1], screen: true }); });
  if (t >= T.perbyte) items.push(lab(A, `operations per byte fetched: ${R[12].intensity.toFixed(2)}, ${R[13].intensity.toFixed(2)}, ${R[14].intensity.toFixed(2)}`, 24, 260, 740, INK.ember, "left", span(t, T.perbyte, T.perbyte + 0.8)));
  return scene(t, A, items);
}
export function wait(t, A, T, F) {
  const a = span(t, T.stale, T.stale + 1), items = [...floor(), ...table(A, "A", (i, j) => i < 2 && j >= 2 && j < 4, { stale: (i, j) => a > 0.5 && i === 1 && j === 3 })];
  items.push(lab(A, "slate: a can still from the last tile", 22, 240, 720, [0.7, 0.82, 0.95], "left", a));
  if (t >= T.broke) items.push(plate(700, 300, 1000, 260), lab(A, "the kernel without the wait, in our emulator:", 24, 740, 370, INK.night, "left", span(t, T.broke, T.broke + 0.8)),
    lab(A, "wrong at every size tried; the checker caught it", 24, 740, 430, INK.ember, "left", span(t, T.broke + 2, T.broke + 3)));
  return scene(t, A, items);
}
export function limits(t, A, T, F) {
  const L = F.lab, items = [...floor(), plate(200, 250, 1500, 420), lab(A, "these are counts of reads asked for, not times", 26, 260, 340)];
  if (t >= T.lab) items.push(lab(A, `the lab: ${L.kernels.join(", ")} kernels at sizes ${L.sizes.join(", ")}`, 24, 260, 440, INK.night, "left", span(t, T.lab, T.lab + 0.8)),
    lab(A, `timed ${L.reps} times on your own chip, with the count beside it`, 24, 260, 500, INK.dim, "left", span(t, T.lab, T.lab + 0.8)));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...floor(), ...table(A, "C", (i, j) => i < 2 && j < 2, { a: 1 - 0.6 * dim })]);
}
