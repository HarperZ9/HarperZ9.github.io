// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 17 pearls-large (v2 of 11): the same nacre, set larger and cropped tight so the name fills the frame. The name packed with iridescent spheres. A greedy packing fills each letter with spheres that
// fit inside its distance field (largest first), and each sphere is shaded as a pearl: a soft key from the
// upper left, a thin-film coat whose thickness follows the view angle (nacre), a rim, and a contact shadow.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';
import { img, lin, clamp, smooth, mix, grain, random, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'pearls-large', title: 'Iridescent spheres, full frame', v1: 'pearls', loop: { seconds: 6, fps: 24, crossfade: 0 },
  marriage: 'sphere packing inside the letter distance field x thin-film nacre shading x contact shadows x Accession Display 900',
  refs: ['feed set 27 iridescent strips (thin film)', 'feed set 20 light material'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), R = random('pearls');
  const N = setName(breakLines(text, 2), W, H, { box: [0.03, 0.07, 0.97, 0.93], weight: 900, tracking: 40, leading: 1.2, sdf: true });
  const rMax = N.capPx * 0.075, rMin = Math.max(1.6 * u, N.capPx * 0.012), cell = rMax * 2, gw = Math.ceil(W / cell), grid = new Map(), balls = [];
  const fits = (x, y, r) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const b of grid.get((gy + j) * gw + gx + i) ?? []) if (Math.hypot(b.x - x, b.y - y) < b.r + r + 0.6 * u) return false;
    return true;
  };
  for (let pass = 0; pass < 9; pass++) {
    const r0 = rMax * Math.pow(0.74, pass); if (r0 < rMin) break;
    for (let k = 0; k < 120000; k++) {
      const x = R() * W, y = R() * H, i = (y | 0) * W + (x | 0), r = Math.min(r0 * (0.85 + 0.15 * R()), -N.sdf[i] - 0.3 * u);
      if (r < r0 * 0.7 || !fits(x, y, r)) continue;
      const b = { x, y, r, ph: R() }; balls.push(b);
      const key = Math.floor(y / cell) * gw + Math.floor(x / cell); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(b);
    }
  }
  const paper = lin('#1a1a1f'), shadowC = lin('#050506'), L = [-0.5, -0.62, 0.6], ll = Math.hypot(...L); L.forEach((v, k) => (L[k] = v / ll));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3, f = 0.96 + 0.06 * fbm(x / (120 * u), y / (120 * u), 2, 3); I.px[i] = paper[0] * f; I.px[i + 1] = paper[1] * f; I.px[i + 2] = paper[2] * f; }
  // contact shadows first (soft discs offset down-right), then the pearls
  for (const b of balls) {
    const sx = b.x + 0.35 * b.r, sy = b.y + 0.45 * b.r, rs = b.r * 1.15;
    for (let y = Math.max(0, Math.floor(sy - rs * 1.6)); y < Math.min(H, sy + rs * 1.6); y++) for (let x = Math.max(0, Math.floor(sx - rs * 1.6)); x < Math.min(W, sx + rs * 1.6); x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / rs, a = 0.42 * Math.exp(-d * d * 1.6);
      const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) I.px[i + c] *= 1 - a * (1 - shadowC[c] / paper[c] * 0.6);
    }
  }
  const spin = 2 * Math.PI * t;
  for (const b of balls) {
    for (let y = Math.max(0, Math.floor(b.y - b.r - 1)); y < Math.min(H, b.y + b.r + 1); y++) for (let x = Math.max(0, Math.floor(b.x - b.r - 1)); x < Math.min(W, b.x + b.r + 1); x++) {
      const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, rr = dx * dx + dy * dy, a = clamp((1 - Math.sqrt(rr)) * b.r + 0.5);
      if (a <= 0) continue;
      const nz = Math.sqrt(Math.max(0, 1 - rr)), lam = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
      const hx = L[0], hy = L[1], hz = L[2] + 1, hl = Math.hypot(hx, hy, hz), spec = Math.pow(Math.max(0, (dx * hx + dy * hy + nz * hz) / hl), 60);
      // nacre: film thickness from view angle plus a per-pearl phase that turns over the loop
      const film = filmLinear(300 + 260 * (1 - nz) + 90 * Math.sin(spin + b.ph * 6.28 + dx * 2), { n: 1.53 });
      const body = [0.78, 0.76, 0.74].map((q, c) => q * (0.18 + 0.82 * lam) * (0.7 + 0.5 * film[c]));
      const rim = Math.pow(1 - nz, 3) * 0.35;
      const col = body.map((q, c) => q + spec * 1.2 + rim * film[c]);
      const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) I.px[i + c] += (col[c] - I.px[i + c]) * a;
    }
  }
  return { image: grain(I, { amount: 2, seed: `pearls/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text, count: balls.length };
}
