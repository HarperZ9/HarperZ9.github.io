// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 36 orb-crystal (v2 of 13): the aperture as a crystal cabochon. A domed disc of crown glass lies over a field of
// fine concentric line work (the aperture's rings, spacing tightening toward the rim) on black, and ZDH is cut into
// its flat BACK face as intaglio: burin grooves at even distances from each initial's centre line, frosted by the
// cut, read through the dome. The dome magnifies the rings behind it and bends them at its rim; the cut letters
// scatter the light and glow pale against them; a low sun from the upper left focuses through the dome into one hot
// point beside it, the luminous core made by the optics. Consistent with the flagship (30 to 33): same glass, same
// intaglio cut, same light transport (lib/crystal.mjs).
// Sources: the canon's aperture and luminous orb (DESIGN-INSPIRATION), intaglio-cut crystal, the burning glass.
import { setName, NAME } from '../lib/name.mjs';
import { strokesOf, snapJoins, fusedDistance } from '../lib/strokes.mjs';
import { render as crystal, intaglioCuts } from '../lib/crystal.mjs';
import { img, lin, clamp, grain, TAU, fbm } from '../lib/img.mjs';
import { initials } from './13-monogram-orb.mjs';

export const meta = {
  id: 'orb-crystal', title: 'ZDH cut in a crystal cabochon', loop: { seconds: 8, fps: 24, crossfade: 0 }, v1: 'monogram-orb',
  marriage: 'aperture rings x crown-glass cabochon x ZDH intaglio-cut into its back face x sun focused to a point',
  refs: ['DESIGN-INSPIRATION aperture and luminous orb', 'glass optics'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = Math.min(W, H) / 720, R = 0.36 * Math.min(W, H), cx = W / 2, cy = H / 2;
  // the field: concentric rings around the aperture, tightening toward its rim, warm toward the centre
  const P = img(W, H), ground = lin('#0b0b0d'), warm = lin('#f0b77a'), cool = lin('#c9cfd8');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / (1.25 * R), i = (y * W + x) * 3, f = 0.94 + 0.08 * fbm(x / (90 * u), y / (90 * u), 4, 3);
    const k = Math.pow(Math.min(r, 1.6), 0.7) * 52, fr = Math.abs(k - Math.round(k)), pitch = (1.25 * R) / 52 / (0.7 * Math.pow(Math.max(0.05, Math.min(r, 1.6)), -0.3));
    const line = clamp(0.55 * u - fr * pitch + 0.5) * clamp((1.6 - r) / 0.3), tone = clamp(1.1 - r);
    for (let c = 0; c < 3; c++) P.px[i + c] = ground[c] * f + line * (cool[c] + (warm[c] - cool[c]) * tone) * (0.25 + 0.5 * tone);
  }
  const ini = initials(text), N = setName(ini, W, H, { box: [(cx - 0.68 * R) / W, (cy - 0.3 * R) / H, (cx + 0.68 * R) / W, (cy + 0.3 * R) / H], weight: 900, tracking: 10 });
  const cap = N.capPx, half = 0.13 * cap, S = snapJoins(strokesOf(N, Math.max(1, cap / 150)), 1.2 * half);
  const dist = fusedDistance(W, H, S, half * 1.8, half * 0.3), pitch = Math.max(2 * u, cap / 34);
  const { depth, cov } = intaglioCuts(dist, N.mask, W, H, { half, pitch, depth: 0.03 * R, wMin: 0.14, wSpan: 0.55 });
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), mask = new Float32Array(W * H), rough = new Float32Array(W * H);
  const T = 0.42 * R;   // cabochon: a spherical cap, flat back
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r > R + 1) continue;
    mask[i] = clamp(R - r + 0.5); const q = Math.min(1, r / R);
    top[i] = 0.04 * R + T * Math.sqrt(Math.max(0, 1 - q * q)); bot[i] = depth[i]; rough[i] = cov[i] * (0.6 + 0.35 * clamp(depth[i] / (0.02 * R)));
  }
  const az = 45 + 12 * Math.sin(TAU * t);
  const image = crystal(P, { top, bot, mask, rough }, { sun: { az, el: 30, power: 1.2 }, ambient: 0.75, tint: '#f6f2ea', room: '#d9d2c4', ceiling: '#101014', frost: '#efe6d6', maxThick: Math.ceil(T + 0.05 * R) });
  return { image: grain(image, { amount: 1.6, seed: `orbx/${t}`, radius: Math.max(1, Math.round(u)) }), text: `${text} (${N.text})` };
}
