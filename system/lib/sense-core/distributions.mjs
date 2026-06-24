// distributions.mjs — 1-D perceptual distributions (layered on the spatial grids).
export function lumaHistogram(px, w, h, ch, bins = 16) {
  if (!w || !h) return new Array(bins).fill(0);
  const out = new Array(bins).fill(0), n = w * h;
  for (let i = 0; i < n; i++) {
    const o = i * ch, L = (px[o] * 299 + px[o + 1] * 587 + px[o + 2] * 114) / 1000 / 255;
    out[Math.min(bins - 1, Math.floor(L * bins))]++;
  }
  return out.map((c) => c / n);
}
export function hueHistogram(px, w, h, ch, bins = 12) {
  if (!w || !h) return new Array(bins).fill(0);
  const out = new Array(bins).fill(0); let sat = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const o = i * ch, r = px[o] / 255, g = px[o + 1] / 255, b = px[o + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (mx === 0 || d / mx < 0.12) continue; // unsaturated → no hue (0.12 matches hueName's threshold)
    let hue = 0;
    if (mx === r) hue = ((g - b) / d) % 6; else if (mx === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    out[Math.min(bins - 1, Math.floor(hue / 360 * bins))]++; sat++;
  }
  return sat ? out.map((c) => c / sat) : out;
}
