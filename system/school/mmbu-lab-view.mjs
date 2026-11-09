// The S20 lab, drawn as a page of Tallow's logbook in the lamp room: the comparison's bar as a pencil
// line, the resampled means as a histogram that grows while the bootstrap runs, the interval inked
// under it, and the published line from the run records beside it. Pure in state.
import { rect, circle } from "../../media/school/shared/lib.mjs";
import { night, glazing } from "../../media/school/attention/scene/room.mjs";
import { host } from "../../media/school/embeddings/scene/segs.mjs";
import { lab, INK } from "../../media/school/nextword/scene/wheel.mjs";

const PAPER = [0.89, 0.84, 0.71], EMBER = [0.89, 0.58, 0.45], DARK = [0.16, 0.14, 0.12], PENCIL = [0.42, 0.4, 0.36];
const sign = (v, d) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`;

export function frame(s, A, t) {
  const items = [...night(t, { moon: false }), ...glazing(), { shape: rect(560, 90, 1260, 860, 8), fill: [...PAPER, 1], screen: true }];
  const c = s.comparison, x0 = 640, w = 1100, y0 = 640;
  items.push(lab(A, c ? c.title : "choose a comparison", 26, x0, 160, INK.ink));
  if (c) items.push(lab(A, c.what, 20, x0, 196, "#5d564b"));
  const r = s.run;
  if (c && r) {
    const lo = Math.min(c.axis[0], c.bar.above), hi = c.axis[1], X = (v) => x0 + ((v - lo) / (hi - lo)) * w;
    items.push({ shape: rect(x0, y0, w, 2), fill: [...PENCIL, 1], screen: true });
    for (const v of c.ticks) items.push({ shape: rect(X(v) - 1, y0, 2, 10), fill: [...PENCIL, 1], screen: true }, lab(A, String(v), 18, X(v), y0 + 34, "#5d564b", "center"));
    const bins = r.bins, top = Math.max(1, ...bins), bw = w / bins.length;
    bins.forEach((k, i) => { if (k) items.push({ shape: rect(x0 + i * bw, y0 - (k / top) * 330, Math.max(1, bw - 1), (k / top) * 330), fill: [...DARK, 0.75], screen: true }); });
    items.push({ shape: rect(X(c.bar.above) - 2, 250, 4, y0 - 250 + 20), fill: [...PENCIL, 1], screen: true },
      lab(A, c.bar.above === 0 ? "the bar: lower end above zero" : `the bar: lower end above ${c.bar.above}`, 18, X(c.bar.above) + 8, 262, "#5d564b"));
    if (r.result) {
      const R = r.result, met = R.lo > c.bar.above, col = met ? DARK : EMBER, y = y0 + 80;
      items.push({ shape: rect(X(R.lo), y - 5, X(R.hi) - X(R.lo), 10, 3), fill: [...col, 1], screen: true }, { shape: circle(X(R.mean), y, 10, 16), fill: [...col, 1], screen: true },
        lab(A, `ours: ${sign(R.mean, c.d)} [${R.lo.toFixed(c.d)}, ${R.hi.toFixed(c.d)}] from ${R.resamples.toLocaleString("en")} resamples`, 22, x0, y + 52, INK.ink),
        lab(A, `the logbook: ${sign(c.published[0], c.d)} [${c.published[1].toFixed(c.d)}, ${c.published[2].toFixed(c.d)}]`, 22, x0, y + 88, INK.ink));
      if (R.resamples === c.resamples) items.push(lab(A, R.equal ? "the same digits" : "different digits", 22, x0 + w, y + 88, R.equal ? INK.ink : "#a8502e", "right"));
    }
  } else items.push(lab(A, "press Redo the interval", 24, x0, 400, INK.ink));
  return { background: [0.012, 0.011, 0.014], camera: { x: 960, y: 540, zoom: 1 }, items: [...items, ...host(t, A)], post: { bloom: 0.1, threshold: 1, vignette: 0.3, grain: 0.03, passes: [] } };
}
