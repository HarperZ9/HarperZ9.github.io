// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 31 crystal-rods (flagship variant B): the letters are solid glass rods lying on the security note, bent along the
// forge's centre lines and fused where strokes meet (smooth union, like hot-worked glass). Each rod's surface is cut
// like a turned piece: grooves run along the rod at even steps of ANGLE around its section, so seen from above they
// crowd toward the rod's sides as a lathe pattern does, and their width swells where a raking light leaves the
// section in shadow (intaglio line modulation). A rod resting on paper is a strong cylindrical lens: it magnifies
// the guilloche and the microprint under it (the microprint resolves only there) and focuses the low sun into a
// bright caustic line on the paper beside it.
// Sources: lathe-turned (guilloche) cutting, banknote microprint read through a lens, cylinder optics, the glass
// agent's reeded arch (glass), feed-21 ribbed sheets (stripe density along a surface).
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { strokesOf, snapJoins, fusedDistance, gradientOf } from '../lib/strokes.mjs';
import { note, DARK } from '../lib/note.mjs';
import { render as crystal } from '../lib/crystal.mjs';
import { grain } from '../lib/img.mjs';

export const meta = {
  id: 'crystal-rods', title: 'Engraved glass rods on a note', loop: { seconds: 8, fps: 24, crossfade: 0 }, v1: 'intaglio-lines',
  marriage: 'fused glass rods on paper x lathe-cut grooves (width by raking light) x cylinder-lens magnification x sun caustics',
  refs: ['glass (reeded arch, causticMap)', '2026-10-23-feed-test-21 (ribbed sheets)'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280;
  const N = setName(breakLines(text, 2), W, H, { box: [0.045, 0.12, 0.78, 0.84], weight: 500, tracking: 60, leading: 1.26, align: 'left' });
  const cap = N.capPx, r = 0.1 * cap, S = snapJoins(strokesOf(N, Math.max(1, cap / 150)), 1.25 * r);
  const D = fusedDistance(W, H, S, r + 2, r / 3), { gx, gy } = gradientOf(D, W, H);
  // microprint runs along every line of the name, under the rods, 0.0065 H high: legible only through the glass
  const rows = []; for (const sp of [N.spans[0], N.spans.find(s => s.line === 1)]) { const yb = sp.base / H; for (const f of [-0.62, -0.32]) rows.push([0.04, yb + f * cap / H, 0.8, yb + f * cap / H + 0.0065]); }
  const paper = note(W, H, { text, micro: rows, tintGain: 0.62, palette: DARK }).image;
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), mask = new Float32Array(W * H), rough = new Float32Array(W * H);
  const L = [-0.7, -0.71], steps = 18;          // grooves around the half circle seen from above
  for (let i = 0; i < W * H; i++) {
    const d = D[i]; if (!(d < r + 1)) continue;
    mask[i] = Math.max(0, Math.min(1, r - d + 0.5));
    const q = Math.min(0.999, d / r), z = r * Math.sqrt(1 - q * q);
    top[i] = r + z; bot[i] = r - z;
    // lathe grooves at even angle steps around the section; width by the raking light on that side
    const g = Math.hypot(gx[i], gy[i]) || 1, side = (gx[i] / g) * L[0] + (gy[i] / g) * L[1], phi = Math.asin(q);
    const shade = Math.max(0, Math.min(1, 0.55 + 0.75 * q * side)), ph = phi / Math.PI * steps;
    const f = Math.abs((ph % 1) - 0.5), wd = 0.08 + 0.36 * (1 - shade), v = f < wd ? 0.5 + 0.5 * Math.cos(Math.PI * f / wd) : 0;
    top[i] -= v * r * 0.025 * Math.cos(phi); rough[i] = v * 0.15;
  }
  const az = 45 + 10 * Math.sin(2 * Math.PI * t);
  const image = crystal(paper, { top, bot, mask, rough }, { sun: { az, el: 26, power: 1.3 }, ambient: 0.32, tint: '#eef5f1', room: '#e4e6ea', maxThick: Math.ceil(2 * r) });
  return { image: grain(image, { amount: 1.6, seed: `rods/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
