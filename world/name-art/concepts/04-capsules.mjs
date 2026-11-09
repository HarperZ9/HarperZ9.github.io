// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 04 capsules: each letter is a column. The name is set tall (Accession Display stretched 3.4 times on the
// vertical), and every letter gets its own capsule of thin-film colour (the substrate's interference model:
// hue follows film thickness, not position). The field outside the letter runs downward, the field inside it
// runs upward, so the letter is a seam in the light rather than a shape drawn on it. Heavy clumped grain.
import { setName, NAME } from '../lib/name.mjs';
import { img, lin, clamp, smooth, grain, fract, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'capsules', title: 'Spectral capsule columns', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'spectral gradient fields x one capsule per letter x grain veil x Accession Display stretched',
  refs: ['feed-29/frames (4QeJ, u19Q, hcKy)'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), ground = lin('#0d0d10');
  const N = setName(text, W, H, { box: [0.035, 0.1, 0.965, 0.9], weight: 800, tracking: 70, sy: 3.4, sdf: true });
  // the spectral ramp: a designed run from night violet through ember and cream to sky (sRGB stops, mixed in linear)
  const STOPS = ['#170a2b', '#5b1640', '#c2302f', '#ef7a3c', '#f6c98f', '#f3ecdf', '#9cc7e6', '#4a73c2', '#1d2466'].map(lin);
  const ramp = q => { const x = clamp(q) * (STOPS.length - 1), k = Math.min(STOPS.length - 2, Math.floor(x)), f = smooth(0, 1, x - k); return STOPS[k].map((v, c) => v + (STOPS[k + 1][c] - v) * f); };
  const caps = N.spans.map((s, k) => { const pad = 0.06 * (s.x1 - s.x0); return { x0: s.x0 + pad * 0.4, x1: s.x1 - pad * 0.4, k }; });
  const y0 = 0.045 * H, y1 = 0.955 * H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let c = ground, a = 0;
    const cap = caps.find(q => x >= q.x0 - 2 && x <= q.x1 + 2);
    if (cap) {
      const r = (cap.x1 - cap.x0) / 2, cx = (cap.x0 + cap.x1) / 2, yy = clamp(y, y0 + r, y1 - r), d = Math.hypot(x + 0.5 - cx, y + 0.5 - yy) - r;
      a = clamp(0.5 - d);
      if (a > 0) {
        const m = N.mask[i], v = (y - y0) / (y1 - y0), wob = 0.06 * fbm(x / (60 * u), y / (300 * u) + t, cap.k, 3);
        const tri = q => 1 - Math.abs(2 * fract(q) - 1), ph = cap.k * 0.071, out = tri(v * 0.55 + t + ph + wob), inn = tri(-v * 0.55 + t + ph + 0.5 + wob);
        const across = (x - cx) / r;   // a cylinder: brighter down the middle, the edges roll off
        const shade = 0.5 + 0.55 * Math.sqrt(Math.max(0, 1 - across * across));
        const fo = ramp(out), fi = ramp(inn), seam = smooth(1.2 * u, 0, Math.abs(N.sdf[i] + 0.5 * u));
        const spec = 0.22 * Math.exp(-(((across + 0.45) / 0.09) ** 2));   // a glass tube's window highlight
        c = [0, 1, 2].map(ch => ((fo[ch] * (1 - m) * 0.38 + fi[ch] * m * 1.0) * shade + spec) * (1 - 0.85 * seam) + 0.003);
      }
    }
    for (let ch = 0; ch < 3; ch++) I.px[i * 3 + ch] = ground[ch] * (1 - a) + c[ch] * a;
  }
  return { image: grain(I, { amount: 4.5, seed: `caps/${t}`, radius: Math.max(1, Math.round(1.3 * u)), chroma: 0.3 }), text: N.text };
}
