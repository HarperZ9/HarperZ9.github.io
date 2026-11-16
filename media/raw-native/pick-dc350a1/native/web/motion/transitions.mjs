// Transitions: named entrances for one piece of media, each a pure function of progress.
//
//   import { transitions, walk } from "./transitions.mjs";
//   const f = transitions.aperture({ blades: 7 });
//   f(0)   -> { clip: shape, opacity: 0..1, matrix: [a, b, c, d, e, f] }   the piece closed
//   f(1)   -> the piece whole: the clip covers the box, opacity 1, the identity matrix
//
// A frame here is a display list for the compositor, where a scene's frame is a display list for the renderer:
// `clip` is a Motion shape (path.mjs contours) in the unit box of the piece, x and y from 0 to 1 with y down;
// `matrix` is an affine transform in box units (e and f are fractions of the box's width and height). Every
// transition keeps the same contours and the same point count for every u, so two frames interpolate point
// for point and a browser can run the samples as keyframes (scroll.mjs). No DOM here: runs in Node.
//
// u runs 0 (away) to 1 (settled). walk() turns one transition into an arrival, a hold and a leaving along a
// single progress p, the leaving being the arrival run backwards, so moving back up a page undoes it exactly.
import { ease, clamp01, lerp, span, stagger, rng } from "./timeline.mjs";
import { contour, circle } from "./path.mjs";
import { morph } from "./morph.mjs";

export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
const box = (x, y, w, h) => contour([x, y, x + w, y, x + w, y + h, x, y + h], true);
const frame = (clip, opacity = 1, matrix = IDENTITY) => ({ clip, opacity, matrix });
const TAU = Math.PI * 2;
// the radius of a regular n-gon whose inscribed circle reaches the unit box's corners from its centre
const cover = (n) => Math.SQRT1_2 / Math.cos(Math.PI / n) + 0.004;

export const transitions = Object.freeze({
  // Light: an iris of n blades opens from the centre and turns a little as it opens.
  aperture: ({ blades = 7, turn = 0.35, e = ease.inOut } = {}) => (u) => {
    const k = e(u), r = cover(blades) * k, a0 = turn * (1 - k), p = [];
    for (let i = 0; i < blades; i++) { const a = a0 + (TAU * i) / blades; p.push(0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)); }
    return frame([contour(p, true)], span(u, 0, 0.12, ease.linear));
  },
  // Type: columns are set one after another from the left, each dropping from the top line to the baseline.
  letterSet: ({ letters = 9, each = 0.3, e = ease.out } = {}) => (u) => {
    const w = 1 / letters, cs = [];
    for (let i = 0; i < letters; i++) cs.push(box(i * w, 0, w * 1.002, stagger(clamp01(u), 0, 1, i, letters, each, e)));
    return frame(cs);
  },
  // Mosaic: tiles grow from their own centres in a seeded order until the courses close.
  tiles: ({ cols = 6, rows = 4, seed = 7, each = 0.45, e = ease.out } = {}) => {
    const n = cols * rows, order = [...Array(n).keys()], r = rng(seed);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const rank = new Array(n); order.forEach((tile, k) => { rank[tile] = k; });
    return (u) => {
      const cs = [], w = 1 / cols, h = 1 / rows;
      for (let i = 0; i < n; i++) {
        const s = stagger(clamp01(u), 0, 1, rank[i], n, each, e) * 1.004, cx = ((i % cols) + 0.5) * w, cy = (Math.floor(i / cols) + 0.5) * h;
        cs.push(box(cx - (w * s) / 2, cy - (h * s) / 2, w * s, h * s));
      }
      return frame(cs);
    };
  },
  // Ink: a blot with an uneven edge spreads from where the drop lands, by Motion's point correspondence.
  inkBleed: ({ at = [0.38, 0.44], lobes = 5, seed = 3, points = 48, e = ease.out } = {}) => {
    const r = rng(seed), ph = Array.from({ length: lobes }, () => r() * TAU), amp = Array.from({ length: lobes }, (_, k) => (0.5 + r()) / (k + 2));
    const far = Math.max(Math.hypot(at[0], at[1]), Math.hypot(1 - at[0], at[1]), Math.hypot(at[0], 1 - at[1]), Math.hypot(1 - at[0], 1 - at[1]));
    const blot = (rad, wobble) => { const p = []; for (let i = 0; i < points; i++) { const a = (TAU * i) / points; let d = 1; for (let k = 0; k < lobes; k++) d += wobble * amp[k] * Math.sin((k + 2) * a + ph[k]); p.push(at[0] + rad * d * Math.cos(a), at[1] + rad * d * Math.sin(a)); } return [contour(p, true)]; };
    const m = morph(blot(0.001, 0.9), circle(at[0], at[1], far * 1.1, points), { density: 1 });
    return (u) => frame(m(e(u)), span(u, 0, 0.2, ease.linear));
  },
  // Sound: the piece is drawn on from the left behind a leading edge shaped like a wave.
  waveform: ({ cycles = 3, amp = 0.05, points = 24, e = ease.inOut } = {}) => (u) => {
    const k = e(u), x = lerp(-amp, 1 + amp, k), p = [0, 0];
    for (let i = 0; i <= points; i++) { const y = i / points; p.push(Math.max(0, x + amp * Math.sin(TAU * cycles * y + k * TAU)), y); }
    p.push(0, 1);
    return frame([contour(p, true)]);
  },
  // Data: strata are laid from the bottom up, each sliding in along its own row.
  strata: ({ layers = 7, each = 0.4, e = ease.out } = {}) => (u) => {
    const h = 1 / layers, cs = [];
    for (let i = 0; i < layers; i++) cs.push(box(0, 1 - (i + 1) * h, stagger(clamp01(u), 0, 1, i, layers, each, e), h * 1.004));
    return frame(cs);
  },
  // Film: the frame is pulled up into the gate in steps, a hold between each pull.
  filmGate: ({ frames = 3, pull = 0.45, travel = 0.5, e = ease.inOut } = {}) => (u) => {
    let done = 0;
    for (let i = 0; i < frames; i++) done += span(clamp01(u), i / frames, (i + pull) / frames, e) / frames;
    return frame([box(0, 0, 1, 1)], span(u, 0, pull / frames, ease.linear), [1, 0, 0, 1, 0, travel * (1 - done)]);
  },
  // The exhibit: the piece is unmasked from its centre line outward.
  curtain: ({ e = ease.inOut } = {}) => (u) => { const k = e(u) * 1.004; return frame([box(0.5 - k / 2, 0, k, 1)]); },
  // The engine: a raking edge crosses the piece from the upper left, the way its light falls.
  rake: ({ slope = 0.35, e = ease.inOut } = {}) => (u) => {
    const x = lerp(-slope, 1 + 0.004, e(u));
    return frame([contour([0, 0, Math.max(0, x + slope), 0, Math.max(0, x), 1, 0, 1], true)]);
  },
  // Tools: a plate is pressed down onto the sheet.
  press: ({ from = 1.07, e = ease.out } = {}) => (u) => { const s = lerp(from, 1, e(u)); return frame([box(0, 0, 1, 1)], span(u, 0, 0.6, ease.linear), [s, 0, 0, s, 0, 0]); },
});

// One progress p for a whole pass: arrive over `enter`, hold, leave over `exit` by running the arrival backwards.
export function walk(f, { enter = [0, 0.36], exit = [0.7, 1] } = {}) {
  return (p) => f(Math.min(span(p, enter[0], enter[1], ease.linear), 1 - span(p, exit[0], exit[1], ease.linear)));
}

// Is the point inside the frame's clip (nonzero winding)? For tests and for hit checks.
export function inside(fr, x, y) {
  let w = 0;
  for (const c of fr.clip) {
    const a = c.pts, n = a.length / 2;
    for (let i = 0; i < n; i++) {
      const x0 = a[2 * i], y0 = a[2 * i + 1], j = (i + 1) % n, x1 = a[2 * j], y1 = a[2 * j + 1];
      if ((y0 <= y) !== (y1 <= y)) { const t = (y - y0) / (y1 - y0); if (x0 + t * (x1 - x0) > x) w += y1 > y0 ? 1 : -1; }
    }
  }
  return w !== 0;
}
// The share of the unit box the clip shows, on an n by n grid of sample points.
export function shown(fr, n = 24) {
  let k = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (inside(fr, (i + 0.5) / n, (j + 0.5) / n)) k++;
  return k / (n * n);
}
