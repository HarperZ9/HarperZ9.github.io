// Shared parts for the film 1 scene: palette, type, cues from the narration
// timing, and small drawn forms (labels, braces, arrows, cards).
import { rect, line, circle, contour, bounds, transform } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { span, ease } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";

export const C = Object.freeze({
  void: [0.024, 0.024, 0.031], ink: "#ece5d6", ink2: "#b8b0a0", dim: "#958e80", frame: "#2a2830", faint: "#4a4650",
  // Verdict colours, one hot mark per view.
  ok: "#63d4ce", hot: "#e29472", unv: "#b3b1e6",
});

// Cue times from timing.json: at(seg, line, sentence) is when that sentence starts.
export function cues(timing) {
  const rows = new Map(timing.map((r) => [`${r.segment}.${r.line}.${r.sentence ?? 0}`, r]));
  const row = (s, l, k = 0) => { const r = rows.get(`${s}.${l}.${k}`); if (!r) throw new Error(`no sentence ${s}.${l}.${k}`); return r; };
  return {
    at: (s, l, k) => row(s, l, k).start,
    end: (s, l, k) => row(s, l, k).end,
    // When the voice reaches a phrase, estimated from its position in the sentence.
    word: (s, l, k, phrase) => {
      const r = row(s, l, k), i = r.text.indexOf(phrase);
      if (i < 0) throw new Error(`"${phrase}" not in "${r.text}"`);
      return r.start + (r.end - r.start) * (i / r.text.length);
    },
    last: timing[timing.length - 1].end,
  };
}

// A text label as a fill item. Layout is cached by the caller where it repeats.
export function label(str, atlas, { size = 30, x = 0, y = 0, anchor = "left", color = C.ink, opacity = 1, z = 0, screen = false } = {}) {
  const t = text(str, { atlas, size, x, y, anchor });
  return { item: { shape: t.shape, fill: color, opacity, z, screen }, width: t.width, layout: t };
}
export const fillOf = (shape, color, opacity = 1, extra = {}) => ({ shape, fill: color, opacity, ...extra });
export const strokeOf = (shape, color, width = 2, opacity = 1, extra = {}) => ({ shape, stroke: color, width, opacity, ...extra });

// A brace under [x0, x1] at y, opening upward, with a centre tip.
export function brace(x0, x1, y, depth = 14) {
  const m = (x0 + x1) / 2, q = depth / 2, r = Math.min(q * 1.5, (x1 - x0) / 4);
  const half = (sx, dir) => {
    const p = [];
    const quad = (ax, ay, bx, by, cx, cy) => { for (let i = 0; i <= 8; i++) { const u = i / 8, v = 1 - u; p.push(v * v * ax + 2 * v * u * bx + u * u * cx, v * v * ay + 2 * v * u * by + u * u * cy); } };
    quad(sx, y, sx, y + q, sx + dir * r, y + q);
    quad(m - dir * r, y + q, m, y + q, m, y + depth);
    return contour(p, false);
  };
  return [half(x0, 1), half(x1, -1)];
}

// A straight arrow from a to b with a small open head.
export function arrow(ax, ay, bx, by, head = 12) {
  const a = Math.atan2(by - ay, bx - ax), h1 = a + Math.PI * 0.82, h2 = a - Math.PI * 0.82;
  return [contour([ax, ay, bx, by], false), contour([bx + Math.cos(h1) * head, by + Math.sin(h1) * head, bx, by, bx + Math.cos(h2) * head, by + Math.sin(h2) * head], false)];
}

// A circular arc as an open contour, angles in radians (0 at 3 o'clock, clockwise in y-down).
export function arc(cx, cy, r, a0, a1, n = 64) {
  const p = [];
  const k = Math.max(2, Math.ceil(n * Math.abs(a1 - a0) / (Math.PI * 2)));
  for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * (i / k); p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return [contour(p, false)];
}

// A ring (annulus) as two contours, outline and hole, for a hollow dot.
export function ring(cx, cy, r, w) {
  const o = circle(cx, cy, r, 40)[0], i = circle(cx, cy, Math.max(0.01, r - w), 40)[0];
  const rev = new Float32Array(i.pts.length);
  for (let k = 0; k < i.pts.length; k += 2) { const j = i.pts.length - 2 - k; rev[k] = i.pts[j]; rev[k + 1] = i.pts[j + 1]; }
  return [o, contour(rev, true)];
}

// Dashes along a straight line.
export function dashed(x0, y0, x1, y1, dash = 10, gap = 8) {
  const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, out = [];
  for (let s = 0; s < L; s += dash + gap) { const e = Math.min(L, s + dash); out.push(contour([x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e], false)); }
  return out;
}

// A soft dark plate behind a caption, so it reads over anything.
export function scrim(shape, opacity = 0.72, pad = 18) {
  const b = bounds(shape);
  return { shape: rect(b.x0 - pad * 1.6, b.y0 - pad, b.w + pad * 3.2, b.h + pad * 2, pad), fill: "#060608", opacity, blur: pad * 0.8, screen: true };
}

export { rect, line, circle, bounds, transform, span, ease };
