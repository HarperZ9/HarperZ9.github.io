// Segment 2, "The wrong lesson" (shots 2.1 to 2.3). Another knot opens onto a shared pasture
// in plotter line-work, and grazing marks multiply on it while Hardin's line lands. Then the
// misreading: the field splits into fenced plots and a tower rises to watch over it, tagged in
// drift as the misconception. The fences fade and Hardin's own words land on the open field.
// The marks are a picture of the argument, not a count; the scene says so.
import { C, words, plotter, drawLens, contour, circle, span, window, ease, lerp, rng, trim } from "./world.mjs";

const CX = 960, CY = 430, RX = 430, RY = 230;

export function prepare(A) {
  const r = rng(1968);
  // The pasture: an irregular closed outline.
  const edge = [];
  for (let k = 0; k < 72; k++) { const a = (k / 72) * Math.PI * 2, w = 1 + 0.06 * Math.sin(a * 3 + 1) + 0.04 * Math.sin(a * 7); edge.push(CX + Math.cos(a) * RX * w, CY + Math.sin(a) * RY * w); }
  // Grazing marks: a small inverted v, scattered inside the field.
  const marks = [];
  while (marks.length < 72) {
    const x = CX + (r() * 2 - 1) * RX * 0.86, y = CY + (r() * 2 - 1) * RY * 0.82;
    if (((x - CX) / (RX * 0.9)) ** 2 + ((y - CY) / (RY * 0.86)) ** 2 > 1) continue;
    marks.push(contour(new Float32Array([x - 7, y + 4, x, y - 4, x + 7, y + 4]), false));
  }
  // Fences: two across, one down, as plotter lines; and a watchtower on the far edge.
  const fences = [plotter(CX - RX * 0.95, CY - RY * 0.33, RX * 1.9, r), plotter(CX - RX * 0.95, CY + RY * 0.33, RX * 1.9, r)];
  const down = []; for (let s = 0; s <= 20; s++) down.push(CX + (r() - 0.5) * 1.2, CY - RY * 0.95 + (s / 20) * RY * 1.9);
  fences.push(contour(new Float32Array(down), false));
  const tx = CX + RX * 0.78, ty = CY - RY * 1.02;
  const tower = [contour(new Float32Array([tx - 14, ty + 120, tx - 6, ty, tx + 6, ty, tx + 14, ty + 120]), false),
    contour(new Float32Array([tx - 22, ty, tx, ty - 22, tx + 22, ty]), true), ...circle(tx, ty - 6, 4, 12)];
  const t = (s, size, x, y, atlas = A.sans, anchor = "center") => words(s, atlas, size, x, y, anchor).shape;
  A.s2 = {
    edge: [contour(new Float32Array(edge), true)], marks, fences, tower,
    ruin: t("“Freedom in a commons brings ruin to all.”", 40, 960, 712),
    common: t("the common reading", 36, 900, 150, A.head, "right"),
    miscon: t("the misconception", 32, 930, 150, A.mono, "left"),
    mutual: t("“mutual coercion, mutually agreed upon”", 40, 960, 712),
    picture: t("a picture of the argument, not a count", 28, 960, 196, A.mono),
  };
}

// T: { open, freedom, misread, ruler, mutual, exit }
export function draw(t, A, T, items) {
  const S = A.s2;
  if (t < T.open - 0.6 || t > T.exit + 1.2) return;
  const o = span(t, T.open - 0.6, T.open + 0.6, ease.out) * (1 - span(t, T.exit, T.exit + 1.0, ease.inOut));
  drawLens(items, 960, 450, 660 * span(t, T.open - 0.6, T.open + 0.9, ease.out) * (1 - 0.95 * span(t, T.exit, T.exit + 1.0, ease.inOut)), o);
  const put = (shape, fill, a) => { if (a * o > 0.003) items.push({ shape, fill, opacity: a * o, screen: true }); };
  const line = (shape, stroke, a, width = 1.6) => { if (a * o > 0.003 && shape.length) items.push({ shape, stroke, width, opacity: a * o, screen: true }); };
  line(trim(S.edge, 0, span(t, T.open, T.open + 1.6, ease.out)), C.ink, 0.9);
  // The marks multiply from a few to many while the line is spoken.
  const n = Math.round(lerp(6, S.marks.length, span(t, T.freedom - 0.4, T.misread, ease.inOut)));
  line(S.marks.slice(0, n), C.ink2, span(t, T.open + 0.6, T.open + 1.4), 1.4);
  put(S.picture, C.dim, window(t, T.open + 1, T.misread, 0.6, 0.6));
  put(S.ruin, C.ink, window(t, T.freedom, T.misread + 0.4, 0.6, 0.6));
  // The misreading: fences split the field, then a tower watches over it.
  const fence = span(t, T.misread + 0.3, T.misread + 2.0, ease.inOut) * (1 - span(t, T.mutual - 0.2, T.mutual + 1.4, ease.inOut));
  line(trim(S.fences, 0, fence > 0 ? span(t, T.misread + 0.3, T.misread + 2.0, ease.inOut) : 0), C.ink, fence, 1.8);
  const tw = window(t, T.ruler, T.mutual + 0.6, 0.8, 1.2);
  line(S.tower, C.ink, tw, 1.8);
  const mis = window(t, T.misread, T.mutual, 0.6, 0.6);
  put(S.common, C.ink2, mis); put(S.miscon, C.hot, mis);
  put(S.mutual, C.ink, window(t, T.mutual + 0.2, T.exit + 0.4, 0.6, 0.6));
}
