// The evaluation lab, drawn at Rerun's tide line: the latest checkpoint's three score bands from the
// prism with their intervals, the loss beside them, and a small column of every checkpoint scored so
// far. Pure in state.
import { lab, plate, beach, scene, thePrism, INK } from "../../media/school/errorbars/scene/tide.mjs";
import { bands } from "../../media/school/evaluate/scene/segs.mjs";

export function frame(s, A, t) {
  const m = s.marks.at(-1), items = [...beach(t), ...thePrism(m ? 1 : 0.4)];
  if (m) items.push(...bands(A, m, 1, { x0: 1000, w: 760 }), lab(A, `step ${m.step}: loss ${m.loss.mean.toFixed(2)} [${m.loss.lo.toFixed(2)}, ${m.loss.hi.toFixed(2)}]`, 24, 120, 380));
  else items.push(lab(A, s.running ? `training: step ${s.step}` : "press Train and score", 26, 120, 380));
  if (s.marks.length > 1) {
    items.push(plate(100, 600, 760, 60 + s.marks.length * 40, 0.6));
    s.marks.forEach((k, i) => items.push(lab(A, `step ${k.step}: exact ${Math.round(k.exact.mean * 100)}%, perfect ${Math.round(k.perfect.mean * 100)}%, cheap ${Math.round(k.fluent.mean * 100)}%`, 20, 130, 640 + i * 40, INK.night)));
  }
  return { background: [0.012, 0.011, 0.014], ...scene(t, A, items), post: { bloom: 0.15, threshold: 1, vignette: 0.3, grain: 0.04, passes: [] } };
}
