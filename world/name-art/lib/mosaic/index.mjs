// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lib/mosaic: mosaic as a technique, not a texture. One entry:
//   mosaic(W, H, { text | name, style, tile, halo, grout, light, palette, seed, t })
//     text     any word or name (two lines when it has three words or more); or `name`, a setName result with sdf
//     style    'andamento' (Roman stone: red letters, black outline courses, limestone field)
//              'code'      (every tile is one character of our own source; weight and density carry the tone)
//              'smalti'    (Byzantine: gold-leaf letters set at varied tilts on a lapis glass field)
//              'echo'      (Ravenna: field courses ripple out parallel to the letters, banded in tone)
//              'scales'    (the name made of tiles, each tile a tiny rendering of the name)
//     tile     course width as a share of the cap height (default per style)
//     t        0..1 loop phase; moves the light (smalti flickers as the light passes)
//   -> { image (linear, lib/img.mjs), text, layout }
// Parts: andamento.mjs (where tiles go), tesserae.mjs (how they take the light), codecells.mjs (what they carry).
// New references plug in as a new style: a palette and materials for the three zones, plus an optional ink.
import { setName, NAME, breakLines } from '../name.mjs';
import { strokesOf } from '../strokes.mjs';
import { grain } from '../img.mjs';
import { layTiles } from './andamento.mjs';
import { shade } from './tesserae.mjs';
import { codeInk, imageInk, engineSource } from './codecells.mjs';
export { layTiles, shade, codeInk, imageInk, engineSource };

export const STYLES = Object.freeze({
  andamento: { tile: 0.06, ratio: 1.3, halo: 2, grout: 0.11, groutC: '#7d7466',
    zones: [{ material: 'stone', colours: ['#d3c6ad', '#cbbd9f', '#dacfb9', '#c6b697'], tilt: 0.05, dome: 0.3 },
            { material: 'stone', colours: ['#222329', '#2a2b31', '#1d1e23'], tilt: 0.05, dome: 0.3 },
            { material: 'stone', colours: ['#9c3d26', '#a8472c', '#8f3622', '#b25533', '#973a24'], tilt: 0.05, dome: 0.32 }] },
  code: { tile: 0.042, ratio: 0.6, halo: 1, grout: 0.07, groutC: '#121316', fieldRatio: 0.6, field: 'echo', fieldScale: 1.0,
    zones: [{ material: 'smalti', colours: ['#1d2026', '#1d2026', '#252830', '#1a1c21'], bands: true, tilt: 0.03, dome: 0.2, gloss: 0.15, inkColour: '#59606b' },
            { material: 'smalti', colours: ['#15171b'], tilt: 0.03, dome: 0.2, gloss: 0.15, inkColour: '#8d939c' },
            { material: 'stone', colours: ['#ebe5d6', '#e3dccb', '#efeadf'], tilt: 0.03, dome: 0.22, inkColour: '#17181b' }] },
  smalti: { tile: 0.058, ratio: 1.15, halo: 1, grout: 0.1, groutC: '#2e2b27',
    zones: [{ material: 'smalti', colours: ['#1b2f6b', '#223a80', '#162760', '#2a4590', '#1f3574', '#13224f'], tilt: 0.16, dome: 0.12, gloss: 0.45 },
            { material: 'smalti', colours: ['#a3241c', '#8f1f18'], tilt: 0.16, dome: 0.12, gloss: 0.45 },
            { material: 'gold', colours: ['#e3ad45', '#d69c35', '#eabd62'], tilt: 0.3, dome: 0.1 }] },
  echo: { tile: 0.06, ratio: 1.3, halo: 1, grout: 0.11, groutC: '#5d574d', field: 'echo', fieldScale: 1.0,
    zones: [{ material: 'stone', colours: ['#d9cfbb', '#d9cfbb', '#cbbfa6', '#b9ab90', '#a2937a', '#b9ab90', '#cbbfa6'], bands: true, tilt: 0.05, dome: 0.28 },
            { material: 'stone', colours: ['#1f2025', '#26272d'], tilt: 0.05, dome: 0.3 },
            { material: 'stone', colours: ['#f1ece2', '#e9e2d3', '#f4f0e8', '#e4dccb'], tilt: 0.05, dome: 0.3 }] },
  scales: { tile: 0.1, ratio: 1.5, halo: 1, grout: 0.07, groutC: '#16171a', fieldRatio: 1.5,
    zones: [{ material: 'stone', colours: ['#24262b', '#212328'], tilt: 0.04, dome: 0.2, inkColour: '#4b4f57' },
            { material: 'stone', colours: ['#121316'], tilt: 0.04, dome: 0.2, inkColour: '#30333a' },
            { material: 'stone', colours: ['#ece6d8', '#e5dece'], tilt: 0.04, dome: 0.22, inkColour: '#2a2723' }] },
});

export function mosaic(W, H, { text = NAME, name = null, style = 'andamento', tile = null, halo = null, light = null, seed = 1, t = 0, box = [0.035, 0.07, 0.965, 0.93] } = {}) {
  const S = STYLES[style]; if (!S) throw new Error(`mosaic: no style ${style}`);
  // The two lines keep their outline courses plus one and a half tiles of field between them, at any size.
  const hl = halo ?? S.halo, tl = tile ?? S.tile, clear = (2 * hl + 4.5) * tl, src = text.split(' ').length >= 3 ? breakLines(text, 2) : text;
  const desc = /[gjpqy,]/.test(src.split(String.fromCharCode(10))[0]) ? 0.28 : 0;
  // letters keep their own tracking (the layout's gap rule separates their outlines); the lines open by the clearance
  const N = name ?? setName(src, W, H, { box, weight: 900, tracking: 30, leading: 1 + clear + desc, sdf: true });
  const T = Math.max(3, (tile ?? S.tile) * N.capPx);
  const strokes = strokesOf(N, Math.max(1, T / 6));
  const layout = layTiles(W, H, { sdf: N.sdf, strokes, tile: T, halo: halo ?? S.halo, ratio: S.ratio, grout: Math.max(0.8, S.grout * T), fieldRatio: S.fieldRatio ?? 1, field: S.field ?? 'tessellatum', fieldScale: S.fieldScale ?? 1.15, seed });
  let ink = null;
  if (style === 'code') ink = codeInk(W, H, layout, { cellRatio: S.ratio });
  if (style === 'scales') {
    // letter tiles carry the initials (they resolve at 1920 and up); field tiles carry the whole name, which
    // resolves only at 4K, so the picture changes as you come closer
    const mw = Math.max(8, Math.round(T * S.ratio)), mh = Math.max(4, Math.round(T));
    const small = (txt, box) => { const M = setName(txt, mw * 4, mh * 4, { box, weight: 800 }), o = new Float32Array(mw * mh); for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { let a = 0; for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) a += M.mask[(y * 4 + j) * mw * 4 + x * 4 + k]; o[y * mw + x] = a / 16; } return o; };
    const initials = N.text.split(/\s+/).map(w => w[0]).join('').toUpperCase();
    const inkL = imageInk(W, H, layout, small(initials, [0.16, 0.2, 0.84, 0.8]), mw, mh, { ratio: S.ratio }), inkF = imageInk(W, H, layout, small(N.text, [0.05, 0.3, 0.95, 0.7]), mw, mh, { ratio: S.ratio });
    ink = new Float32Array(W * H); for (let i = 0; i < W * H; i++) ink[i] = layout.zone[i] === 2 ? inkL[i] : inkF[i];
  }
  const az = -2.3 + (t ? Math.sin(t * 6.2832) * 0.5 : 0);
  const L = light ?? [Math.cos(az) * 0.75, Math.sin(az) * 0.75, 0.62];
  const image = shade(W, H, layout, { zones: S.zones, light: L, grout: S.groutC, ink });
  return { image: grain(image, { amount: 1.6, seed: `mosaic/${style}`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text, layout };
}
