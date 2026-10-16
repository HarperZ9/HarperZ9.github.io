// The evaluation film's segments (lesson L16) at Rerun's tide line (PROGRESS.md, step 53): one model
// enters the prism and leaves as three score bands (exact match, the perfect judge, the cheap judge),
// with the loss on its own scale. Every value drawn is a facts.json value (F); timings from the cue
// map in film.scene.mjs (T).
import { rect, circle, polyline, label, C, SPECTRUM } from "../../shared/lib.mjs";
import { INK, PRISM, lab, plate, beach, scene, thePrism, span } from "../../errorbars/scene/tide.mjs";

const BANDS = [["exact match", "exact", 2], ["the perfect judge", "perfect", 4], ["the cheap judge", "fluent", 0]];
// A checkpoint averaged over the three training runs (the narration quotes these means); the small
// ember bar under each band spans the three runs, lowest to highest.
export function at(F, step) {
  const r = F.checkpoints.across[String(step)], one = (k) => ({ mean: r[k].mean, lo: Math.min(...r[k].values), hi: Math.max(...r[k].values) });
  return { step, loss: one("loss"), exact: one("exact"), perfect: one("perfect"), fluent: one("fluent") };
}
// Three bands from the prism for one checkpoint, grown to share u; hide(k) keeps a band back.
export function bands(A, c, u, { hide = () => false, y0 = 300, x0 = 1000, w = 760 } = {}) {
  const out = [];
  BANDS.forEach(([name, key, s], i) => {
    if (hide(i)) return;
    const y = y0 + i * 170, v = c[key].mean, col = SPECTRUM[s];
    out.push({ shape: polyline([PRISM.x + 70, PRISM.y + 10, x0, y + 16]), fill: null, stroke: [...col, 0.55 * u], width: 4, blend: "add" },
      { shape: rect(x0, y, w * v * u, 32, 4), fill: [0.9, 0.86, 0.75, u], screen: true }, { shape: rect(x0 + w * c[key].lo, y + 40, w * (c[key].hi - c[key].lo), 5, 2), fill: [0.89, 0.58, 0.45, u], screen: true },
      lab(A, name, 22, x0, y - 12, INK.night, "left", u), lab(A, `${Math.round(v * 100)}%`, 24, x0 + w * v * u + 14, y + 26, INK.night, "left", u));
  });
  return out;
}
const beam = (A, text) => [{ shape: polyline([120, PRISM.y, PRISM.x - 60, PRISM.y]), fill: null, stroke: [1, 0.95, 0.85, 0.9], width: 6 }, lab(A, text, 24, 130, PRISM.y - 30)];
const lossTag = (A, c, a) => lab(A, `loss ${c.loss.mean.toFixed(2)} (runs ${c.loss.lo.toFixed(2)} to ${c.loss.hi.toFixed(2)})`, 24, 130, PRISM.y + 70, INK.dim, "left", a);

export function open(t, A, T, F) { return scene(t, A, [...beach(t), ...thePrism(span(t, 0.8, 1.8)), ...bands(A, at(F, 2000), span(t, 1.5, 3.5))]); }
export function title(t, A, T, F) {
  const a = Math.min(span(t, T.say, T.say + 0.6), 1 - span(t, T.end - 0.8, T.end));
  return scene(t, A, [...beach(t), ...thePrism(0.6), label(A, "Evaluating a language model", 80, 960, 120, C.ink, "center", a, "head")]);
}
// Three instruments: the loss scale, the exact-match tally, the judge's stamp.
export function three(t, A, T, F) {
  const items = [...beach(t), ...thePrism(0.4)], c = at(F, 2000), show = (t0) => span(t, t0, t0 + 0.8);
  const card = (x, name, value, a, round = false) => [round ? { shape: circle(x + 120, 470, 130, 40), fill: [0.65, 0.27, 0.16, a], screen: true } : { shape: rect(x, 320, 240, 300, 8), fill: [0.9, 0.86, 0.75, a], screen: true },
    lab(A, name, 24, x + 120, 380, round ? INK.night : "#1d1812", "center", a), lab(A, value, 36, x + 120, 500, round ? INK.night : "#1d1812", "center", a)];
  items.push(...card(820, "loss", c.loss.mean.toFixed(2), show(T.start)), ...card(1120, "exact match", `${Math.round(c.exact.mean * 100)}%`, show(T.exact)), ...card(1420, "judge", `${Math.round(c.perfect.mean * 100)}%`, show(T.judge), true));
  items.push(lab(A, `one model, trained ${F.recipe.steps.toLocaleString("en")} steps, scored three ways`, 22, 820, 700, INK.dim, "left", show(T.start)));
  return scene(t, A, items);
}
// Learning: the bands at step 200, the cheap judge held back for the question, then step 2,000.
export function curve(t, A, T, F) {
  const late = t >= T.late, c = at(F, late ? 2000 : 200), u = span(t, late ? T.late : T.early, (late ? T.late : T.early) + 1.5);
  const items = [...beach(t), ...thePrism(1), ...beam(A, `three runs at step ${c.step.toLocaleString("en")}`), lossTag(A, c, u)];
  items.push(...bands(A, c, u, { hide: (i) => !late && i === 2 && t < T.ask.held }));
  return scene(t, A, items);
}
// Two judges at step 200: the perfect judge, the cheap one, and what the cheap one lets through.
export function judges(t, A, T, F) {
  const c = at(F, 200), items = [...beach(t), ...thePrism(0.8), ...beam(A, "three runs at step 200"), ...bands(A, c, span(t, T.start, T.start + 1), { hide: (i) => i === 0 || (i === 2 && t < T.cheap) })];
  if (t >= T.lets) { const J = F.judges.perSeed["1"]["200"], a = span(t, T.lets, T.lets + 0.8);
    items.push(plate(980, 820, 880, 90, 0.7 * a), lab(A, `of what the perfect judge rejects, the cheap judge accepts ${Math.round(J.falseAccept * 100)}% (first run)`, 22, 1010, 875, INK.ember, "left", a)); }
  const ex = F.film.fooled[0];
  if (t >= T.lets) items.push(lab(A, `"${ex.prompt.join(" ")} ${ex.early.words.join(" ")}"`, 20, 130, 720, INK.dim, "left", span(t, T.lets + 2, T.lets + 3)), lab(A, `cheap judge: ${ex.early.fluent ? "pass" : "fail"}; perfect judge: ${ex.early.perfect ? "pass" : "fail"}`, 20, 130, 760, INK.ember, "left", span(t, T.lets + 2, T.lets + 3)));
  return scene(t, A, items);
}
