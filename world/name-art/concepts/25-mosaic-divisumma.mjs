// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 25 mosaic-divisumma (v2 of 06, the code mosaic): the name as solid letters whose every face is a field of tiny
// dense text, the tile of the mosaic being one character.
//   - Divisumma 26 (Olivetti, study st-rronberishagrit): a shape filled with "1234567890" in three face colours,
//     pink, white and ochre, on black, line pitch about 1% of the sheet, with deliberate misprints. Here the front
//     face carries our own engine source (lib/mosaic, the lettering, the glass optics) and the two side faces carry
//     the digit string, with the "13345" fault at 2%.
//   - Elettrosumma 22: a solid whose three faces are lit by one light, drawn dimetric (edges near 35 degrees, light
//     to mid side ratio 3.8 to 1). The letters are extruded along 35 degrees; which side a pixel belongs to follows
//     the letter edge it was swept from.
//   - Albers, plate XX-1 (Weber-Fechner): the extrusion is a stack of translucent sheets, and each added sheet is a
//     smaller step (L* follows ln(depth)), so the sides band like the plate.
//   - Olivetti "De A a Z" overprint: the front face is trapped (spread) over the sides and overprints them by
//     multiplication in linear light, as process inks do.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { textField } from '../lib/mosaic/textfield.mjs';
import { engineSource } from '../lib/mosaic/codecells.mjs';
import { img, lin, clamp, grain, fbm } from '../lib/img.mjs';

export const meta = {
  id: 'mosaic-divisumma', title: 'Code mosaic, Olivetti solids', loop: null, v1: 'code-mosaic',
  marriage: 'dimetric solid letters (Elettrosumma) x faces of dense text, source code and digits with misprints (Divisumma 26) x Weber-Fechner sheet stack (Albers XX-1) x overprint trap',
  refs: ['library SYNTHESIS-FLOW section 6 (Olivetti)', 'CONCEPT-LAYERS Weber-Fechner (Albers XX-1)'],
};

const INK = { white: '#f1ece0', pink: '#ef8e9c', ochre: '#d9952a', ground: '#0d0d10' };
let SOURCE = null;

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, I = img(W, H), K = 10, ang = 35 * Math.PI / 180;
  const N = setName(breakLines(text, 2), W, H, { box: [0.035, 0.07, 0.92, 0.84], weight: 900, tracking: 60, leading: 1.3, sdf: true });
  const cap = N.capPx, depth = 0.15 * cap, vx = Math.cos(ang) * depth, vy = Math.sin(ang) * depth;
  // the sheet stack: how many offset copies of the letter cover each pixel, and which edge the nearest came from
  const count = new Uint8Array(W * H), sideN = new Float32Array(W * H * 2);
  const at = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 1 || yi < 1 || xi >= W - 1 || yi >= H - 1 ? 1e9 : N.sdf[yi * W + xi]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (N.mask[i] > 0.5) continue;
    for (let k = 1; k <= K; k++) {
      const sx = x - vx * k / K, sy = y - vy * k / K, d = at(sx, sy);
      if (d < 0) { count[i]++; if (count[i] === 1) { const g = [at(sx + 1, sy) - at(sx - 1, sy), at(sx, sy + 1) - at(sx, sy - 1)], l = Math.hypot(...g) || 1; sideN[i * 2] = g[0] / l; sideN[i * 2 + 1] = g[1] / l; } }
    }
  }
  SOURCE ??= engineSource();
  const pitch = Math.max(5, 0.05 * cap);
  const front = textField(W, H, { text: SOURCE, pitch, aspect: 0.56, weight: 900, glitch: 0, mask: N.mask });
  const sideMask = new Float32Array(W * H); for (let i = 0; i < W * H; i++) sideMask[i] = count[i] ? 1 : 0;
  const side = textField(W, H, { text: '1234567890', pitch: pitch * 0.92, aspect: 0.6, weight: 600, angle: ang, glitch: 0.02, seed: 3, mask: sideMask });
  const g = lin(INK.ground), wh = lin(INK.white), pk = lin(INK.pink), oc = lin(INK.ochre), trap = Math.max(0.6, 0.6 * u);
  const Lt = [Math.cos(-2.4), Math.sin(-2.4)];   // one light from the upper left: Elettrosumma's light-to-mid ratio
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, f = 0.95 + 0.07 * fbm(x / (160 * u), y / (160 * u), 7, 3);
    let c = g.map(v => v * f);
    if (count[i]) {
      // which side: an edge facing down is the ochre face, one facing right the pink face (the dimetric pair)
      const nx = sideN[i * 2], ny = sideN[i * 2 + 1], face = ny > Math.abs(nx) * 0.7 ? oc : pk;
      const lit = 0.55 + 0.45 * clamp(-(nx * Lt[0] + ny * Lt[1]) * 0.5 + 0.5);
      // Weber-Fechner: each added sheet a smaller step, L* in ln(depth)
      const step = Math.log(1 + count[i]) / Math.log(1 + K);
      const base = face.map((v, q) => g[q] + (v - g[q]) * 0.2 * step * lit);
      c = base.map((v, q) => v + (face[q] * lit - v) * side[i] * (0.55 + 0.45 * step));
    }
    // the front face, spread by the trap over the sides; where it lies on a side it overprints (multiplies)
    const fm = clamp(trap - N.sdf[i] + 0.5);
    if (fm > 0) {
      const under = count[i] ? c : null, faceTone = wh.map((v, q) => g[q] + (v - g[q]) * 0.07);
      let fc = faceTone.map((v, q) => v + (wh[q] - v) * front[i]);
      if (under && N.sdf[i] > -0.5) fc = fc.map((v, q) => v * (under[q] / Math.max(1e-3, wh[q])));
      c = c.map((v, q) => v + (fc[q] - v) * fm);
    }
    I.px.set(c, i * 3);
  }
  return { image: grain(I, { amount: 1.4, seed: 'divisumma', radius: Math.max(1, Math.round(u)) }), text: N.text };
}
