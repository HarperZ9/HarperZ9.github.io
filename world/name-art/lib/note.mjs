// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// note.mjs: the security-note paper that the glass pieces lie on. Warm stock with fibres, a waving line tint (the
// moire base of a real note), guilloche cords along the top and bottom, a medallion of phase-stepped rings, and rows
// of microprint of the text at a cap height too small to read unaided, so it resolves only through a lens.
// Returns a linear picture (lib/img.mjs) plus the ink coverages, so a piece can light the paper before it inks it.
import { setName, NAME } from './name.mjs';
import { img, lin, clamp, fbm, hash2, TAU } from './img.mjs';
import { polyline, ring } from './draw.mjs';

export const NOTE = Object.freeze({ paper: '#ece3cf', ink: '#183b33', ink2: '#4c3a5e', spot: '#d2462b' });
// The dark field: a deep green stock printed in pale inks, the way engraved crystal is shown on black so its cuts glow.
export const DARK = Object.freeze({ paper: '#30493f', ink: '#c9d6c4', ink2: '#5f7d70', spot: '#d2462b' });

/**
 * note(W, H, { text, medallion: { x, y, r } shares or null, micro: [[x0, y0, x1, y1], ...] boxes (shares), seal })
 * -> { image, tint, ink, spotCov }  image is the inked paper in linear light.
 */
export function note(W, H, { text = NAME, medallion = { x: 0.895, y: 0.5, r: 0.17 }, micro = [], seal = true, tintGain = 0.55, palette = NOTE } = {}) {
  const u = W / 1280, I = img(W, H), paper = lin(palette.paper), ink = lin(palette.ink), ink2 = lin(palette.ink2), spot = lin(palette.spot);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, f = fbm(x / (90 * u), y / (90 * u), 3, 4), fib = hash2(x >> 1, y, 9) > 0.9985 ? 0.9 : 1;
    for (let c = 0; c < 3; c++) I.px[i + c] = paper[c] * (0.93 + 0.1 * f) * fib;
  }
  const tint = new Float32Array(W * H), cov = new Float32Array(W * H), spotCov = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ph = y / (3.2 * u) + 2.2 * Math.sin(x / (110 * u)) + 1.3 * Math.sin(x / (37 * u) + y / (300 * u));
    const d = Math.abs((ph % 1 + 1) % 1 - 0.5) * 3.2 * u, wdt = 0.22 * u + 0.25 * u * (0.5 + 0.5 * Math.sin(x / (240 * u)));
    tint[y * W + x] = clamp(wdt + 0.5 - d) * tintGain;
  }
  if (medallion) {
    const m = { x: medallion.x * W, y: medallion.y * H, r: medallion.r * H };
    for (let k = 0; k < 34; k++) {
      const r0 = m.r * (0.3 + k * 0.019), a = m.r * 0.034, ph = k * 0.31, pts = [];
      for (let i = 0; i <= 2400; i++) { const t = i / 2400 * TAU, rr = r0 + a * Math.sin(24 * t + ph); pts.push([m.x + rr * Math.cos(t), m.y + rr * Math.sin(t)]); }
      polyline(cov, W, H, pts, 0.3 * u + 0.12 * u * (k % 3 === 0), 0.95);
    }
    for (let k = 0; k < 14; k++) ring(cov, W, H, m.x, m.y, m.r * (0.07 + k * 0.0145), 0.3 * u, 0.9);
    ring(cov, W, H, m.x, m.y, m.r * 1.02, 1.1 * u); ring(cov, W, H, m.x, m.y, m.r * 1.06, 0.4 * u);
    if (seal) { const S = setName('ZDH', W, H, { box: [medallion.x - 0.035, medallion.y - 0.038, medallion.x + 0.035, medallion.y + 0.038], weight: 900, tracking: -10 }); for (let i = 0; i < W * H; i++) spotCov[i] = S.mask[i] * 0.9; }
  }
  for (const yb of [0.07 * H, 0.93 * H]) for (let k = 0; k < 9; k++) {
    const pts = []; for (let x = 0; x <= W; x += 2 * u) pts.push([x, yb + 0.022 * H * Math.sin(x / (26 * u) + k * TAU / 9) * Math.sin(x / (380 * u) + 1)]);
    polyline(cov, W, H, pts, 0.36 * u, 0.9);
  }
  for (const b of micro) {
    const M = setName(Array(40).fill(text).join('  '), W, H, { box: b, style: 'mono', weight: 500, fit: 'width', align: 'left', sub: 2 });
    for (let i = 0; i < W * H; i++) cov[i] = Math.max(cov[i], M.mask[i] * 0.9);
  }
  for (let i = 0; i < W * H; i++) {
    const p = I.px, k = i * 3;
    for (let c = 0; c < 3; c++) { let v = p[k + c]; v += (ink2[c] - v) * tint[i]; v += (ink[c] - v) * cov[i]; v += (spot[c] - v) * spotCov[i]; p[k + c] = v; }   // inks laid over the stock
  }
  return { image: I, tint, ink: cov, spotCov };
}
