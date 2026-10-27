// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 09 surreal-doors: a set piece. The letters stand on a heath at dusk as thin slabs, and each one is a doorway
// onto a different hour: a noon sky with cumulus moving through it, while the dusk around them stays still.
// Light from the noon side falls out of each doorway onto the heath. Edges carry a prism fringe (the three
// channels offset across the rim), the slabs have depth, and one low sun sits on the horizon as the hot mark.
// Fuses: the doorway-on-a-heath plate of feed set 27 (as an idea), the surrealist window that shows another
// sky, and the canon's aperture as the sun.
import { setName, NAME } from '../lib/name.mjs';
import { img, lin, clamp, smooth, mix, fbm, vnoise, grain, TAU, boxBlur, vignette } from '../lib/img.mjs';

export const meta = {
  id: 'surreal-doors', title: 'Surreal set piece: doorways to noon', loop: { seconds: 8, fps: 24, crossfade: 0 },
  marriage: 'surrealist window-sky set piece x extruded slab letters x prism rim fringe x 2D cumulus field x Accession Display 800',
  refs: ['2026-10-23-feed-test-27/frames (9061 slab doorway)'],
};

// periodic fbm in x, so the noon clouds wrap and the loop closes
function pfbm(x, y, period, s) { let v = 0, a = 0.5, n = 0, f = 1; for (let o = 0; o < 5; o++) { v += a * vnoise(x * f, y * f, s + o, period * f); n += a; a *= 0.5; f *= 2; } return v / n; }

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), hz = 0.56 * H;
  const N = setName(text, W, H, { box: [0.04, 0.44, 0.96, 0.9], weight: 700, tracking: 150, sy: 1.75 });
  const base = N.spans[0].base, mask = N.mask, depth = Math.round(0.018 * W), ex = 0.55, ey = -0.35;
  // extrusion: the slab's side, seen from a little left of centre
  const side = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 0; for (let k = 1; k <= depth; k += 1) { const sx = Math.round(x - ex * k), sy = Math.round(y - ey * k); if (sx >= 0 && sy >= 0 && sy < H && sx < W) m = Math.max(m, mask[sy * W + sx]); if (m >= 1) break; }
    side[y * W + x] = m;
  }
  // light from the doorways on the heath: the mask reflected under the baseline, foreshortened, blurred
  const pool = new Float32Array(W * H);
  for (let y = Math.floor(base); y < H; y++) for (let x = 0; x < W; x++) { const sy = Math.round(base - (y - base) / 0.32); if (sy >= 0 && sy < H) pool[y * W + x] = mask[sy * W + x] * Math.exp(-(y - base) / (0.12 * H)); }
  const glow = boxBlur(pool, W, H, Math.round(22 * u), { passes: 3 });
  const zen = lin('#141c33'), mid = lin('#3d3553'), amber = lin('#e0844a'), heath = lin('#2a2a1f'), heath2 = lin('#4a3d28');
  const noonZ = lin('#2f6fc1'), noonH = lin('#a9cdee'), white = lin('#fbf8f2'), sunC = lin('#ff7a2f'), slab = lin('#8b8478');
  const sun = { x: 0.5 * W, y: hz - 0.03 * H, r: 0.011 * H };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = y / H;
    let c;
    if (y < hz) {
      const k = y / hz; c = k < 0.7 ? zen.map((q, j) => mix(q, mid[j], k / 0.7)) : mid.map((q, j) => mix(q, amber[j], ((k - 0.7) / 0.3) ** 1.8));
      const d = Math.hypot(x - sun.x, y - sun.y); c = c.map((q, j) => q + sunC[j] * (2.4 * smooth(sun.r + u, sun.r - u, d) + 0.25 * Math.exp(-d / (0.08 * H))));
    } else {
      const z = (y - hz) / (H - hz), g = fbm(x / (6 * u) / (0.3 + z), y / (3 * u), 2, 4);
      c = heath.map((q, j) => mix(q, heath2[j], g * 0.8) * (0.55 + 0.6 * z));
      c = c.map((q, j) => q + amber[j] * 0.08 * Math.exp(-(y - hz) / (0.03 * H)));
      c = c.map((q, j) => q + noonH[j] * 0.5 * glow[i]);
    }
    // the slab side, lit by dusk on its right face
    if (side[i] > 0) c = c.map((q, j) => mix(q, slab[j] * (0.22 + 0.1 * fbm(x / (2 * u), y / (2 * u), 7, 3)), side[i]));
    // the doorway: noon inside, with a prism fringe at the rim (channels offset across the edge)
    const m = mask[i];
    if (m > 0 || (x > 1 && mask[i - 2] > 0) || (x < W - 2 && mask[i + 2] > 0)) {
      const px = x / W * 3 + t * 3, py = (y - N.spans[0].top) / (base - N.spans[0].top);
      const cl = pfbm(px * 1.4, y / H * 4.5, 4.2, 31), cloud = smooth(0.4, 0.58, cl) * smooth(1.1, 0.35, py);
      let noon = noonZ.map((q, j) => mix(q, noonH[j], clamp(py)));
      noon = noon.map((q, j) => mix(q, white[j] * (0.85 + 0.25 * (1 - py)), cloud));
      const fr = 1.4 * u, mR = mask[y * W + Math.min(W - 1, Math.round(x + fr))], mB = mask[y * W + Math.max(0, Math.round(x - fr))];
      const ch = [mR, m, mB];
      c = c.map((q, j) => mix(q, noon[j] * 1.15, ch[j]));
    }
    I.px.set(c, i * 3);
  }
  return { image: grain(vignette(I, 0.3), { amount: 2.2, seed: `doors/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
