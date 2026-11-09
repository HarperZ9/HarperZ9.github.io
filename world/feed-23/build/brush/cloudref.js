// brush/cloudref.js: a brute-force volumetric reference for a cloud.json: density is the union of the lobe ellipsoids
// (cut by the flat base), the camera is orthographic along -z, and radiance is single scattering from the light
// with a shadow march toward it. Slow by design; it is the stand-in for the engine's raymarcher in the agreement
// tests (PLAYBOOK.md 5.4) until raw-native renders the same cloud.json. Not used for pictures.
import { flatLobes } from './cloud2d.js';

export function referenceRender(cloud, { W, H, unit, zSteps = 48, lightSteps = 16 }) {
  const list = flatLobes(cloud.lobes), ext = cloud.medium.extinction, base = cloud.base;
  let z0 = Infinity, z1 = -Infinity; for (const l of list) { z0 = Math.min(z0, l.c[2] - l.r[2]); z1 = Math.max(z1, l.c[2] + l.r[2]); }
  const rho = (x, y, z) => {
    if (y > base.y) return 0;
    for (const l of list) { const u = (x - l.c[0]) / l.r[0], v = (y - l.c[1]) / l.r[1], w = (z - l.c[2]) / l.r[2]; if (u * u + v * v + w * w < 1) return 1; }
    return 0;
  };
  const Lp = cloud.light.pos, alpha = new Float32Array(W * H), rad = new Float32Array(W * H), dz = (z1 - z0) / zSteps;
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const x = (px + 0.5) / unit, y = (py + 0.5) / unit;
    let T = 1, L = 0;
    for (let k = 0; k < zSteps; k++) {
      const z = z1 - (k + 0.5) * dz, d = rho(x, y, z);
      if (!d) continue;
      // shadow ray toward the light
      const lx = Lp ? Lp[0] - x : cloud.light.dir[0], ly = Lp ? Lp[1] - y : cloud.light.dir[1], lz = Lp ? Lp[2] - z : cloud.light.dir[2], lm = Math.hypot(lx, ly, lz) || 1;
      const span = Lp ? Math.min(lm, 0.4) : 0.4, ls = span / lightSteps; let od = 0;
      for (let j = 1; j <= lightSteps; j++) od += rho(x + (lx / lm) * ls * j, y + (ly / lm) * ls * j, z + (lz / lm) * ls * j) * ls;
      const dT = Math.exp(-ext * d * dz);
      L += T * (1 - dT) * Math.exp(-ext * od);
      T *= dT;
      if (T < 1e-3) break;
    }
    alpha[py * W + px] = 1 - T; rad[py * W + px] = L;
  }
  return { alpha, radiance: rad };
}

// Spearman rank correlation of two equal-length arrays.
export function spearman(a, b) {
  const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = new Float64Array(v.length); idx.forEach(([, i], k) => { r[i] = k; }); return r; };
  const ra = rank(a), rb = rank(b), n = a.length, ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; }
  return num / Math.sqrt(da * db);
}
