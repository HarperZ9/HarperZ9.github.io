// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 13 monogram-orb: ZDH as the canon's aperture. A luminous orb (a warm incandescent disc with a wide, faint
// halo) is drawn entirely in fine concentric line work whose spacing tightens toward the rim, like a lens
// seen edge-on through its coatings; the three initials are cut out of it in Accession Display 900. The same
// geometry, with the line work closed into a solid disc, is the favicon (tools/monogram.mjs).
import { setName, NAME } from '../lib/name.mjs';
import { img, lin, clamp, smooth, mix, grain, TAU, bloom } from '../lib/img.mjs';

export const meta = {
  id: 'monogram-orb', title: 'ZDH aperture orb', loop: { seconds: 8, fps: 24, crossfade: 0 },
  marriage: 'aperture orb (canon recurring form) x generative concentric line work x knockout initials x Accession Display 900',
  refs: ['DESIGN-INSPIRATION aperture and luminous orb', 'feed set 24 construction plates'],
};

export const initials = text => text.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('');

// The mark's geometry, shared with the favicon: orb centre and radius, initials mask.
export function markGeometry(W, H, text = NAME, { scale = 0.36, cap = 0.34 } = {}) {
  const R = scale * Math.min(W, H), cx = W / 2, cy = H / 2;
  const ini = initials(text), half = cap * R;
  const N = setName(ini, W, H, { box: [(cx - R * 0.8) / W, (cy - half * 1.05) / H, (cx + R * 0.8) / W, (cy + half * 1.05) / H], weight: 900, tracking: -6, sdf: true });
  return { R, cx, cy, N, ini };
}

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = Math.min(W, H) / 720, I = img(W, H), { R, cx, cy, N } = markGeometry(W, H, text);
  const ground = lin('#0b0b0d'), core = lin('#ffd9a3'), mid = lin('#e0894a'), rim = lin('#5b2a3a'), line = lin('#f3ead8');
  const breath = 0.5 - 0.5 * Math.cos(TAU * t);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), q = r / R, th = Math.atan2(y - cy, x - cx);
    // halo: wide and faint, outside the disc
    let c = ground.map((g, k) => g + mid[k] * 0.16 * Math.exp(-Math.max(0, q - 1) / 0.35) + core[k] * 0.05 * Math.exp(-q / 1.4));
    if (q < 1.02) {
      // rings at r_k = R sqrt(k / n): spacing tightens toward the rim, like Newton's rings; a slow breath moves them
      const n = 64, s = q * q * n + 0.35 * breath * Math.sin(th * 3 + TAU * t), k = Math.round(s), dist = Math.abs(q - Math.sqrt(Math.max(0, k) / n)) * R;
      const lineCov = clamp(0.5 * Math.max(0.7 * u, 0.9 * u * (1 - q)) + 0.5 - dist) * (k > 0 ? 1 : 0);
      const tone = core.map((v, j) => mix(v * 1.2, mid[j], smooth(0.05, 0.8, q))).map((v, j) => mix(v, rim[j], smooth(0.78, 1, q)));
      const disc = smooth(1.0, 0.995, q);
      const lit = tone.map((v, j) => v * (1 - 0.7 * lineCov));
      c = c.map((v, j) => mix(v, lit[j], disc));
      // the rim: one firm ring at the edge of the aperture
      const rr = clamp(1.2 * u - Math.abs(r - R) + 0.5); c = c.map((v, k) => mix(v, line[k] * 0.9, rr));
    }
    I.px.set(c, i * 3);
  }
  bloom(I, { threshold: 0.6, radius: 18 * u, strength: 0.3, tint: [1, 0.8, 0.6] });
  // initials: cut clean through the orb after the bloom (a cut is a hole, the lens glow does not fill it),
  // with a hairline of light on their edge
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = (i / W) | 0, q = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
    const d = N.sdf[i], cut = clamp(0.5 - d), edge = clamp(1 - Math.abs(d + 0.8 * u) / (0.8 * u)) * (q < 1 ? 1 : 0);
    for (let k = 0; k < 3; k++) { let v = I.px[i * 3 + k]; v += (ground[k] * 0.5 - v) * cut; v += core[k] * 0.5 * edge; I.px[i * 3 + k] = v; }
  }
  return { image: grain(I, { amount: 1.5, seed: `orb/${t}`, radius: Math.max(1, Math.round(u)) }), text: N.text === 'ZDH' ? `${NAME} (ZDH)` : N.text };
}
