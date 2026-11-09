// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 33 intaglio-orb (flagship variant D): the engraved note (16, the letters made of burin cuts) with a solid crystal
// sphere resting on it. A sphere touching the paper is a strong magnifier (about n / (2 - n), three times for crown
// glass), so the guilloche, the burin cuts and the microprint swell and bend inside it, and the microprint, too small
// to read on the note, resolves there. The low sun is focused by the same sphere into one bright point on the paper:
// the aperture and its luminous core, made by optics rather than drawn. The note stays legible ink on cream; the
// glass is the event on it.
// Sources: banknote microprint read through a lens, the burning-glass and the reading stone (a sphere or cap of
// glass laid on text), the canon's aperture and luminous orb (DESIGN-INSPIRATION), caustics (feed set 27).
import { NAME } from '../lib/name.mjs';
import { render as engraved } from './16-intaglio-lines.mjs';
import { render as crystal } from '../lib/crystal.mjs';
import { grain } from '../lib/img.mjs';

export const meta = {
  id: 'intaglio-orb', title: 'Crystal sphere on an engraved note', loop: { seconds: 8, fps: 24, crossfade: 0 }, v1: 'intaglio-lines',
  marriage: 'intaglio note (burin-cut letters) x crystal sphere magnifier x sun focused to a point (burning glass)',
  refs: ['DESIGN-INSPIRATION: aperture / luminous orb', '2026-10-23-feed-test-27 (caustic floor)', 'glass (optics)'],
};

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, base = engraved(W, H, { text, noGrain: true });
  // the sphere rests on the microprint rule, clear of the name, between it and the medallion
  const Rb = 0.16 * H, cx = 0.705 * W, cy = 0.845 * H;
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), mask = new Float32Array(W * H);
  for (let y = Math.max(0, Math.floor(cy - Rb - 2)); y < Math.min(H, cy + Rb + 2); y++) for (let x = Math.max(0, Math.floor(cx - Rb - 2)); x < Math.min(W, cx + Rb + 2); x++) {
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), i = y * W + x; if (r > Rb + 1) continue;
    mask[i] = Math.max(0, Math.min(1, Rb - r + 0.5));
    const z = Math.sqrt(Math.max(0, Rb * Rb - r * r)); top[i] = Rb + z; bot[i] = Rb - z;
  }
  const az = 45 + 14 * Math.sin(2 * Math.PI * t);
  const image = crystal(base.image, { top, bot, mask, rough: null }, { sun: { az, el: 42, power: 0.7 }, ambient: 0.95, tint: '#fbfdfc', room: '#f2f1ec', ceiling: '#5a5852', maxThick: Math.ceil(2 * Rb) });
  return { image: grain(image, { amount: 2.2, seed: `orb/${t}`, radius: Math.max(1, Math.round(u * 1.2)) }), text: base.text };
}
