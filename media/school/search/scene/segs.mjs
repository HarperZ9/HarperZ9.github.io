// The search film's segments (lesson A26) at the tide line (PROGRESS.md, step 73): a row of shells
// sized by their value, Rerun's knocks one at a time, the halving bracket, and the jumbled row where
// halving goes wrong. The rows drawn are the facts' own step traces (F.steps); every count is a facts
// value. Timings from the cue map in film.scene.mjs (T).
import { rect, circle, polyline, label, C } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, span } from "../../errorbars/scene/tide.mjs";

export const EMBER = [0.89, 0.58, 0.45], PAPER = [0.9, 0.86, 0.75], DARK = [0.35, 0.33, 0.3];
// A row of shells: values v, at x0 with spacing dx; tone(i) in "paper" | "dark" | "hot".
export function row(v, x0, y, dx, tone = () => "paper", a = 1, max = Math.max(...v)) {
  return v.map((x, i) => { const r = 10 + 16 * (x / Math.max(1, max)), c = tone(i) === "hot" ? EMBER : tone(i) === "dark" ? DARK : PAPER;
    return { shape: circle(x0 + i * dx, y - r, r, 24), fill: [...c, a], screen: true }; });
}
export function open(t, A, T, F) {
  const k = Math.floor(span(t, 0.5, 3.5) * 10);
  return scene(t, A, [...beach(t), ...row(F.steps.inputs.random16, 640, 520, 70, (i) => (i < k ? "dark" : "paper"))], { knock: 1 });
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...row(F.steps.inputs.random16, 640, 520, 70, () => "paper", 0.4), label(A, "Search and sorting", 84, 960, 170, C.ink, "center", a, "head")]);
}
// One at a time: knocks sweep the row; then the measured averages.
export function linear(t, A, T, F) {
  const L = F.search.linear[13], v = F.steps.inputs.random16, key = v.indexOf(11), k = Math.min(key + 1, Math.floor(span(t, T.start + 1, T.avg) * (key + 2)));
  const items = [...beach(t), lab(A, `a row of ${F.film.beach.shells.toLocaleString("en")} shells; sixteen drawn`, 20, 640, 300, INK.dim), ...row(v, 640, 520, 70, (i) => (i === key && k > key ? "hot" : i < k ? "dark" : "paper"))];
  items.push(lab(A, `knocks: ${k}`, 26, 640, 620, INK.night));
  if (t >= T.avg) items.push(plate(620, 680, 1180, 120, 0.6), lab(A, `on average ${Math.round(L.successful.mean).toLocaleString("en")} knocks, about half the row`, 24, 660, 730, INK.night, "left", span(t, T.avg, T.avg + 0.8)));
  if (t >= T.missing) items.push(lab(A, `a missing shell: all ${L.missing.toLocaleString("en")}`, 24, 660, 776, INK.ember, "left", span(t, T.missing, T.missing + 0.8)));
  return scene(t, A, items);
}
// Halve the beach: the sorted row with the bracket of the facts' binary trace.
export function binary(t, A, T, F) {
  const v = F.steps.inputs.sorted16, fr = F.steps.binary.frames, k = Math.min(fr.length - 1, Math.floor(span(t, T.middle, T.middle + 6) * fr.length)), f = fr[k], B = F.search.binary[13];
  const items = [...beach(t), lab(A, "the same shells, in order; looking for 11", 20, 640, 300, INK.dim), ...row(v, 640, 520, 70, (i) => (i === f.index ? "hot" : i < f.lo || i > f.hi ? "dark" : "paper"))];
  if (k > 0) items.push({ shape: rect(640 + f.lo * 70 - 30, 540, (f.hi - f.lo) * 70 + 60, 4), fill: [...EMBER, 1], screen: true }, lab(A, `knocks: ${f.comparisons}`, 26, 640, 620, INK.night));
  if (t >= T.bound) items.push(plate(620, 680, 1180, 120, 0.6), lab(A, `${F.film.beach.shells.toLocaleString("en")} shells: at most ${B.bound} knocks, about ${Math.round(B.successful.mean)} on average`, 24, 660, 740, INK.night, "left", span(t, T.bound, T.bound + 0.8)));
  return scene(t, A, items);
}
// Only if they are in order: halving on the jumbled row lands on the wrong shell.
export function order(t, A, T, F) {
  const v = F.steps.inputs.random16, C = F.controls.unsortedBinary.rows[13], items = [...beach(t), lab(A, "the same halving on a jumbled row", 20, 640, 300, INK.dim)];
  // Halving for 13 visits 7, 11, 13, 14, 15 (each too small, so it goes right) and reports it missing;
  // 13 is at place 1.
  const seen = [7, 11, 13, 14, 15], k = Math.floor(span(t, T.start + 1, T.jumbled) * (seen.length + 1)), key = v.indexOf(13);
  items.push(...row(v, 640, 520, 70, (i) => (k > seen.length && i === key ? "hot" : seen.slice(0, k).includes(i) ? "dark" : "paper")));
  items.push(lab(A, k > seen.length ? "looking for 13: reported missing; it was here" : `looking for 13: knocks ${Math.min(k, seen.length)}`, 22, 640, 620, k > seen.length ? INK.ember : INK.night));
  if (t >= T.jumbled) items.push(plate(620, 680, 1180, 120, 0.6), lab(A, `within ${C.maxComparisons} knocks, and ${C.wrong.toLocaleString("en")} of ${C.keys.toLocaleString("en")} missed in its best run`, 24, 660, 740, INK.night, "left", span(t, T.jumbled, T.jumbled + 0.8)));
  return scene(t, A, items);
}
// A sort's step trace: frames of the row of eight.
export function trace(A, frames, u, x0, y) {
  const k = Math.min(frames.length - 1, Math.floor(u * frames.length)), f = frames[k];
  return [...row(f.a, x0, y, 90, (i) => (i === f.i || i === f.j || i === f.mid ? "hot" : "paper"), 1, 7), lab(A, `comparisons: ${f.comparisons}`, 22, x0, y + 60, INK.night)];
}
// Three counts on a log bar scale.
export function bars(A, rows, x, y, u = 1) {
  const W = (c) => (Math.log10(Math.max(c, 1)) / 10) * 1000, out = [];
  rows.forEach(([n, c, hot, a], i) => out.push(lab(A, n, 20, x, y + i * 70, INK.dim, "left", a), { shape: rect(x, y + 12 + i * 70, W(c) * u, 26, 4), fill: hot ? [...EMBER, a] : [...PAPER, a], screen: true },
    lab(A, Math.round(c).toLocaleString("en"), 20, x + W(c) * u + 14, y + 32 + i * 70, INK.night, "left", a)));
  return out;
}
