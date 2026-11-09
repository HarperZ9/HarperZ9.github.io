// The search film's later segments (lesson A26): insertion and merge sort on the facts' row of eight,
// their counts at 65,536 on a log bar scale, the four cost curves on a log-log tide board, the limits
// and the close. Every value drawn is a facts.json value (F).
import { rect, polyline } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";
import { row, trace, bars, EMBER, PAPER } from "./segs.mjs";

const R = (F, i) => F.sorting.rows[i];
export function insertion(t, A, T, F) {
  const items = [...beach(t), lab(A, "insertion: slide each shell left past the bigger ones", 20, 640, 220, INK.dim), ...trace(A, F.steps.insertion.frames, span(t, T.start + 1, T.counts), 640, 420)];
  if (t >= T.counts) items.push(plate(620, 520, 1220, 280, 0.6), ...bars(A, [["already in order", R(F, 27).insertion.comparisons.mean, false, span(t, T.counts, T.counts + 0.8)], ["reverse order", R(F, 41).insertion.comparisons.mean, true, span(t, T.reversed, T.reversed + 0.8)], ["jumbled", R(F, 13).insertion.comparisons.mean, true, span(t, T.jumbled, T.jumbled + 0.8)]], 660, 560));
  return scene(t, A, items);
}
export function merge(t, A, T, F) {
  const items = [...beach(t), lab(A, "merge: sort each half, then walk both halves taking the smaller front shell", 20, 640, 220, INK.dim), ...trace(A, F.steps.merge.frames, span(t, T.start + 1, T.count), 640, 420)];
  if (t >= T.count) items.push(plate(620, 520, 1220, 220, 0.6), ...bars(A, [["merge, jumbled", R(F, 13).merge.comparisons.mean, false, span(t, T.count, T.count + 0.8)], ["insertion, jumbled", R(F, 13).insertion.comparisons.mean, true, span(t, T.ratio, T.ratio + 0.8)]], 660, 560));
  return scene(t, A, items);
}
// The four curves, log-log: shells against comparisons, each appearing with its sentence.
export function growth(t, A, T, F) {
  const C = F.film.curves, X = (n) => 680 + ((Math.log2(n) - 3) / 13) * 1040, Y = (c) => 780 - (Math.log10(Math.max(c, 1)) / 10) * 560, items = [...beach(t), plate(620, 140, 1220, 720, 0.6)];
  items.push({ shape: rect(680, 780, 1040, 2), fill: [0.6, 0.55, 0.45, 1], screen: true }, { shape: rect(680, 220, 2, 560), fill: [0.6, 0.55, 0.45, 1], screen: true }, lab(A, "shells (each step doubles)", 18, 1720, 816, INK.dim, "right"), lab(A, "comparisons (each step ten times)", 18, 690, 210, INK.dim));
  [["knocking along", C.linear, T.linear, false], ["halving", C.binary, T.binary, false], ["insertion sort", C.insertion, T.insertion, true], ["merge sort", C.merge, T.merge, false]].forEach(([n, pts, at, hot]) => { const a = span(t, at, at + 1.2), k = Math.max(2, Math.ceil(a * pts.length)), p = pts.slice(0, k);
    items.push({ shape: polyline(p.flatMap(([x, y]) => [X(x), Y(y)])), fill: null, stroke: hot ? [...EMBER, a > 0 ? 1 : 0] : [...PAPER, a > 0 ? 0.9 : 0], width: 4, screen: true });
    if (a >= 1) items.push(lab(A, n, 20, X(p.at(-1)[0]) + 12, Y(p.at(-1)[1]) + 6, hot ? INK.ember : INK.night)); });
  if (t >= T.time) { const r = F.timing.rows.at(-1); items.push(lab(A, `this computer, ${F.film.beach.shells.toLocaleString("en")} jumbled shells: insertion ${Math.round(r.insertionSortMs).toLocaleString("en")} ms, merge ${r.mergeSortMs.toFixed(2)} ms`, 20, 690, 840, INK.night, "left", span(t, T.time, T.time + 0.8))); }
  return scene(t, A, items);
}
export function limits(t, A, T, F) {
  const r = F.timing.rows.at(-1), items = [...beach(t), plate(620, 260, 1220, 340, 0.6)];
  [["counts of comparisons, not times", T.start + 0.5], [`built-in sort, same row, same computer: ${r.builtinSortMs.toFixed(2)} ms`, T.builtin], ["the counts say which way the cost grows", T.grows]].forEach(([s, at], i) => items.push(lab(A, s, 24, 660, 340 + i * 80, i === 2 ? INK.ember : INK.night, "left", span(t, at, at + 0.8))));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const dim = span(t, T.night, T.end);
  return scene(t, A, [...beach(t), ...row(F.steps.inputs.sorted16, 640, 520, 70, (i) => (i === 7 ? "hot" : "paper"), 1 - 0.6 * dim)], { knock: T.start + 1 });
}
