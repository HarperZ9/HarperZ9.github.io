// The gaming lab, drawn at Rerun's tide line: the reader's checker as a gate, the run's points and
// right answers on the tide board over the film's runs for the same checker (faint), and the
// answers the model writes now, as word cards. Pure in state.
import { lab, plate, beach, scene, INK } from "../../media/school/errorbars/scene/tide.mjs";
import { board, cards } from "../../media/school/gaming/scene/segs.mjs";

export function frame(s, A, t) {
  const items = [...beach(t), ...board(A, s.film, { x: 640, y: 80, w: 1220, h: 480, runA: 0.25, steps: 800, title: s.sign })];
  // The reader's run: the two lines of a board drawn for it alone (its last four items are the
  // points line, the right-answers line, the title and the key).
  if (s.curve.length > 1) items.push(...board(A, [s.curve], { x: 640, y: 80, w: 1220, h: 480, steps: 800, title: s.sign }).slice(-4, -2));
  const last = s.curve.at(-1);
  items.push(plate(640, 590, 1220, 230, 0.6), lab(A, last ? `step ${last.step}: points ${Math.round(last.reward * 100)}%, right ${Math.round(last.correct * 100)}%` : "choose a checker and press Train", 24, 680, 640, INK.night));
  s.examples.slice(0, 2).forEach((e, i) => items.push(lab(A, `the rules: ${e.truth}`, 22, 680, 710 + i * 60, INK.dim), ...cards(A, e.words, 820, 716 + i * 60, 1, () => false, 22)));
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.12, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
