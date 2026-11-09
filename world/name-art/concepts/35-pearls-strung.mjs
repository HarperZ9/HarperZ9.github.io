// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 35 pearls-strung (v3 of 11): the letters are strands of pearls on silk, laid along the forge's centre lines, the
// way a jeweller writes in pearls. Each strand is graduated as a necklace is: the pearl size follows the stroke's
// own half width under it (read from the letter's distance field), largest mid-stroke and tapering to the ends.
// The silk shows in the gaps between pearls. Nacre is layered thin film: two stacks of aragonite tablets at
// different spacings interfere, so each pearl shows an orient of two colours, not one. Pearls reflect each other:
// a pearl's grazing rim takes the colour of the neighbour its reflection points at.
// Sources: graduated pearl strands and pearl lettering in jewellery, nacre as layered thin film (substrate thin
// film), the forge skeletons, 11 (sphere shading and nacre).
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { strokesOf, snapJoins } from '../lib/strokes.mjs';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';
import { img, lin, clamp, grain, random, fbm } from '../lib/img.mjs';
import { polyline } from '../lib/draw.mjs';

export const meta = {
  id: 'pearls-strung', title: 'Name strung in pearls', loop: { seconds: 6, fps: 24, crossfade: 0 }, v1: 'pearls',
  marriage: 'graduated pearl strands along the centre lines x silk thread x two-layer nacre x pearls reflecting pearls',
  refs: ['substrate thin film', 'feed set 27 iridescent strips'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), R = random('strung');
  const N = setName(breakLines(text, 2), W, H, { box: [0.05, 0.1, 0.95, 0.88], weight: 540, tracking: 80, leading: 1.22, sdf: true });
  const cap = N.capPx, S = snapJoins(strokesOf(N, Math.max(1, cap / 200)), 0.08 * cap);
  const halfAt = (x, y) => { const xi = Math.max(0, Math.min(W - 1, x | 0)), yi = Math.max(0, Math.min(H - 1, y | 0)); return Math.max(0, -N.sdf[yi * W + xi]); };
  const balls = [], cell = 0.1 * cap, gw = Math.ceil(W / cell), grid = new Map(), gap = 0.002 * cap;
  const near = (x, y, r) => { const gx = Math.floor(x / cell), gy = Math.floor(y / cell); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) for (const b of grid.get((gy + j) * gw + gx + i) ?? []) if (Math.hypot(b.x - x, b.y - y) < b.r + r + gap) return true; return false; };
  const add = (b) => { balls.push(b); const k = Math.floor(b.y / cell) * gw + Math.floor(b.x / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); };
  const silk = new Float32Array(W * H);
  // longest strokes first: the main strands are laid whole, and short strokes fill in around them
  const order = S.map((s, k) => { let L = 0; for (let j = 1; j < s.pts.length; j++) L += Math.hypot(s.pts[j][0] - s.pts[j - 1][0], s.pts[j][1] - s.pts[j - 1][1]); return { s, L }; }).sort((a, b) => b.L - a.L);
  for (const { s, L } of order) {
    const P = s.pts, acc = [0]; for (let j = 1; j < P.length; j++) acc.push(acc[j - 1] + Math.hypot(P[j][0] - P[j - 1][0], P[j][1] - P[j - 1][1]));
    const at = (d) => { let j = 1; while (j < P.length - 1 && acc[j] < d) j++; const f = (d - acc[j - 1]) / (acc[j] - acc[j - 1] || 1); return [P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f]; };
    const rOf = (d) => { const [x, y] = at(d), h = halfAt(x, y), grad = 0.78 + 0.22 * Math.sin(Math.PI * Math.min(1, Math.max(0, d / L))); return Math.max(0.03 * cap, Math.min(0.09 * cap, h * 1.1) * grad); };
    if (L < 0.12 * cap) { const [x, y] = at(L / 2), r = Math.max(rOf(L / 2), 0.06 * cap); if (!near(x, y, r)) add({ x, y, r, ph: R() }); continue; }   // a dot is one pearl
    // lay pearls from the middle outward so the strand is symmetric about its centre
    const mid = L / 2, r0 = rOf(mid); let pos = [mid];
    for (const dir of [1, -1]) { let d = mid, r = r0; for (;;) { const rn = rOf(d + dir * 2 * r); const nd = d + dir * (r + rn + gap); if (nd < -0.2 * rn || nd > L + 0.2 * rn) break; pos.push(nd); d = nd; r = rn; } }
    const kept = [];
    for (const d of pos) { const dd = Math.max(0, Math.min(L, d)), [x, y] = at(dd), r = rOf(dd); if (!near(x, y, r * 0.75)) { add({ x, y, r, ph: R() }); kept.push(dd); } }
    // the silk runs only between the strand's first and last pearl
    if (kept.length > 1) { const a = Math.min(...kept), b = Math.max(...kept), seg = []; for (let d = a; d <= b; d += Math.max(1, cap / 200)) seg.push(at(d)); polyline(silk, W, H, seg, Math.max(0.5 * u, 0.006 * cap), 0.85); }
  }
  const paper = lin('#141418'), silkC = lin('#d9d2c4'), L3 = [-0.5, -0.62, 0.6], ll = Math.hypot(...L3); L3.forEach((v, k) => (L3[k] = v / ll));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, f = 0.96 + 0.06 * fbm(x / (120 * u), y / (120 * u), 2, 3); for (let c = 0; c < 3; c++) I.px[i * 3 + c] = paper[c] * f + (silkC[c] * 0.55 - paper[c] * f) * silk[i]; }
  for (const b of balls) {   // contact shadows
    const sx = b.x + 0.3 * b.r, sy = b.y + 0.4 * b.r, rs = b.r * 1.1;
    for (let y = Math.max(0, Math.floor(sy - rs * 1.6)); y < Math.min(H, sy + rs * 1.6); y++) for (let x = Math.max(0, Math.floor(sx - rs * 1.6)); x < Math.min(W, sx + rs * 1.6); x++) {
      const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / rs, a = 0.5 * Math.exp(-d * d * 1.7), i = (y * W + x) * 3; for (let c = 0; c < 3; c++) I.px[i + c] *= 1 - a;
    }
  }
  const spin = 2 * Math.PI * t;
  // each pearl's mean body colour, for its neighbours to reflect
  for (const b of balls) { const f = filmLinear(420 + 90 * Math.sin(spin + b.ph * 6.28), { n: 1.53 }); b.c = [0.62, 0.6, 0.58].map((q, c) => q * (0.7 + 0.5 * f[c])); }
  for (const b of balls) {
    const nb = []; { const gx = Math.floor(b.x / cell), gy = Math.floor(b.y / cell); for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) for (const o of grid.get((gy + j) * gw + gx + i) ?? []) if (o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 3.2 * b.r) nb.push(o); }
    for (let y = Math.max(0, Math.floor(b.y - b.r - 1)); y < Math.min(H, b.y + b.r + 1); y++) for (let x = Math.max(0, Math.floor(b.x - b.r - 1)); x < Math.min(W, b.x + b.r + 1); x++) {
      const dx = (x + 0.5 - b.x) / b.r, dy = (y + 0.5 - b.y) / b.r, rr = dx * dx + dy * dy, a = clamp((1 - Math.sqrt(rr)) * b.r + 0.5); if (a <= 0) continue;
      const nz = Math.sqrt(Math.max(0, 1 - rr)), lam = Math.max(0, dx * L3[0] + dy * L3[1] + nz * L3[2]);
      const hx = L3[0], hy = L3[1], hz = L3[2] + 1, hl = Math.hypot(hx, hy, hz), spec = Math.pow(Math.max(0, (dx * hx + dy * hy + nz * hz) / hl), 70);
      // two tablet stacks interfere: one thin (the pink/green orient), one thicker (the overtone)
      const th = 1 - nz, f1 = filmLinear(300 + 240 * th + 80 * Math.sin(spin + b.ph * 6.28 + dx * 2), { n: 1.53 }), f2 = filmLinear(620 + 380 * th + 60 * Math.cos(spin + b.ph * 4 + dy * 2), { n: 1.53 });
      const body = [0.8, 0.78, 0.76].map((q, c) => q * (0.16 + 0.84 * lam) * (0.62 + 0.38 * f1[c] + 0.22 * f2[c]));
      // mirror: the reflected ray leaves the rim sideways and meets the neighbour it points at
      let rx = 0, ry = 0, rw = 0; const ox = dx, oy = dy, ol = Math.hypot(ox, oy) || 1;
      for (const o of nb) { const vx = o.x - b.x, vy = o.y - b.y, vl = Math.hypot(vx, vy), al = (ox * vx + oy * vy) / (ol * vl); if (al <= 0) continue; const w8 = Math.pow(al, 10) * Math.min(1, o.r / b.r); rx += w8; rw = Math.max(rw, w8); ry = ry || 0; o._w = w8; }
      let refl = [0, 0, 0]; if (rw > 0) { let s = 0; for (const o of nb) if (o._w > 0) { refl = refl.map((v, c) => v + o.c[c] * o._w); s += o._w; o._w = 0; } refl = refl.map(v => v / s); }
      const graze = Math.pow(1 - nz, 2.2), rim = graze * 0.32;
      const col = body.map((q, c) => q * (1 - 0.55 * graze * Math.min(1, rx)) + refl[c] * 0.55 * graze * Math.min(1, rx) + spec * 1.25 + rim * f1[c]);
      const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) I.px[i + c] += (col[c] - I.px[i + c]) * a;
    }
  }
  return { image: grain(I, { amount: 2, seed: `strung/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text, count: balls.length };
}
