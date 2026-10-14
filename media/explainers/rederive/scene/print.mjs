// Film 3's world, "Re-derive it. Don't take it on trust." (BIBLE.md, film 3): the one
// film on the paper pole. Graphite ink on a bone ground; a re-run is a cyan negative laid
// over the print as a second exposure. Where the negative and the print agree, the line
// doubles; where they do not, the print fades to graphite with a drift edge.
import { contour, rect } from "../../../raw-native/web-23ec93f/motion/path.mjs";

export const C = Object.freeze({
  ground: [0.80, 0.75, 0.63], ink: "#2a2926", ink2: "#5d5a52", dim: "#8f8a7d", faint: "#b9b2a2",
  hot: "#b8482b", cyan: "#1f9fb2",
});

export const at = (shape, x, y) => shape.map((c) => { const p = c.pts, o = new Float32Array(p.length); for (let k = 0; k < p.length; k += 2) { o[k] = p[k] + x; o[k + 1] = p[k + 1] + y; } return contour(o, c.closed); });

// A printed card: an outline and text bars, at the origin, w x h.
export function card(w, h, bars = [0.8, 0.6]) {
  const out = { edge: rect(0, 0, w, h, Math.min(6, h * 0.1)), bars: [] };
  bars.forEach((f, k) => out.bars.push(...rect(w * 0.1, h * (0.24 + k * 0.24), w * 0.8 * f, Math.max(2, h * 0.08), 1)));
  return out;
}
export function grid(n, cols, x0, y0, dx, dy) {
  return Array.from({ length: n }, (_, i) => [x0 + (i % cols) * dx, y0 + Math.floor(i / cols) * dy]);
}
// Spread k of n indices evenly, so a share reads as a density and not as a cluster.
export const spread = (k, n) => new Set(Array.from({ length: k }, (_, i) => Math.floor(((i + 0.5) * n) / k)));
