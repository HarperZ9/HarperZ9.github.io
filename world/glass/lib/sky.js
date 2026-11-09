// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// sky.js: a low-sun sky and far sea line for the shore pieces. Three-stop gradient in linear light, a sun disc with
// a forward-scatter glow, and long stratus bands from seeded value noise stretched along the horizon.
import { raster, clamp, mix, hexLin, random, smoothstep } from './raster.js';

export const SKY = Object.freeze({
  zenith: '#26324a', mid: '#8b7f86', horizon: '#f0b98a', sea: '#3d4c57',
  sun: { x: 0.24, y: 0.5, r: 0.012, power: 9, glow: 0.35 }, horizon_y: 0.56, bands: 0.22, seed: 5,
});

function valueNoise(seed, nx = 64) {
  const r = random(`sky/${seed}`), g = Float32Array.from({ length: nx * nx }, () => r());
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => g[(((j % nx) + nx) % nx) * nx + (((i % nx) + nx) % nx)];
    return mix(mix(at(xi, yi), at(xi + 1, yi), sx), mix(at(xi, yi + 1), at(xi + 1, yi + 1), sx), sy);
  };
}

export function sky(w, h, o = {}) {
  const p = { ...SKY, ...o, sun: { ...SKY.sun, ...(o.sun ?? {}) } }, R = raster(w, h), n = valueNoise(p.seed);
  const z = hexLin(p.zenith), m = hexLin(p.mid), hz = hexLin(p.horizon), sea = hexLin(p.sea), yh = p.horizon_y * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, t = clamp(y / yh);
    let c = t < 0.6 ? z.map((v, k) => mix(v, m[k], (t / 0.6) ** 1.3)) : m.map((v, k) => mix(v, hz[k], ((t - 0.6) / 0.4) ** 1.6));
    if (y > yh) c = sea.map((v, k) => mix(hz[k] * 0.55, v, clamp((y - yh) / (0.06 * h))));
    // stratus: thin bands, darker underside, only in the lower half of the sky
    if (y < yh) {
      const b = n(x / w * 3, y / h * 26) * 0.6 + n(x / w * 9, y / h * 70) * 0.4, k = smoothstep(0.58, 0.8, b) * p.bands * smoothstep(0.25, 0.8, t);
      c = c.map((v, ch) => mix(v, v * 0.62 + 0.05 * hz[ch], k));
    }
    const dx = (x - p.sun.x * w) / h, dy = (y - p.sun.y * h) / h, d = Math.hypot(dx, dy);
    const disc = smoothstep(p.sun.r + 0.002, p.sun.r - 0.002, d) * (y < yh ? 1 : 0), glow = p.sun.glow * Math.exp(-d / 0.08) + 0.08 * Math.exp(-d / 0.4);
    for (let k = 0; k < 3; k++) R.data[i + k] = c[k] + hz[k] * glow + disc * p.sun.power;
    R.data[i + 3] = 1;
  }
  return R;
}
