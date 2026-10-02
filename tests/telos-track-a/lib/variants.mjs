// variants.mjs: the T6 nuisance helpers shared by t5t7-run.mjs and t6-invariance.test.mjs.
export const SCALES = { "x0.5": [1, 2], "x0.75": [3, 4], "x1.5": [3, 2], "x2": [2, 1] };
export const N_GRID = [8, 12, 16, 20, 24, 28, 32, 40, 48];

export function shiftRight(px, w, h) {
  const out = new Uint8Array(px.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.max(0, x - 1), o = (y * w + x) * 4, s = (y * w + sx) * 4;
    out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; out[o + 3] = 255;
  }
  return out;
}

// Red rectangle outline centred on the frame, outer box at half the frame size, thickness the smallest
// integer whose pixel count reaches `fraction` of the frame.
export function outlineMask(w, h, fraction) {
  const ow = Math.floor(w / 2), oh = Math.floor(h / 2), x0 = Math.floor((w - ow) / 2), y0 = Math.floor((h - oh) / 2);
  const count = (t) => ow * oh - Math.max(0, ow - 2 * t) * Math.max(0, oh - 2 * t);
  let t = 1;
  while (count(t) < fraction * w * h && 2 * t < Math.min(ow, oh)) t++;
  const mask = new Uint8Array(w * h);
  for (let y = y0; y < y0 + oh; y++) for (let x = x0; x < x0 + ow; x++) {
    if (x < x0 + t || x >= x0 + ow - t || y < y0 + t || y >= y0 + oh - t) mask[y * w + x] = 1;
  }
  return { mask, t, count: count(t), bbox: [x0, y0, x0 + ow - 1, y0 + oh - 1] };
}
