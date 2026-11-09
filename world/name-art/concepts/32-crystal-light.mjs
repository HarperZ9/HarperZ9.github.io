// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 32 crystal-light (flagship variant C): the letters are clear, polished glass, cast as low cushions lying on the
// security note, and the engraving is not drawn on anything: it is light. Each cushion carries a faint relief of
// ridges at even distances from the letter's centre lines (the intaglio line field, a few microns proud), too gentle
// to see in the glass itself. A low sun focuses each ridge into a bright line on the paper, so the name is
// engraved in light beside its own clear body, and the guilloche bends and doubles under the cushions.
// Sources: caustics of a figured glass panel (glass causticMap; feed set 27, the caustic floor measured at
// 5.6 times the ground), intaglio line modulation, banknote guilloche under a lens.
import { setName, NAME, breakLines, signedDistance } from '../lib/name.mjs';
import { strokesOf, snapJoins, fusedDistance } from '../lib/strokes.mjs';
import { note, DARK } from '../lib/note.mjs';
import { render as crystal } from '../lib/crystal.mjs';
import { grain } from '../lib/img.mjs';

export const meta = {
  id: 'crystal-light', title: 'Name engraved in light', loop: { seconds: 8, fps: 24, crossfade: 0 }, v1: 'intaglio-lines',
  marriage: 'clear glass cushions x a hidden ridge relief from the intaglio line field x sun caustics that draw the engraving',
  refs: ['glass (causticMap)', '2026-10-23-feed-test-27 (caustic floor)'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280;
  const N = setName(breakLines(text, 2), W, H, { box: [0.04, 0.09, 0.72, 0.74], weight: 900, tracking: 30, leading: 1.2, align: 'left', sdf: true });
  const cap = N.capPx, half = cap * 0.13, S = snapJoins(strokesOf(N, Math.max(1, cap / 150)), 1.2 * half);
  const dist = fusedDistance(W, H, S, half * 1.8, half * 0.3), pitch = Math.max(3 * u, cap / 30);
  const paper = note(W, H, { text, tintGain: 0.62, palette: DARK }).image;
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), mask = new Float32Array(W * H);
  const T = 0.09 * cap, rim = 0.12 * cap, ridge = 0.006 * cap;
  for (let i = 0; i < W * H; i++) {
    const sd = N.sdf[i]; if (sd > 1) continue;
    mask[i] = Math.max(0, Math.min(1, 0.5 - sd));
    const b = Math.min(1, -sd / rim), dome = Math.sqrt(Math.max(0, b * (2 - b)));
    const d = isFinite(dist[i]) ? dist[i] : 0;
    top[i] = T * (0.25 + 0.75 * dome) + ridge * dome * (0.5 + 0.5 * Math.cos(2 * Math.PI * d / pitch));
  }
  const az = 45 + 10 * Math.sin(2 * Math.PI * t);
  const image = crystal(paper, { top, bot, mask, rough: null }, { sun: { az, el: 15, power: 1.4 }, ambient: 0.3, tint: '#f2f7f4', room: '#e4e6ea', maxThick: Math.ceil(T * 1.4 + ridge) });
  return { image: grain(image, { amount: 1.6, seed: `light/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text };
}
