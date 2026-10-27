// lib/medium/bed.mjs: the floor as sediment, the mosaic laid by settling. Sand-coloured grains at two sizes (fine
// grain and scattered pebbles), set in laminae: each settled layer is a band that keeps the colour of what fell into
// it, with a thin darker line where one layer meets the next. No courses, no grout: the order comes from settling.
import { clamp } from './grid.mjs';

const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// colour of the bed at output pixel x, heightPx above the tank floor, in column ci; grain is the grain size in px
// out (optional): receives the layer at this pixel, so a spectral render can apply the layer's spectrum itself (then the
// returned colour is the sand without the layer's tint)
export function sediment(m, x, heightPx, ci, sand, H, grain, out = null) {
  const L = m.layers[ci], cellPx = H / m.ny, base0 = (m.bed[ci] - L.reduce((p, q) => p + q.t, 0)) * cellPx;
  let layer = null, acc = base0, toEdge = Infinity;
  if (heightPx >= base0) for (const q of L) { const top = acc + q.t * cellPx; if (heightPx < top) { layer = q; toEdge = Math.min(heightPx - acc, top - heightPx); break; } acc = top; }
  // fine grains: each grain cell takes its own lightness
  const gx = Math.floor(x / grain), gy = Math.floor(heightPx / grain), fine = 0.92 + 0.12 * hash(gx, gy, 1);
  // pebbles: one in a few larger cells, a soft disc darker or lighter than the sand
  const P = grain * 5, px = Math.floor(x / P), py = Math.floor(heightPx / P), cx = (px + 0.2 + 0.6 * hash(px, py, 2)) * P, cy = (py + 0.2 + 0.6 * hash(px, py, 3)) * P;
  const pr = P * (0.18 + 0.22 * hash(px, py, 4)), q = Math.hypot(x - cx, heightPx - cy) / pr, has = hash(px, py, 5) < 0.35;
  const pebble = has && q < 1 ? (hash(px, py, 6) < 0.5 ? 0.86 : 1.06) * (1 - 0.08 * q * q) : 1;
  const spectralLayer = out && layer?.spec; if (out) out.layer = spectralLayer ? layer : null;
  const a = layer && !spectralLayer ? layer.rgb : null, line = layer && toEdge < grain * 0.8 ? 0.92 : 1;
  return sand.map((s, k) => s * fine * pebble * line * (a ? Math.exp(-a[k] * 0.75) : 1));
}

// the top of the bed: a soft shading on the last few pixels, the light catching the settled surface
export const bedTopLight = (distPx, grain) => 1 + 0.12 * clamp(1 - distPx / (grain * 3), 0, 1);
