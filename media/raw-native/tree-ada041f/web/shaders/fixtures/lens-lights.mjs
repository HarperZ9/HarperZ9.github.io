// A synthetic HDR test frame for the lens suite: a dim night gradient, a lit window band below
// the threshold, and point lights far above it, one near a corner. Also the same lights as a
// screen-space source list (the list mode of the lens suite).
export const LENS_LIGHTS = [
  { u: 0.31, v: 0.33, E: [520, 380, 160] }, { u: 0.69, v: 0.74, E: [260, 320, 480] },
  { u: 0.83, v: 0.22, E: [400, 400, 380] }, { u: 0.06, v: 0.9, E: [300, 180, 90] },
];
export function lensLightsFrame(W, H) {
  const data = new Float64Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, g = y / H, win = x > W * 0.12 && x < W * 0.4 && y > H * 0.55 && y < H * 0.68 ? 1.1 : 0;
    data[i] = 0.02 + 0.03 * g + win; data[i + 1] = 0.025 + 0.03 * g + 0.75 * win; data[i + 2] = 0.05 + 0.02 * g + 0.4 * win; data[i + 3] = 1;
  }
  for (const L of LENS_LIGHTS) {
    const cx = Math.floor(L.u * W), cy = Math.floor(L.v * H);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((cy + dy) * W + cx + dx) * 4; for (let k = 0; k < 3; k++) data[i + k] += L.E[k] / 9; }
  }
  return { width: W, height: H, data };
}
export const lensLightsList = (W, H) => LENS_LIGHTS.map((L) => ({ x: Math.floor(L.u * W) + 0.5, y: Math.floor(L.v * H) + 0.5, E: L.E }));
