// The edit-distance film's later segments (lesson A27): the calls against the questions, the tide
// table filled, the traceback on the guides' sentence, the greedy shortcut's misses, Bellman's idea, and
// the close. Every value drawn is a facts.json value (F).
import { rect } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";
import { tideTable, pathOf, tiles, EMBER, PAPER } from "./segs.mjs";

export function explode(t, A, T, F) {
  const N = F.naive.rows.at(-1), W = (c) => (Math.log10(Math.max(c, 1)) / 10) * 1000, items = [...beach(t), plate(620, 240, 1220, 360, 0.6)];
  items.push(lab(A, `two phrases of ${N.length} characters: "${N.a}"`, 20, 660, 300, INK.dim));
  [["calls, trying every way", N.calls, true, T.start + 0.5], ["different questions", N.cells, false, T.cells]].forEach(([n, c, hot, at], i) => { const a = span(t, at, at + 1);
    items.push(lab(A, n, 20, 660, 380 + i * 110, INK.dim, "left", a), { shape: rect(660, 392 + i * 110, W(c) * a, 30, 4), fill: hot ? [...EMBER, 1] : [...PAPER, 1], screen: true }, lab(A, c.toLocaleString("en"), 22, 660 + W(c) * a + 14, 414 + i * 110, INK.night, "left", a)); });
  if (t >= T.start + 1) items.push(lab(A, `${Math.round(N.ms).toLocaleString("en")} ms on this computer`, 20, 660, 560, INK.dim, "left", span(t, T.start + 1, T.start + 2)));
  return scene(t, A, items);
}
export function table(t, A, T, F) {
  const tb = F.film.tables[0], cells = (tb.a.length + 1) * (tb.b.length + 1), k = Math.floor(span(t, T.fill, T.corner) * cells), items = [...beach(t), ...tideTable(A, tb, 760, 200, 64, k)];
  if (t >= T.corner) items.push(lab(A, `${cells} squares instead of ${F.pairs.rows[0].naiveCallsRun.toLocaleString("en")} calls; the corner: ${tb.distance}`, 24, 700, 760, INK.night, "left", span(t, T.corner, T.corner + 0.8)));
  return scene(t, A, items);
}
export function trace(t, A, T, F) {
  const tb = F.film.tables[2], p = pathOf(tb), n = Math.floor(span(t, T.back, T.back + 4) * p.length), al = tb.alignment, items = [...beach(t), ...tideTable(A, tb, 700, 150, 36, 1e9, { path: p.slice(0, n) })];
  if (t >= T.pair) items.push(...tiles(A, al.top, 700, 830, (i) => al.marks[i] !== " ", span(t, T.pair, T.pair + 0.8), 36), ...tiles(A, al.bottom, 700, 900, (i) => al.marks[i] !== " ", span(t, T.pair, T.pair + 0.8), 36));
  return scene(t, A, items);
}
export function greedy(t, A, T, F) {
  const G = F.controls.greedy.rows.slice(2), items = [...beach(t), plate(620, 160, 1220, 700, 0.6), lab(A, "true distance, then the greedy walk's", 20, 660, 220, INK.dim)];
  G.forEach((r, i) => { const a = span(t, T.start + 0.5 + i * 0.4, T.start + 1 + i * 0.4), w = span(t, T.wrong, T.wrong + 0.8);
    items.push(lab(A, `${r.a}  /  ${r.b}`, 20, 660, 290 + i * 70, INK.night, "left", a), lab(A, String(r.distance), 22, 1560, 290 + i * 70, INK.night, "right", a), lab(A, String(r.greedy), 22, 1680, 290 + i * 70, r.wrong ? INK.ember : INK.night, "right", w)); });
  if (t >= T.wrong) items.push(lab(A, `random pairs: too high on ${F.controls.random.greedyAbove} of ${F.controls.random.pairs}, never too low`, 22, 660, 760, INK.ember, "left", span(t, T.wrong + 1, T.wrong + 2)));
  return scene(t, A, items);
}
export function bellman(t, A, T, F) {
  const items = [...beach(t), plate(620, 300, 1220, 260, 0.6)];
  [["Richard Bellman, around 1950: dynamic programming", T.start + 0.5], ["solve each smaller problem once and keep the answer", T.today], ["shortest routes; speech decoding", T.uses]].forEach(([s, at], i) => items.push(lab(A, s, 24, 660, 370 + i * 70, i === 1 ? INK.ember : INK.night, "left", span(t, at, at + 0.8))));
  return scene(t, A, items);
}
export function close(t, A, T, F) {
  const tb = F.film.tables[0], dim = span(t, T.night, T.end);
  return scene(t, A, [...beach(t), ...tideTable(A, tb, 760, 200, 64, 1e9, { path: pathOf(tb), a: 1 - 0.6 * dim })]);
}
