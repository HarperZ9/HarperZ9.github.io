// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 05 cloud: the name as a cumulus volume. Density is the letter's thickness (a dome over its distance field)
// eroded by billowing noise; each pixel marches through the volume (front to back, 22 steps) and each sample
// marches 12 taps toward the sun, the path march the feed-23 cloud round adopted over the two-tap chord.
// Beer-Lambert, a Henyey-Greenstein forward lobe, a powder term for the dark edges of thick cloud, and sky
// ambient from above. The volume drifts on a circle through the noise, so the loop closes.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, smooth, mix, vnoise, grain, TAU, sampleF, boxBlur } from '../lib/img.mjs';

export const meta = {
  id: 'cloud', title: 'Cloud volume', loop: { seconds: 8, fps: 24, crossfade: 0 },
  marriage: 'cloud light march (12-tap path) x letter distance field as thickness x billow noise x Accession Display 900',
  refs: ['feed-23/frames (cloud round)', 'PLAYBOOK 4.4 and the 2026-10-24 correction'],
};

const n3 = (x, y, z) => { const zi = Math.floor(z), f = z - zi, s = f * f * (3 - 2 * f); return vnoise(x + zi * 19.1, y + zi * 7.3, 5) * (1 - s) + vnoise(x + (zi + 1) * 19.1, y + (zi + 1) * 7.3, 5) * s; };

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H);
  const N = setName(breakLines(text, 2), W, H, { box: [0.07, 0.12, 0.93, 0.86], weight: 900, tracking: 80, leading: 1.3, sdf: true });
  // thickness map (px): a soft dome over the inside distance, blurred so the volume is rounded, not extruded
  const half = N.capPx * 0.17, Tm = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { const d = -N.sdf[i] + half * 0.32; Tm[i] = d > 0 ? Math.sqrt(d * half) : 0; }
  const T = boxBlur(Tm, W, H, Math.max(1, Math.round(half * 0.25)), { passes: 3 });
  const scale = 1 / (0.085 * N.capPx), ox = 3 * Math.cos(TAU * t), oy = 3 * Math.sin(TAU * t);
  const rho = (x, y, z) => {
    const th = sampleF(T, W, H, x, y); if (th <= 0.5) return 0;
    const X = x * scale + ox, Y = y * scale + oy, Z = z * scale;
    const b = 0.55 * n3(X, Y, Z) + 0.28 * n3(X * 2.1, Y * 2.1, Z * 2.1) + 0.17 * n3(X * 4.3, Y * 4.3, Z * 4.3);
    return clamp(((th * 1.25 - Math.abs(z)) / (0.6 * half) - (1 - b) * 1.25) * 2.2);
  };
  const L = [-0.55, -0.62, 0.56], ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const zen = lin('#2b5592'), hor = lin('#b9cde3'), sunC = lin('#fff1dc'), amb = lin('#9fb8d8'), base = lin('#8790a0');
  const ext = 24 / N.capPx, g = 0.55, hg = c => (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * c, 1.5));
  const cosV = -L[2], phase = hg(cosV) * 4 * Math.PI * 0.6 + 0.4;
  let Tmax = 0; for (let i = 0; i < W * H; i++) Tmax = Math.max(Tmax, T[i]);
  const zs = 22, ls = 12, lstep = half * 0.22;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = y / H;
    // sky: zenith to a pale horizon, a sun glow up and to the left
    const sg = Math.exp(-Math.hypot(x / W - 0.08, v - 0.05) / 0.25);
    let c = [0, 1, 2].map(k => mix(zen[k], hor[k], Math.pow(v, 1.4)) + sunC[k] * 0.35 * sg);
    const th = T[i];
    if (th > 0.5) {
      let Tr = 1, Lr = [0, 0, 0];
      const zt = Math.min(th * 1.3, Tmax), dz = (2 * zt) / zs;
      for (let k = 0; k < zs; k++) {
        const z = zt - (k + 0.5) * dz, d = rho(x + 0.5, y + 0.5, z);
        if (d <= 0.001) continue;
        let od = 0;
        for (let j = 1; j <= ls; j++) od += rho(x + 0.5 + L[0] * lstep * j, y + 0.5 + L[1] * lstep * j, z + L[2] * lstep * j) * lstep;
        const sunT = Math.exp(-ext * od), powder = 1 - Math.exp(-2 * ext * od - 0.4), up = clamp(0.5 - (z / (zt + 1e-3)) * 0.1 + (1 - (y - (N.spans[0].top)) / (N.capPx * 1.4)) * 0.4);
        const dT = Math.exp(-ext * d * dz), a = Tr * (1 - dT);
        for (let q = 0; q < 3; q++) Lr[q] += a * (sunC[q] * 2.6 * sunT * phase * (0.35 + 0.65 * powder) + amb[q] * 0.3 * up + base[q] * 0.08);
        Tr *= dT; if (Tr < 0.01) break;
      }
      c = c.map((s, q) => s * Tr + Lr[q]);
    }
    for (let q = 0; q < 3; q++) I.px[i * 3 + q] = c[q];
  }
  return { image: grain(I, { amount: 1.6, seed: `cloud/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
