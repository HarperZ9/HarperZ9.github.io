// Shared vocabulary for the attention film's scene: the engine imports, cue times from
// timing.json, the palette, and small drawing helpers. Pure; runs in Node for tests.
export { rect, circle, polyline, line, contour, trim, translate, scaleAbout, rotateAbout } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";
export { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
export { span, window, ease, lerp, lerpLog, rng, track, stagger } from "../../../raw-native/tree-c6b114d/web/motion/timeline.mjs";
export { pose, lin, rad, ellipse } from "../../../raw-native/tree-c6b114d/templates/guides/rig.mjs";
export { GUIDES } from "../../../raw-native/tree-c6b114d/templates/guides/guides.mjs";
export { LOOKS, darkness, glow } from "../../../raw-native/tree-c6b114d/templates/guides/look.mjs";
export { clipBeat } from "../../../raw-native/tree-c6b114d/templates/guides/motion.mjs";
import { text } from "../../../raw-native/tree-c6b114d/web/motion/text.mjs";
import { rect } from "../../../raw-native/tree-c6b114d/web/motion/path.mjs";

// Ink on the dark (the thriller look's own), the one hot mark (the query, ember), and the
// spectrum, used only at the prism's exit edge.
export const C = { void: [0.012, 0.011, 0.014], ink: "#ece5d6", dim: "#958e80", faint: "#5d574e", paper: "#ddd0b0", card: "#cbbd9c",
  hot: "#e29472", warm: [1, 0.78, 0.45], brass: "#8a6a32", glass: [0.6, 0.7, 0.8], cool: [0.55, 0.85, 1] };
// Detail knob for live playback: the Canvas 2D fallback draws fewer threads (1 is the film's own).
export const QUALITY = { threads: 1 };
export const SPECTRUM = [[1, 0.25, 0.2], [1, 0.6, 0.15], [0.95, 0.95, 0.3], [0.3, 0.95, 0.5], [0.25, 0.7, 1], [0.6, 0.35, 1]];

// Cue times from timing.json rows ({segment, line, sentence, start, end, text, predict?}).
export function cues(timing) {
  const list = Array.isArray(timing) ? timing : timing.rows;
  const rows = new Map(list.filter((r) => r.predict === undefined).map((r) => [`${r.segment}.${r.line}.${r.sentence ?? 0}`, r]));
  const row = (s, l, k = 0) => { const r = rows.get(`${s}.${l}.${k}`); if (!r) throw new Error(`no sentence ${s}.${l}.${k}`); return r; };
  return {
    at: (s, l, k = 0) => row(s, l, k).start,
    end: (s, l, k = 0) => row(s, l, k).end,
    // When the voice reaches a phrase, estimated from its place in the sentence.
    word: (s, l, k, phrase) => {
      const r = row(s, l, k), i = r.text.indexOf(phrase);
      if (i < 0) throw new Error(`"${phrase}" not in "${r.text}"`);
      return r.start + (r.end - r.start) * (i / r.text.length);
    },
    ask: (s, n = 0, hold = 2.5) => {
      const r = list.find((x) => x.segment === s && x.predict === n);
      if (!r) throw new Error(`no predict question ${s}.${n}`);
      return { start: r.start, end: r.end, held: r.end + hold, text: r.text };
    },
    rows: list,
    last: list[list.length - 1].end,
  };
}

// Every string the scene puts on screen is recorded by shape, so a test can read a frame.
export const LABELS = new WeakMap();
export function words(str, atlas, size, x, y, anchor = "left") {
  const t = text(String(str), { atlas, size, x, y, anchor });
  LABELS.set(t.shape, String(str));
  return t.shape;
}
// A label item in screen space (does not move with the camera).
export const label = (A, str, size, x, y, fill = C.ink, anchor = "center", opacity = 1, font = "sans") =>
  ({ shape: words(str, A[font], size, x, y, anchor), fill, opacity, screen: true });
// A soft dark plate behind a label so it reads over anything.
export function plate(x, y, w, h, opacity = 0.65) {
  return { shape: rect(x - w / 2, y - h / 2, w, h, h / 2), fill: [0, 0, 0, opacity], blur: 14, screen: true };
}
export const pct = (v) => `${Math.round(v * 100)}%`;
export const smooth01 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// A quadratic curve as a flat point list, n segments.
export function quad(ax, ay, cx, cy, bx, by, n = 24, upto = 1) {
  const p = [];
  for (let i = 0; i <= Math.ceil(n * upto); i++) { const u = Math.min(upto, i / n), v = 1 - u; p.push(v * v * ax + 2 * u * v * cx + u * u * bx, v * v * ay + 2 * u * v * cy + u * u * by); }
  return p;
}
