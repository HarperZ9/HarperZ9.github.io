// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// 07 crt-signal: the name as a broadcast ident. An ident card is set in Accession, encoded as 240 lines of
// composite video (YIQ, luma and chroma band limits, sync jitter, snow), then drawn on a curved tube with
// spot bloom, an aperture grille and halation (glass/crt.js). Over the loop the picture rolls once through
// the blanking bar and lands where it began.
import { signal, display } from '../../glass/crt.js';
import { raster } from '../../glass/lib/raster.js';
import { setName, NAME, breakLines } from '../lib/name.mjs';
import { img, lin, clamp, grain, TAU, smooth } from '../lib/img.mjs';

export const meta = {
  id: 'crt-signal', title: 'CRT signal', loop: { seconds: 6, fps: 30, crossfade: 0 },
  marriage: 'composite video encode (YIQ band limits, jitter, snow) x tube display (bloom, grille, halation) x Accession Display',
  refs: ['2026-10-23-feed-test-27/frames', 'glass crt'],
};

function card(text, sw, sh) {
  const S = raster(sw, sh), N = setName(breakLines(text, 2), sw, sh, { box: [0.08, 0.16, 0.92, 0.76], weight: 800, leading: 1.15 });
  const bone = lin('#efe8da'), ground = lin('#0b0c10'), bars = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'].map(lin);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x, u = x / sw, v = y / sh; let c = ground;
    if (v > 0.86 && v < 0.885 && u > 0.1 && u < 0.9) c = bars[Math.min(6, Math.floor((u - 0.1) / 0.8 * 7))];
    const a = N.mask[i];
    for (let k = 0; k < 3; k++) S.data[i * 4 + k] = c[k] + (bone[k] - c[k]) * a;
    S.data[i * 4 + 3] = 1;
  }
  return { S, text: N.text };
}

export function render(W, H, { t = 0, text = NAME } = {}) {
  const u = W / 1280, { S, text: real } = card(text, 1280, 720);
  const sig = signal({ content: 'source', source: S, lines: 300, samples: 900, t: t * 6, roll: t > 0 ? 1 / 6 : 0, seed: 7,
    snow: 0.035, snowChroma: 0.02, jitter: 0.0012, tear: 0.006, lumaCycles: 300, chromaCycles: 80 });
  const D = display(sig, W, H, { curve: 0.07, vignette: 0.5, mask: 0.24, pitch: Math.max(3, Math.round(3 * u)), halation: 0.14, spot: 0.36, bloom: 0.6, exposure: 0.95 });
  const I = img(W, H);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) I.px[i * 3 + c] = D.data[i * 4 + c];
  return { image: grain(I, { amount: 1.2, seed: `crt/${t}`, radius: 1 }), text: real };
}
