// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 02 banknote: the name engraved as intaglio line work on a security note. Inside each letter the burin cuts
// iso-distance lines of the letter's own signed distance field, their width swelling with a raking light across
// the bevel, so the flat letter reads as cut metal. Around it: guilloche rosettes (hypotrochoid families), a
// line tint that waves, a medallion where a portrait would sit (the canon's aperture as concentric guilloche),
// and microprinting of the name itself. Two inks plus one spot colour.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, smooth, fbm, hash2, grain, TAU, random } from '../lib/img.mjs';
import { polyline, ring } from '../lib/draw.mjs';

export const meta = {
  id: 'banknote', title: 'Engraved banknote', loop: null,
  marriage: 'burin line work (contour-parallel cuts, width by tone) x guilloche x microprint x Accession Display 900',
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

export function render(W, H, { text = NAME } = {}) {
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
  const med = { x: 0.82 * W, y: 0.5 * H, r: 0.3 * H };
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
  // the name: contour-parallel burin cuts, width by a raking light across a bevel profile
  const N = setName(breakLines(text, 2), W, H, { box: [0.05, 0.15, 0.6, 0.72], weight: 900, tracking: 4, leading: 1.1, align: 'left', sdf: true });
  const pitch = 2.6 * u, L = [-0.75, -0.62], bev = N.capPx * 0.13;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, d = N.sdf[i];
    if (d > 1.5 * u) continue;
    const gx = (N.sdf[i + 1] - N.sdf[i - 1]) / 2, gy = (N.sdf[i + W] - N.sdf[i - W]) / 2, g = Math.hypot(gx, gy) || 1;
    const slope = clamp(-d / bev), shade = clamp(0.5 + 1.35 * (gx / g * L[0] + gy / g * L[1]) * (1 - slope) + 0.25 * slope);
    let c;
    if (-d < bev) {   // the bevel: contour-parallel cuts, width by the raking light
      const ph = -d / pitch, frac = Math.abs((ph % 1 + 1) % 1 - 0.5) * pitch, wdt = pitch * (0.1 + 0.78 * (1 - shade));
      c = clamp(wdt / 2 + 0.5 - frac) * clamp(0.5 - d);
    } else {          // the face: horizontal cuts, width by a vertical tonal sweep (polished metal)
      const tone = 0.5 + 0.45 * Math.sin((y / N.capPx) * 3.4 + 0.6), ph = y / pitch, frac = Math.abs((ph % 1 + 1) % 1 - 0.5) * pitch;
      c = clamp(pitch * (0.24 + 0.4 * tone) / 2 + 0.5 - frac);
    }
    if (d > -1.4 * u) c = Math.max(c, clamp(1 - Math.abs(d + 0.5 * u) / (0.9 * u)));     // keyline
    covS[i] = c;
  }
  // microprint of the name along a hairline under the main line (repeat at about 7 px cap height)
  const micro = setName(Array(9).fill(text).join('  '), W, H, { box: [0.05, 0.79, 0.6, 0.806], style: 'mono', weight: 500, fit: 'width', sub: 2 });
  for (let i = 0; i < W * H; i++) cov1[i] = Math.max(cov1[i], micro.mask[i] * 0.95);
  // denomination-style numerals replaced by the monogram letters in a spot-colour seal
  const seal = setName('ZDH', W, H, { box: [0.765, 0.43, 0.875, 0.57], weight: 900, tracking: -10 });
  for (let i = 0; i < W * H; i++) {
    const p = I.px, k = i * 3, a = cov2[i] * 0.4, b = cov1[i] * 0.92, s = covS[i] * 0.95, e = seal.mask[i] * 0.9;
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
  return { image: grain(I, { amount: 2.4, seed: 'note', radius: Math.max(1, Math.round(u * 1.2)) }), text: N.text };
}
