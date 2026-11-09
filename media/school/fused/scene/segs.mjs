// The fused-attention film's segments (lesson K23) in Pylon's cannery (PROGRESS.md, step 65): the
// wall of score cans the plain way builds in the warehouse, the running largest and running total
// over the probe row's tiles (the model's real scores), and the crew working from one bench. Every
// value drawn is a facts.json value (F); timings from the cue map in film.scene.mjs (T).
import { rect, circle, polyline, span, label, C } from "../../shared/lib.mjs";
import { INK, CREW, lab, plate, floor, scene } from "../../threads/scene/cannery.mjs";

// The warehouse wall: u in 0..1 of a 16 x 16 wall of score cans.
export function wall(u, a = 1, x0 = 160, y0 = 160) {
  const out = [], n = Math.floor(u * 256);
  for (let k = 0; k < n; k++) out.push({ shape: rect(x0 + (k % 16) * 40, y0 + Math.floor(k / 16) * 36, 34, 30, 3), fill: [0.85, 0.8, 0.7, a] });
  return out;
}
// The bench with a crew and one tile on it.
export function bench(a = 1, x = 1060, y = 320) {
  const out = [{ shape: rect(x, y, 380, 180, 8), fill: [0.35, 0.28, 0.2, a], stroke: "#0b0a0c", width: 3 }];
  for (let k = 0; k < 16; k++) out.push({ shape: rect(x + 20 + (k % 8) * 44, y + 20 + Math.floor(k / 8) * 74, 36, 54, 3), fill: [0.89, 0.58, 0.45, a] });
  for (let w = 0; w < 8; w++) out.push({ shape: circle(x + 40 + w * 44, y + 230, 13, 16), fill: [...CREW[0], a], stroke: "#0b0a0c", width: 2 });
  return out;
}
// A dial for the running largest score and a bar for the running total.
export function gauges(A, m, l, { x = 1560, y = 320, mMax = 3, lMax = 4, a = 1 } = {}) {
  const ang = -2.4 + 2.8 * Math.min(1, Math.max(0, (m + 5) / (mMax + 5)));
  return [{ shape: circle(x, y + 70, 80, 40), fill: [0.15, 0.13, 0.11, a], stroke: "#b8892e", width: 4 }, { shape: polyline([x, y + 70, x + Math.cos(ang) * 70, y + 70 + Math.sin(ang) * 70]), fill: null, stroke: [0.89, 0.58, 0.45, a], width: 5 },
    lab(A, `running largest ${m.toFixed(2)}`, 20, x, y + 190, INK.night, "center", a), { shape: rect(x - 120, y + 220, 240, 24, 4), fill: [0.3, 0.27, 0.24, a] }, { shape: rect(x - 120, y + 220, 240 * Math.min(1, l / lMax), 24, 4), fill: [0.9, 0.86, 0.75, a] },
    lab(A, `running total ${l.toFixed(2)}`, 20, x, y + 276, INK.night, "center", a)];
}

export function open(t, A, T, F) { return scene(t, A, [...floor(), ...wall(span(t, 0.5, 3.5)), ...bench(span(t, 1, 2))]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...floor(), ...wall(1, 0.35), ...bench(0.35), label(A, "Fused attention", 92, 960, 120, C.ink, "center", a, "head")]);
}
// The table of scores: the plain way builds the wall in three passes.
export function table(t, A, T, F) {
  const u = span(t, T.write, T.write + 3), items = [...floor(), ...wall(1, 0.12 * span(t, T.start, T.start + 1)), ...wall(u)];
  items.push(lab(A, "the plain way: one table of scores per head", 22, 160, 130, INK.dim, "left", span(t, T.start, T.start + 1)));
  const steps = [["write the scores", T.write], ["read them, write the shares", T.shares], ["read the shares to mix", T.mix]];
  steps.forEach(([s, at], i) => { if (t >= at) items.push(lab(A, `${i + 1}. ${s}`, 24, 900, 300 + i * 60, INK.night, "left", span(t, at, at + 0.8))); });
  if (t >= T.size) items.push(lab(A, `${F.film.bars.d64.unfused[6].N.toLocaleString("en")} words: one head's scores, ${(F.film.scoreBuffer[6].bytes / 1048576).toFixed(0)} mebibytes`, 24, 900, 520, INK.ember, "left", span(t, T.size, T.size + 0.8)));
  return scene(t, A, items);
}
// Shares without the whole row: the probe row's tiles go by; the dial and the total follow the trace.
export function online(t, A, T, F) {
  const h = F.film.sweep.heads[1], k = Math.min(h.trace.length - 1, Math.floor(span(t, T.running, T.running + 9) * h.trace.length)), tr = h.trace[k], items = [...floor()];
  const words = F.film.table.words;
  words.forEach((w, i) => { const lit = i >= tr.keys[0] && i <= tr.keys[1]; items.push({ shape: rect(160 + i * 110, 300, 100, 60, 4), fill: lit ? [0.89, 0.58, 0.45, 1] : [0.85, 0.8, 0.7, 0.6], screen: true }, lab(A, w, 20, 210 + i * 110, 340, "#1d1812", "center")); });
  items.push(lab(A, `layer ${h.layer + 1}, head ${h.head + 1}, the last word's row: tile ${k + 1} of ${h.trace.length}`, 22, 160, 260, INK.dim), ...gauges(A, tr.m, tr.l, { x: 960, y: 460, a: span(t, T.running, T.running + 1) }));
  if (t >= T.check) items.push(lab(A, "tile by tile and the plain way: both within float32 of the exact answer, all four heads", 22, 160, 900, INK.night, "left", span(t, T.check, T.check + 0.8)));
  return scene(t, A, items);
}
