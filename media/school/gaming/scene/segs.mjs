// The gaming film's segments (lesson E24) at the tide line (PROGRESS.md, step 46): each answer is a
// shell, the checker a gate that looks only at what it pays for, and Rerun's tap the true answer.
// The two curves (points paid, answers right) go on a tide board. Every value drawn is a facts.json
// value (F); timings from the cue map in film.scene.mjs (T).
import { rect, circle, polyline, words, label, C } from "../../shared/lib.mjs";
import { INK, lab, plate, beach, scene, thePrism, span } from "../../errorbars/scene/tide.mjs";

const GATE = { x: 980, y: 560 };
// Word cards in a row, from x; hot(i) marks a card in ember.
export function cards(A, list, x, y, a = 1, hot = () => false, size = 26) {
  const out = [];
  let cx = x;
  list.forEach((w, i) => { const wd = w.length * size * 0.56 + 24;
    out.push({ shape: rect(cx, y - size, wd - 6, size + 14, 3), fill: hot(i) ? [0.89, 0.58, 0.45, a] : [0.89, 0.84, 0.71, a], stroke: "#2a2219", width: 1, screen: true },
      { shape: words(w, A.sans, size, cx + (wd - 6) / 2, y + 2, "center"), fill: "#1d1812", opacity: a, screen: true }); cx += wd; });
  return out;
}
// The gate: a post and a sign naming what it pays for.
export function gate(A, sign, a = 1) {
  const w = Math.max(200, sign.length * 13.5 + 48);
  return [{ shape: rect(GATE.x - 10, GATE.y - 260, 20, 280), fill: [0.45, 0.4, 0.35, a] }, { shape: rect(GATE.x - w / 2, GATE.y - 334, w, 70, 6), fill: [0.89, 0.84, 0.71, a], stroke: "#2a2219", width: 2 },
    { shape: words(sign, A.mono, 24, GATE.x, GATE.y - 290, "center"), fill: "#1d1812", opacity: a }];
}
// Shells rolling through the gate; crumble(i) in 0..1 for the ones the tap breaks.
export function shells(t, n, crumble = () => 0, a = 1) {
  const out = [];
  for (let i = 0; i < n; i++) { const x = 300 + ((i * 160 + t * 60) % 1500), c = x > GATE.x + 60 ? crumble(i) : 0;
    out.push({ shape: circle(x, 760 + 30 * c, 30 * (1 - 0.4 * c), 24), fill: [0.95, 0.85, 0.65, a * (1 - 0.7 * c)], stroke: "#2a2219", width: 2 }); }
  return out;
}
// The tide board: each seed's points (ink) and answers right (ember) over the steps.
export function board(A, runs, { x = 640, y = 140, w = 1200, h = 560, a = 1, right = 1, steps = 800, title = "", runA = a } = {}) {
  const X = (s) => x + 60 + (s / steps) * (w - 100), Y = (v) => y + h - 50 - v * (h - 120), out = [{ shape: rect(x, y, w, h, 8), fill: [0.9, 0.85, 0.72, a], stroke: "#3a2c1c", width: 4 }];
  for (const v of [0, 0.5, 1]) out.push({ shape: rect(x + 60, Y(v), w - 100, 1), fill: [0.3, 0.25, 0.2, 0.3 * a] }, { shape: words(`${v * 100}%`, A.mono, 16, x + 14, Y(v) + 6), fill: "#3a2c1c", opacity: a });
  runs.forEach((run) => {
    out.push({ shape: polyline(run.flatMap((p) => [X(p.step), Y(p.reward)])), fill: null, stroke: [0.11, 0.09, 0.07, 0.8 * runA], width: 4 });
    const k = Math.max(2, Math.round(run.length * right));
    if (right > 0) out.push({ shape: polyline(run.slice(0, k).flatMap((p) => [X(p.step), Y(p.correct)])), fill: null, stroke: [0.65, 0.27, 0.16, runA], width: 4 });
  });
  out.push({ shape: words(title, A.mono, 20, x + 60, y + 40), fill: "#1d1812", opacity: a }, { shape: words("ink: points paid; rust: answers right; one line per run", A.mono, 16, x + 60, y + h - 14), fill: "#3a2c1c", opacity: a });
  return out;
}

export function open(t, A, T, F) {
  const lit = span(t, 0.8, 1.8);
  return scene(t, A, [...beach(t), ...gate(A, "", lit), ...shells(t, 8, (i) => (i % 3 === 1 ? span(t, 2.5, 3.5) : 0), lit)]);
}
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...gate(A, "", 0.6), ...shells(t, 8, () => 0, 0.6), label(A, "When the check can be fooled", 80, 960, 120, C.ink, "center", a, "head")]);
}
// Who did it: one prompt as cards, the truth under it, the start score.
export function task(t, A, T, F) {
  const ex = F.task.examples[0], items = [...beach(t), plate(260, 220, 1600, 380, 0.6), ...cards(A, ex.words, 300, 320, span(t, T.start, T.start + 1))];
  if (t >= T.truth) items.push(lab(A, `the rules' answer: ${ex.truth}`, 26, 300, 420, INK.ember, "left", span(t, T.truth, T.truth + 0.8)));
  if (t >= T.decoy) items.push(lab(A, `first name in the text is the wrong guide: ${Math.round(F.task.decoyShare * 100)}% of questions`, 24, 300, 480, INK.night, "left", span(t, T.decoy, T.decoy + 0.8)));
  if (t >= T.begin) items.push(lab(A, `right at the start: ${Math.round(F.task.startCorrect.step200 * 100)}%`, 26, 300, 550, INK.night, "left", span(t, T.begin, T.begin + 0.8)));
  return scene(t, A, items);
}
export function checker(t, A, T, F) {
  const a = span(t, T.gate, T.gate + 1), items = [...beach(t), ...gate(A, "+1 if the answer contains the right name", a), ...shells(t, 8, () => 0, a)];
  if (t >= T.loop) items.push(plate(260, 120, 1400, 110, 0.6), lab(A, "answers that beat the batch average: a little more likely", 24, 300, 185, INK.night, "left", span(t, T.loop, T.loop + 0.8)));
  return scene(t, A, items);
}
