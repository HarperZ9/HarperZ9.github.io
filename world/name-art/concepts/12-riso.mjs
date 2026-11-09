// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 12 riso: the name as a two-ink stencil print with a spot colour. A gradient field of arcs (bands bending
// like a horizon) is screened as amplitude-modulated halftone in two inks at their own screen angles; the
// letters are knocked out of the blue and printed in fluorescent orange, off register. Ink sits on paper:
// dots spread and wander at their edges, ink density varies across the drum, and paper fibres show through.
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, smooth, fbm, hash2, grain, vnoise } from '../lib/img.mjs';

export const meta = {
  id: 'riso', title: 'Two-ink riso with a spot colour', loop: null,
  marriage: 'AM halftone at two screen angles x misregistration x ink spread and drum density x arc gradient field x Accession Display 900',
  refs: ['feed-29/frames (4QeJ arcs)', 'PLAYBOOK 4.6 print'],
};

// AM halftone: is this pixel inked for tone v (0..1 ink) on a screen of pitch p at angle a?
function dot(x, y, v, p, a, wob) {
  const c = Math.cos(a), s = Math.sin(a), X = (x * c + y * s) / p, Y = (-x * s + y * c) / p;
  const fx = X - Math.floor(X) - 0.5, fy = Y - Math.floor(Y) - 0.5, d = Math.hypot(fx, fy) * (1 + wob);
  const r = Math.sqrt(clamp(v) / Math.PI);           // area-proportional radius in cell units
  return clamp((r - d) * p + 0.5);
}

export function render(W, H, { text = NAME } = {}) {
  const u = W / 1280, I = img(W, H);
  const N = setName(breakLines(text, 2), W, H, { box: [0.07, 0.16, 0.93, 0.84], weight: 900, tracking: 10, leading: 1.08, align: 'left' });
  const paper = lin('#efe9dc'), blue = lin('#2a4fb8'), orange = lin('#ff6a2b'), off = [3.2 * u, -2.1 * u];
  const pitch = 6.5 * u;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, fib = 0.965 + 0.05 * fbm(x / (2 * u), y / (14 * u), 4, 3);
    // the field: arcs bending around a point below the frame, bands of tone
    const r = Math.hypot(x - 0.5 * W, y - 1.9 * H) / H, band = 0.5 + 0.5 * Math.sin(r * 9.5), tone = clamp(0.15 + 0.75 * band * (0.65 + 0.35 * (y / H)));
    const wob = 0.12 * (vnoise(x / (1.4 * u), y / (1.4 * u), 2) - 0.5);
    const drum = 0.82 + 0.22 * fbm(x / (300 * u), y / (80 * u), 6, 2);       // uneven ink across the drum
    const knock = N.mask[Math.min(H - 1, Math.max(0, Math.round(y))) * W + x];
    const inkB = dot(x, y, tone, pitch, 0.2618, wob) * drum * (1 - knock) * 0.92;
    // spot colour: solid inside the letters (off register), with a soft screen in the light bands
    const sx = Math.round(x - off[0]), sy = Math.round(y - off[1]);
    const mS = sx >= 0 && sx < W && sy >= 0 && sy < H ? N.mask[sy * W + sx] : 0;
    const inkO = Math.max(mS * (0.9 + 0.1 * hash2(x >> 2, y >> 2, 5)), dot(x, y, clamp(0.35 - tone * 0.4), pitch * 1.4, 1.309, wob) * 0.55) * drum;
    for (let c = 0; c < 3; c++) {
      let v = paper[c] * fib;
      v *= 1 - inkO * (1 - orange[c]);
      v *= 1 - inkB * (1 - blue[c]);
      I.px[i * 3 + c] = v;
    }
  }
  return { image: grain(I, { amount: 2.6, seed: 'riso', radius: Math.max(1, Math.round(u)) }), text: N.text };
}
