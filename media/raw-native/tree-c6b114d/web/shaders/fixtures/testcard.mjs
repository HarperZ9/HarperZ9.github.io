// A procedural test card at console resolution, R'G'B' signal values in [0, 1]: SMPTE-style
// colour bars, a grey ramp, fine vertical and diagonal detail (where composite video fails),
// a sprite-like figure with hard pixel edges, and isolated bright points on black (where
// the halo and the spot show). Deterministic, so every test and image uses the same frame.
export function testCard(w = 256, h = 224) {
  const d = new Float32Array(w * h * 4);
  const set = (x, y, r, g, b) => { const i = (y * w + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 1; };
  const bars = [[0.75, 0.75, 0.75], [0.75, 0.75, 0], [0, 0.75, 0.75], [0, 0.75, 0], [0.75, 0, 0.75], [0.75, 0, 0], [0, 0, 0.75]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = [0, 0, 0];
    if (y < h * 0.38) c = bars[Math.min(6, Math.floor((x * 7) / w))];
    else if (y < h * 0.46) { const v = Math.floor((x / w) * 16) / 15; c = [v, v, v]; }
    else if (y < h * 0.62) {
      if (x < w / 4) c = (x & 1) ? [1, 1, 1] : [0, 0, 0];                    // one-pixel columns
      else if (x < w / 2) c = ((x + y) & 3) < 2 ? [1, 1, 1] : [0, 0, 0];      // diagonal stripes
      else if (x < (3 * w) / 4) c = ((x >> 1) & 1) ? [0.9, 0.1, 0.1] : [0.1, 0.1, 0.9];
      else c = [0.08, 0.06, 0.1];
    } else {
      c = [0.02, 0.02, 0.03];
      const cx = w * 0.3, cy = h * 0.8, dx = Math.abs(x - cx), dy = y - cy;
      if (dx < 10 && Math.abs(dy) < 18) c = Math.abs(dy) < 6 ? [0.95, 0.78, 0.6] : [0.2, 0.35, 0.9];
      if (dx < 3 && dy > -18 && dy < -10) c = [0.05, 0.05, 0.05];
      if ((x === Math.floor(w * 0.7) || x === Math.floor(w * 0.85)) && y === Math.floor(h * 0.8)) c = [1, 1, 1];
      if (x > w * 0.55 && x < w * 0.95 && y === Math.floor(h * 0.92)) c = [1, 0.85, 0.3];
    }
    set(x, y, c[0], c[1], c[2]);
  }
  return { width: w, height: h, data: d };
}
