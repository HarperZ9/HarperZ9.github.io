// The close, "Two things to keep" (storyboard fix 10): the aperture. The 636 references
// of segment 2 return as a corona around a void: the real ones bright in the outer band,
// the 197 that did not exist (55% of GPT-3.5's 222 and 18% of GPT-4's 414, segment 2's
// own dots) as a dark inner ring. The first thing to keep sits in the void; the second
// is written along the rim. One spectral flare on the rim is the art's one hot mark.
import { contour, circle } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, window, ease, rng } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";
import { C } from "./lib.mjs";

// The ring sits high and a little smaller, so the line along its rim stays above the captions.
const CX = 960, CY = 400, R0 = 240, R1 = 290, RIM = 300;
const SPECTRUM = ["#ff5a5a", "#ffb347", "#f6f06a", "#6ee7a8", "#5ab8ff", "#9b7bff"];   // art layer only

// Bend a glyph run (laid on y = 0 from x = 0) along an arc, left to right across the bottom.
function onArc(t, r, a0, a1) {
  const L = r * Math.abs(a1 - a0), k = (a0 - a1) / L, out = [];
  const start = (L - t.width) / 2;
  for (const c of t.shape) {
    const p = c.pts, o = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 2) {
      const a = a0 - (p[i] + start) * k, rr = r + p[i + 1];   // glyph y < 0 is above the baseline: toward the centre
      o[i] = CX + Math.cos(a) * rr; o[i + 1] = CY + Math.sin(a) * rr;
    }
    out.push(contour(o, c.closed));
  }
  return out;
}

export function prepare(A) {
  const t = (s, size, y, atlas = A.head) => text(s, { atlas, size, x: CX, y, anchor: "center" }).shape;
  const r = rng(636), real = [], fab = [];
  let n = 0;
  A.groups.forEach((g) => g.kind.forEach((k) => {
    const a = (n++ / 636) * Math.PI * 2 + (r() - 0.5) * 0.004;
    if (k === 1) { const rr = R0 + 6 + r() * 12; fab.push([CX + Math.cos(a) * rr, CY + Math.sin(a) * rr]); }
    else { const rr = R0 + 34 + r() * (R1 - R0 - 34); real.push([CX + Math.cos(a) * rr, CY + Math.sin(a) * rr]); }
  }));
  const rim = text("The cheapest check ships with the claim.", { atlas: A.head, size: 36, x: 0, y: 0 });
  A.s6 = {
    real, fab,
    keep: t("Two things to keep.", 34, 48, A.sans),
    oneA: t("How a claim looks says nothing", 32, CY - 4),
    oneB: t("about whether it holds.", 32, CY + 38),
    rim: onArc(rim, RIM + 52, Math.PI * 0.86, Math.PI * 0.14),
    flare: SPECTRUM.map((_, k) => { const a = -Math.PI * 0.33 + (k - 2.5) * 0.012; return [contour(new Float32Array([CX + Math.cos(a) * (R1 - 6), CY + Math.sin(a) * (R1 - 6), CX + Math.cos(a) * (R1 + 34), CY + Math.sin(a) * (R1 + 34)]), false)]; }),
    voice: t("The voice is a synthesized version of the author's.", 26, 46, A.sans),
    sources: t("Every number on screen links to its source under the video.", 26, 82, A.sans),
  };
}

export function draw(t, A, T, items) {
  const S = A.s6;
  const vis = window(t, T.enter, T.end + 1, 0.8, 1.4);
  if (vis <= 0) return;
  const out = 1 - span(t, T.end - 1.4, T.end, ease.inOut);
  const put = (shape, fill, o) => { if (o > 0) items.push({ shape, fill, opacity: o * vis * out, screen: true }); };
  // The corona gathers: each dot fades in with its angle, so the ring closes like an aperture.
  const gather = span(t, T.enter - 0.2, T.enter + 2.6, ease.out), dots = [], dark = [];
  S.real.forEach(([x, y], i) => { if (gather > i / S.real.length) dots.push(...circle(x, y, 3.4, 10)); });
  // The references that did not exist: hollow, as segment 2 drew them.
  S.fab.forEach(([x, y], i) => { if (gather > i / S.fab.length) dark.push(...circle(x, y, 3.2, 12)); });
  put(dots, C.ink, 0.85);
  if (dark.length) items.push({ shape: dark, stroke: C.dim, width: 1.2, opacity: 0.9 * vis * out, screen: true });
  // The void: a soft plate in the ground colour so the threads stay outside the aperture.
  items.push({ shape: circle(CX, CY, R0 - 4, 96), fill: C.void, opacity: 0.94 * vis * out * gather, blur: 18, screen: true });
  put(S.keep, C.ink2, span(t, T.enter, T.enter + 0.8) * (1 - span(t, T.voice - 0.7, T.voice - 0.1)));
  const one = window(t, T.one, T.end + 1, 0.8, 0.01);
  put(S.oneA, C.ink, one); put(S.oneB, C.ink, one);
  put(S.rim, C.ink, span(t, T.two + 0.3, T.two + 1.6));
  const fl = span(t, T.two + 1.2, T.two + 2.2);
  if (fl > 0) S.flare.forEach((sh, k) => items.push({ shape: sh, stroke: SPECTRUM[k], width: 2.2, opacity: fl * vis * out, blend: "add", screen: true }));
  put(S.voice, C.ink2, span(t, T.voice, T.voice + 0.8) * 0.85);
  put(S.sources, C.ink2, span(t, T.sources, T.sources + 0.8) * 0.85);
}
