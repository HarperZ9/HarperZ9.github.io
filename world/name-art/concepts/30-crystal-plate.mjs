// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 30 crystal-plate (flagship variant A): a thick plate of crown glass lies on a security note, and the name is cut
// into its BACK face as intaglio: V-grooves at even distances from each letter's centre line, wider and deeper where
// a raking light leaves the stroke's round section in shadow. Read through the plate, a shallow groove's two walls
// show the note's guilloche twice (doubled and frosted), and a deep groove traps the ray and sparkles. A low sun
// from the upper left throws the cut lines onto the paper as light and shadow. In the lower right corner of the
// plate a latent ZDH is cut as one-sided ramps on the top face: it shows only as a glint when the sun stands at its
// angle (the intaglio latent image, rebuilt from the optics, not printed).
// Sources: wheel-engraved and intaglio-cut crystal (cuts read through the glass), banknote latent images and line
// modulation, caustics (feed set 27 floor under the door, glass causticMap).
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { strokesOf, snapJoins, fusedDistance } from '../lib/strokes.mjs';
import { note, DARK } from '../lib/note.mjs';
import { render as crystal, intaglioCuts } from '../lib/crystal.mjs';
import { grain } from '../lib/img.mjs';

export const meta = {
  id: 'crystal-plate', title: 'Name cut into a glass plate', loop: { seconds: 8, fps: 24, crossfade: 0 }, v1: 'intaglio-lines',
  marriage: 'intaglio cut into the back of a crown-glass plate x V-groove optics (doubling, frost, sparkle) x sun caustics x latent image',
  refs: ['2026-10-23-feed-test-27 (caustic floor)', 'glass (causticMap)', '2026-10-23-feed-test-20 dNmX (line engraving)'],
};

export const plateBox = [0.035, 0.11, 0.79, 0.89];

export function render(W, H, { t = 0, text = NAME, sunAz = null } = {}) {
  const P = plateBox, u = W / 1280;
  const N = setName(breakLines(text, 2), W, H, { box: [P[0] + 0.03, P[1] + 0.07, P[2] - 0.025, P[3] - 0.07], weight: 900, tracking: 10, leading: 1.2, align: 'left' });
  const cap = N.capPx, half = cap * 0.13, S = snapJoins(strokesOf(N, Math.max(1, cap / 150)), 1.2 * half);
  const dist = fusedDistance(W, H, S, half * 1.8, half * 0.3);
  const pitch = Math.max(2.4 * u, cap / 40), { depth, cov } = intaglioCuts(dist, N.mask, W, H, { half, pitch, depth: 0.006 * H, wMin: 0.14, wSpan: 0.55 });
  // microprint: one row above the name and one below it, clear of the letters, legible only at full size
  const rows = [[P[0] + 0.03, P[1] + 0.035, P[2] - 0.03, P[1] + 0.0425], [P[0] + 0.03, P[3] - 0.045, P[2] - 0.17, P[3] - 0.0375]];
  const paper = note(W, H, { text, micro: rows, tintGain: 0.62, palette: DARK }).image;
  // the plate: flat top with a bevelled rim, rounded corners
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), mask = new Float32Array(W * H), rough = new Float32Array(W * H);
  const T = 0.034 * H, bev = 0.022 * H, rad = 0.03 * H, x0 = P[0] * W, y0 = P[1] * H, x1 = P[2] * W, y1 = P[3] * H;
  const lat = setName('ZDH', W, H, { box: [P[2] - 0.13, P[3] - 0.13, P[2] - 0.03, P[3] - 0.04], weight: 900, tracking: 20 });
  const az = ((sunAz ?? 45) + 12 * Math.sin(2 * Math.PI * t)) * Math.PI / 180, EL = 52, el = EL * Math.PI / 180;   // a high sun: short throw, no ghost copy
  // latent ramps: their slope is the half-vector of the view and the sun at the still's sun angle (45 degrees)
  const S0 = [Math.cos(Math.PI / 4) * Math.cos(el), Math.sin(Math.PI / 4) * Math.cos(el), -Math.sin(el)], Hv = [-S0[0], -S0[1], 1 - S0[2]];
  const gL = [-Hv[0] / Hv[2], -Hv[1] / Hv[2]], gl = Math.hypot(...gL), lp = Math.max(3 * u, cap / 60);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, qx = Math.max(x0 + rad - x, 0, x - (x1 - rad)), qy = Math.max(y0 + rad - y, 0, y - (y1 - rad));
    const sd = Math.hypot(qx, qy) - rad;            // signed distance to the rounded rectangle, negative inside
    if (sd > 1) continue;
    mask[i] = Math.max(0, Math.min(1, 0.5 - sd));
    const inn = -sd, b = Math.min(1, inn / bev);
    top[i] = T * (0.7 + 0.3 * Math.sqrt(Math.max(0, b * (2 - b))));
    // the latent ZDH: one-sided ramps on the top face, a few microns of glass in the real thing
    const lm = lat.mask[i]; if (lm > 0) { const pr = (x * gL[0] + y * gL[1]) / gl, f = ((pr % lp) + lp) % lp; if (f < 0.12 * lp) top[i] += lm * gl * f; }
    bot[i] = depth[i]; rough[i] = cov[i] * (0.55 + 0.4 * Math.min(1, depth[i] / (0.008 * H)));   // wheel-cut walls are matte: depth sets the frost
  }
  const image = crystal(paper, { top, bot, mask, rough }, { sun: { az: az * 180 / Math.PI, el: EL, power: 1.1 }, ambient: 0.36, tint: '#f0f6f2', room: '#e4e6ea' });
  return { image: grain(image, { amount: 1.6, seed: `plate/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
