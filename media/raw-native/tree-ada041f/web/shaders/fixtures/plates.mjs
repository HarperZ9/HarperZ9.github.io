// 8-bit sRGB plates for the dither parity test. gradientPlate: smooth ramps in lightness and hue
// with a soft photo-like region (where dither decisions sit on thresholds); randomPlate: seeded
// uniform 24-bit colours (where the nearest-colour and bracketing decisions sit on every boundary).
import { pcg } from "../common.mjs";
export function gradientPlate(w = 320, h = 180) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1), v = y / (h - 1), i = (y * w + x) * 4;
    let r, g, b;
    if (v < 0.25) { r = g = b = u * 255; }
    else if (v < 0.5) { const hh = u * 6, k = (n) => Math.max(0, Math.min(1, Math.abs(((hh + n) % 6) - 3) - 1)); r = 255 * k(0); g = 255 * k(4); b = 255 * k(2); }
    else { r = 128 + 100 * Math.sin(u * 7 + v * 3); g = 110 + 90 * Math.sin(u * 4 - v * 5 + 1); b = 90 + 80 * Math.cos(u * 3 + v * 9); }
    d[i] = Math.round(r); d[i + 1] = Math.round(g); d[i + 2] = Math.round(b); d[i + 3] = 255;
  }
  return { width: w, height: h, data: d };
}
export function randomPlate(w = 512, h = 512, seed = 7) {
  const d = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) { const v = pcg(p ^ pcg(seed)); d[p * 4] = v & 255; d[p * 4 + 1] = (v >>> 8) & 255; d[p * 4 + 2] = (v >>> 16) & 255; d[p * 4 + 3] = 255; }
  return { width: w, height: h, data: d };
}
