// Shared parts for the film 2 scene, "A passing check can still be wrong": the palette
// (BIBLE.md, film 2: black with a scanline phosphor veil, phosphor bone ink, drift on the
// line no test runs, verified lime only on the control that fails when it should), the
// program drawn as fine plotter lines of code, and the three tests that run it.
import { contour, rect, line } from "../../../raw-native/web-23ec93f/motion/path.mjs";
import { text } from "../../../raw-native/web-23ec93f/motion/text.mjs";
import { rng, lerp } from "../../../raw-native/web-23ec93f/motion/timeline.mjs";

export const C = Object.freeze({
  void: [0.010, 0.012, 0.010], ink: "#e3e4d2", ink2: "#a7ad9c", dim: "#6f7569", faint: "#3a3f37",
  hot: "#e29472", lime: "#b6e070", unv: "#b3b1e6",
});

// The program: 60 lines of code as plotter strokes, indented like code. Line BROKEN is the
// changed line; no test runs it.
export const N = 60, BROKEN = 37, X0 = 600, Y0 = 232, DY = 10.6;
export const TESTS = ["test_parse", "test_format", "test_round_trip"];

export function program(seed = 2014) {
  const r = rng(seed), lines = [];
  let indent = 0;
  for (let i = 0; i < N; i++) {
    if (i === BROKEN) indent = 2;
    else if (r() < 0.22) indent = Math.max(0, Math.min(3, indent + (r() < 0.5 ? -1 : 1)));
    const x = X0 + indent * 34, len = 90 + r() * (560 - indent * 60), y = Y0 + i * DY;
    // A plotter line: points every 18 px with a hair of wobble.
    const pts = [];
    for (let s = 0; s <= len; s += 18) pts.push(x + Math.min(s, len), y + (r() - 0.5) * 0.7);
    lines.push({ i, x, y, len, pts: new Float32Array(pts) });
  }
  // Which lines each test runs: most of the program, never the broken line or its neighbours.
  const runs = TESTS.map((_, k) => {
    const set = new Set();
    for (let i = 0; i < N; i++) if (Math.abs(i - BROKEN) > 1 && r() < [0.62, 0.7, 0.78][k]) set.add(i);
    return set;
  });
  return { lines, runs, box: { x0: X0 - 20, y0: Y0 - 20, x1: X0 + 680, y1: Y0 + (N - 1) * DY + 20 } };
}

export const lineShape = (L, dx = 0, dy = 0, s = 1, cx = 960, cy = 545) => {
  const p = L.pts, o = new Float32Array(p.length);
  for (let k = 0; k < p.length; k += 2) { o[k] = cx + (p[k] + dx - cx) * s; o[k + 1] = cy + (p[k + 1] + dy - cy) * s; }
  return [contour(o, false)];
};

// The phosphor veil: faint scanlines over the whole frame, in the art layer.
export function veil() {
  const out = [];
  for (let y = 1.5; y < 1080; y += 4) out.push(...line(0, y, 1920, y));
  return out;
}

// The source tab (film 1's rule): evidence.json short and n, on the lower third.
export function tab(evidence, id, mono) {
  const e = evidence.sources[id], head = e.short.replace(/(\d{4}), /, "$1 . ");
  return text(`${head} . ${e.n}`, { atlas: mono, size: 28, x: 96, y: 58 }).shape;
}

export function grid(n, cols, x0, y0, gap) {
  return Array.from({ length: n }, (_, i) => [x0 + (i % cols) * gap, y0 + Math.floor(i / cols) * gap]);
}
export { rect, line, lerp };
