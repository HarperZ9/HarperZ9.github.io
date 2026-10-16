// The denoiser film's segments (lesson K25) at the tide line (PROGRESS.md, step 72): a patch of image
// as tiles on the wet sand with one glint, two gauges with the bound as a fixed slot, and the readings
// of the parity check. Every value drawn is a facts.json value (F); timings from the cue map (T).
import { rect, polyline, label, C } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, thePrism, span } from "../../errorbars/scene/tide.mjs";

const EMBER = [0.89, 0.58, 0.45], SLATE = [0.7, 0.82, 0.95];
// The patch of image: 9 x 9 tiles, the centre one the glint (g: its brightness, 0 to 1).
export function patch(x, y, g = 1, a = 1, c = 34) {
  const out = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const hot = i === 4 && j === 4, v = 0.22 + 0.08 * Math.sin(i * 1.7 + j * 0.9);
    out.push(hot ? { shape: rect(x + j * c, y + i * c, c - 2, c - 2, 2), fill: [0.22 + 0.78 * g, 0.2 + 0.75 * g, 0.18 + 0.62 * g, a], blend: g > 0.5 ? "add" : undefined }
      : { shape: rect(x + j * c, y + i * c, c - 2, c - 2, 2), fill: [v, v * 0.9, v * 0.8, a] }); }
  return out;
}
// A gauge from 0 to top (absolute difference), the bound as a fixed slot; v: the reading, u: needle travel.
export function gauge(A, x, y, w, name, v, u, top, bound, col, a = 1) {
  const X = (e) => x + (Math.min(e, top) / top) * w;
  return [{ shape: rect(x, y, w, 8, 3), fill: [0.3, 0.27, 0.24, a], screen: true }, { shape: rect(x, y - 14, X(bound) - x, 36, 3), fill: [...SLATE, 0.3 * a], screen: true },
    { shape: rect(X(v * u) - 3, y - 24, 6, 56), fill: [...col, a * Math.min(1, u * 4)], screen: true }, lab(A, name, 22, x, y - 34, INK.night, "left", a),
    lab(A, u >= 1 ? v.toFixed(4) : "", 22, X(v) + 12, y + 10, INK.night, "left", a)];
}
const scale = (A, x, y, w, top, a) => [0, top / 2, top].map((e) => lab(A, String(e), 18, x + (e / top) * w, y + 50, INK.dim, "center", a));
export function open(t, A, T, F) { return scene(t, A, [...beach(t), ...patch(760, 300, span(t, 0.5, 2.5)), ...thePrism(span(t, 2, 3.5))]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...patch(760, 300, 0.6, 0.4), label(A, "The denoiser's tensor-core parity", 80, 960, 160, C.ink, "center", a, "head")]);
}
// Two paths, one check: the bound appears, then the readings.
export function parity(t, A, T, F) {
  const R = F.primary.rtx, b = F.recipe.bound, top = 0.12, items = [...beach(t), plate(560, 200, 1260, 520, 0.6)];
  items.push(lab(A, `the parity check: no value may differ by more than ${b}`, 22, 620, 260, INK.dim, "left", span(t, T.rule, T.rule + 0.8)));
  items.push(...gauge(A, 620, 400, 1100, "32-bit throughout", R.scalar.max_abs, span(t, T.read, T.read + 1.5), top, b, INK.paper.slice(0, 3), span(t, T.start, T.start + 1)));
  items.push(...gauge(A, 620, 580, 1100, "tensor cores: 16-bit inputs and weights, 32-bit sums", R.coop.max_abs, span(t, T.coop, T.coop + 2), top, b, EMBER, span(t, T.start, T.start + 1)), ...scale(A, 620, 580, 1100, top, span(t, T.start, T.start + 1)));
  if (t >= T.coop) items.push(lab(A, `RTX 4090, ${R.frames} frames: worst at frame ${R.coop.max_at_frame}`, 20, 620, 690, INK.dim, "left", span(t, T.coop + 1, T.coop + 2)));
  return scene(t, A, items);
}
// A few places: mean, 99.99th percentile and max on a log axis with the bound.
export function rare(t, A, T, F) {
  const R = F.primary.rtx.coop, X = (e) => 640 + ((Math.log10(e) + 7) / 7) * 1100, items = [...beach(t), plate(560, 220, 1260, 480, 0.6)];
  items.push({ shape: rect(640, 520, 1100, 4), fill: [0.6, 0.55, 0.45, 1], screen: true }, { shape: rect(X(F.recipe.bound) - 3, 360, 6, 200), fill: [...SLATE, 1], screen: true }, lab(A, "the bound", 20, X(F.recipe.bound), 345, INK.night, "center"));
  for (let k = -7; k <= 0; k++) items.push(lab(A, `1e${k}`, 18, X(10 ** k), 560, INK.dim, "center"));
  [["average", R.mean_abs, T.start + 0.5], ["99.99 percent under", R.p99_99_abs_upper, T.p99], ["worst", R.max_abs, T.worst]].forEach(([n, v, at], i) => { const a = span(t, at, at + 0.8);
    items.push({ shape: rect(X(v) - 4, 470 - i * 4, 8, 50), fill: i === 2 ? [...EMBER, a] : [0.9, 0.86, 0.75, a], screen: true }, lab(A, `${n}: ${v.toExponential(1)}`, 20, X(v), 440 - i * 40, i === 2 ? INK.ember : INK.night, "center", a)); });
  items.push(lab(A, `${R.values.toLocaleString("en")} values, tensor-core path, log scale`, 20, 640, 280, INK.dim));
  return scene(t, A, items);
}
// Reproduce before fixing: the chip and three emulations on the same gauge scale.
export function reproduce(t, A, T, F) {
  const P = F.primary, b = F.recipe.bound, top = 0.15, items = [...beach(t), plate(560, 180, 1260, 600, 0.6)];
  const rows = [["the RTX 4090", P.rtx.coop.max_abs, T.start + 0.5, EMBER], ["emulation, 16-bit inputs and weights", P.emulation.WA.max_abs, T.emu, EMBER], ["emulation, 16-bit weights only", P.emulation.W.max_abs, T.split, [0.9, 0.86, 0.75]], ["emulation, 16-bit inputs only", P.emulation.A.max_abs, T.split + 1.5, [0.9, 0.86, 0.75]]];
  rows.forEach(([n, v, at, col], i) => items.push(...gauge(A, 620, 300 + i * 120, 1100, n, v, span(t, at, at + 1.2), top, b, col, span(t, at - 0.5, at))));
  if (t >= T.emu) items.push(lab(A, `same frame (${P.emulation.WA.worst[0].frame}) and pixel (${P.emulation.WA.worst[0].pixel.toLocaleString("en")}) as the chip`, 20, 620, 740, INK.dim, "left", span(t, T.emu + 1, T.emu + 2)));
  return scene(t, A, items);
}
// The glint: the patch, then the chain of numbers from the note.
export function glint(t, A, T, F) {
  const N = F.recipe.noteCase, items = [...beach(t), ...patch(560, 260, 1)];
  const steps = [[`one sample: ${N.fireflyRadiance.toLocaleString("en")}`, T.start + 1], [`neighbours: about ${N.neighbourRadiance}`, T.start + 2], [`divided by ${N.specularAlbedo} + ${N.eps}: about 21,700`, T.divide], ["after the 5 x 5 filter: about 105 (reference 110)", T.filter]];
  steps.forEach(([s, at], i) => { const a = span(t, at, at + 0.8);
    items.push(lab(A, s, 26, 1000, 320 + i * 90, i === 2 ? INK.ember : INK.night, "left", a));
    if (i > 0) items.push({ shape: polyline([980, 290 + i * 90, 980, 300 + i * 90]), fill: null, stroke: [0.6, 0.55, 0.45, a], width: 2, screen: true }); });
  return scene(t, A, items);
}
