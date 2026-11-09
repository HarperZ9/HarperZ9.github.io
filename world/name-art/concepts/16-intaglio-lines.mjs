// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 16 intaglio-lines (v2 of 02): the letters are made of the engraving lines themselves, with no outline. Each
// letter is a bundle of burin cuts running along its own centre lines (iso-distance lines of the forge skeleton,
// so a stroke end turns as a hairpin), their width swelling where a raking light leaves the stroke's rounded
// section in shadow. The note's tint lines stop where the letters begin; the letter edge is only where cuts end. Around it: guilloche rosettes (hypotrochoid families), a
// line tint that waves, a medallion where a portrait would sit (the canon's aperture as concentric guilloche),
// and microprinting of the name itself. Two inks plus one spot colour.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, smooth, fbm, hash2, grain, TAU, random } from '../lib/img.mjs';
import { polyline, ring } from '../lib/draw.mjs';
import { strokesOf, rods } from '../lib/strokes.mjs';

export const meta = {
  id: 'intaglio-lines', title: 'Letters cut as engraving', loop: null, v1: 'banknote',
  marriage: 'burin cuts along the letter centre lines (no outline, width by a raking light) x guilloche x microprint',
  refs: ['techniques (burin)', 'feed sets 20 to 25 engraving notes'],
};

const PAPER = '#ece3cf', INK = '#183b33', INK2 = '#4c3a5e', SPOT = '#d2462b';

// Hypotrochoid rosette, n petals, as a polyline of [x, y].
function rosette(cx, cy, R, r, d, turns, steps, rot = 0) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps * TAU * turns;
    const x = (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t), y = (R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t);
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

export function render(W, H, { text = NAME, noGrain = false } = {}) {
  const u = W / 1280, I = img(W, H), paper = lin(PAPER), ink = lin(INK), ink2 = lin(INK2), spot = lin(SPOT);
  // paper: warm stock with fibres and a faint watermark-like cloud
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, f = fbm(x / (90 * u), y / (90 * u), 3, 4), fib = hash2(x >> 1, y, 9) > 0.9985 ? 0.9 : 1;
    for (let c = 0; c < 3; c++) I.px[i + c] = paper[c] * (0.93 + 0.1 * f) * fib;
  }
  const cov2 = new Float32Array(W * H), cov1 = new Float32Array(W * H), covS = new Float32Array(W * H);
  // line tint: horizontal hairlines that swell into a wave band (anti-copy moire base)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ph = y / (3.2 * u) + 2.2 * Math.sin(x / (110 * u)) + 1.3 * Math.sin(x / (37 * u) + y / (300 * u));
    const d = Math.abs((ph % 1 + 1) % 1 - 0.5) * 3.2 * u, wdt = 0.22 * u + 0.25 * u * (0.5 + 0.5 * Math.sin(x / (240 * u)));
    cov2[y * W + x] = clamp(wdt + 0.5 - d) * 0.55;
  }
  // guilloche: a border band and a medallion
  const R = random('banknote');
  const med = { x: 0.895 * W, y: 0.5 * H, r: 0.17 * H };
  // classic guilloche: concentric rings, each radially modulated, phase stepped ring to ring, so they weave a lattice
  for (let k = 0; k < 34; k++) {
    const r0 = med.r * (0.3 + k * 0.019), a = med.r * 0.034, n = 24, ph = k * 0.31, pts = [];
    for (let i = 0; i <= 2400; i++) { const t = i / 2400 * TAU, rr = r0 + a * Math.sin(n * t + ph); pts.push([med.x + rr * Math.cos(t), med.y + rr * Math.sin(t)]); }
    polyline(cov1, W, H, pts, 0.3 * u + 0.12 * u * (k % 3 === 0), 0.95);
  }
  for (let k = 0; k < 14; k++) ring(cov1, W, H, med.x, med.y, med.r * (0.07 + k * 0.0145), 0.3 * u, 0.9);
  ring(cov1, W, H, med.x, med.y, med.r * 1.02, 1.1 * u); ring(cov1, W, H, med.x, med.y, med.r * 1.06, 0.4 * u);
  // border: a running wave of interlaced sine cords top and bottom
  for (const yb of [0.07 * H, 0.93 * H]) for (let k = 0; k < 9; k++) {
    const pts = []; for (let x = 0; x <= W; x += 2 * u) pts.push([x, yb + 0.022 * H * Math.sin(x / (26 * u) + k * TAU / 9) * Math.sin(x / (380 * u) + 1)]);
    polyline(cov1, W, H, pts, 0.36 * u, 0.9);
  }
  // the name: cuts along each centre line, at even distances from it, ending where the letter ends
  const N = setName(breakLines(text, 2), W, H, { box: [0.045, 0.1, 0.77, 0.84], weight: 900, tracking: 10, leading: 1.2, align: 'left' });
  const S = strokesOf(N, Math.max(1, N.capPx / 150)), half = N.capPx * 0.13, { dist } = rods(W, H, S, half * 1.6);
  const pitch = Math.max(2.2 * u, N.capPx / 52), L = [-0.7, -0.71];
  // the tint stops short of the letters, so the letter is read by where the line direction changes
  const keep = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) keep[i] = N.mask[i];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, m = N.mask[i]; if (m <= 0) continue;
    const d = dist[i], gx = (dist[i + 1] - dist[i - 1]) / 2, gy = (dist[i + W] - dist[i - W]) / 2, g = Math.hypot(gx, gy) || 1;
    // the stroke as a rounded section: its surface tilts away from the centre line, more toward the edge
    const tilt = Math.min(1, d / half), shade = clamp(0.55 + 0.75 * tilt * (gx / g * L[0] + gy / g * L[1]) - 0.15 * tilt * tilt);
    const ph = d / pitch, frac = Math.abs((ph % 1 + 1) % 1 - 0.5) * pitch, wdt = pitch * (0.14 + 0.72 * (1 - shade));
    covS[i] = clamp(wdt / 2 + 0.5 - frac) * m;
  }
  for (let i = 0; i < W * H; i++) if (keep[i] > 0) cov2[i] *= 1 - keep[i];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // a clear margin of two pitches around every letter
    const i = y * W + x; if (cov2[i] === 0) continue; let near = 0; const r = Math.ceil(1.6 * pitch);
    for (let dy = -r; dy <= r && !near; dy += 2) for (let dx = -r; dx <= r; dx += 2) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && N.mask[yy * W + xx] > 0.5) { near = 1; break; } }
    if (near) cov2[i] = 0;
  }
  // microprint of the name along a hairline under the main line (repeat at about 7 px cap height)
  const micro = setName(Array(9).fill(text).join('  '), W, H, { box: [0.045, 0.865, 0.79, 0.879], style: 'mono', weight: 500, fit: 'width', sub: 2 });
  for (let i = 0; i < W * H; i++) cov1[i] = Math.max(cov1[i], micro.mask[i] * 0.95);
  // denomination-style numerals replaced by the monogram letters in a spot-colour seal
  const seal = setName('ZDH', W, H, { box: [0.86, 0.462, 0.93, 0.538], weight: 900, tracking: -10 });
  for (let i = 0; i < W * H; i++) {
    const p = I.px, k = i * 3, a = cov2[i] * 0.55, b = cov1[i] * 0.92, s = covS[i] * 0.95, e = seal.mask[i] * 0.9;
    for (let c = 0; c < 3; c++) {
      let v = p[k + c];
      v *= 1 - a * (1 - ink2[c]);
      v *= 1 - b * (1 - ink[c]);
      v *= 1 - s * (1 - ink[c] * 0.22);
      v *= 1 - e * (1 - spot[c]);
      p[k + c] = v;
    }
  }
  // intaglio ink sits slightly proud: a dark rim pooled where the cut ends (micro shading by coverage gradient)
  return { image: noGrain ? I : grain(I, { amount: 2.4, seed: 'note', radius: Math.max(1, Math.round(u * 1.2)) }), text: N.text, N };
}
