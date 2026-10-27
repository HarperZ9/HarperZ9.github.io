// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// tesserae.mjs: how each tile meets the light. A tile is a small slab with a softly rounded top (the dome rises from
// the joint), set in grout at its own small tilt: Byzantine setters pressed smalti and gold tesserae in at varied
// angles so a wall flickers as you walk past. Materials:
//   stone    matte marble or limestone: colour drift per tile, Lambert light, no gloss
//   smalti   cast glass: saturated, glossy (a tight highlight), a little light from inside, seed bubbles
//   gold     gold leaf under a glass skin: the colour is the reflection, so a tile facing the light is bright gold
//            and one tilted away is brown; tilt decides everything
//   code     a stone tile carrying a glyph (codecells.mjs supplies the ink coverage)
// The grout is a recessed mortar: darker near tile edges (ambient occlusion from the joint distance).
// Pure; node or browser.
import { img, lin, clamp, hash2 } from '../img.mjs';

/**
 * shade(W, H, layout, { zones: [field, halo, letter] each { material, colours: ['#hex', ...], tilt (rad), dome
 *        (share of tile), gloss, bands (colour by course index, for echo ripples) }, light: [x, y, z] toward the light, grout: '#hex', ink?: Float32Array, inkColour })
 * -> linear picture (lib/img.mjs)
 */
export function shade(W, H, layout, o) {
  const { key, zone, joint, grout, tiles, tile } = layout;
  const L = norm(o.light ?? [-0.55, -0.6, 0.6]), Hh = norm([L[0], L[1], L[2] + 1]), G = lin(o.grout ?? '#6d675d');
  const zs = o.zones.map(z => ({ ...z, cols: z.colours.map(lin), inkC: z.inkColour ? lin(z.inkColour) : null })), inkC = o.inkColour ? lin(o.inkColour) : null;
  const I = img(W, H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, t = tiles[key[i]], Z = zs[zone[i]];
    // tile normal: its set tilt plus the dome falling toward its joints
    const R = Math.max(1.5, (Z.dome ?? 0.3) * tile), j = joint[i], slope = j < R ? (1 - j / R) * 0.9 : 0;
    const gx = joint[i + 1] - joint[i - 1], gy = joint[i + W] - joint[i - W], gl = Math.hypot(gx, gy) || 1;
    const ta = (Z.tilt ?? 0.08), ang = t.h1 * 6.283;
    let nx = Math.cos(ang) * ta * t.h2 * 1.6 - (gx / gl) * slope, ny = Math.sin(ang) * ta * t.h2 * 1.6 - (gy / gl) * slope;
    const N = norm([nx, ny, 1]);
    const ndl = Math.max(0, dot(N, L)), ndh = Math.max(0, dot(N, Hh));
    const base = Z.bands ? Z.cols[((t.band % Z.cols.length) + Z.cols.length) % Z.cols.length] : Z.cols[Math.floor(t.h3 * Z.cols.length) % Z.cols.length], drift = 0.9 + 0.2 * t.h2;
    let c;
    if (Z.material === 'gold') {
      const facing = Math.pow(ndh, 18) * 1.8 + Math.pow(ndh, 4) * 0.55;
      c = base.map(v => v * (0.16 + facing) * drift);
    } else if (Z.material === 'smalti') {
      const bub = hash2(x >> 1, y >> 1, key[i]) > 0.996 ? 1.25 : 1;
      c = base.map(v => v * (0.38 + 0.62 * ndl) * drift * bub + (Z.gloss ?? 0.5) * Math.pow(ndh, 60) * 1.2 + 0.03 * v);
    } else {
      c = base.map(v => v * (0.3 + 0.7 * ndl) * drift + (Z.gloss ?? 0.04) * Math.pow(ndh, 12));
    }
    if (o.ink && o.ink[i] > 0 && (inkC || Z.inkC)) { const a = o.ink[i] * (Z.inkGain ?? 1); c = c.map((v, q) => v + ((Z.inkC ?? inkC)[q] - v) * a); }
    // grout: recessed, darker toward the tile edges
    const g = grout[i], ao = 0.55 + 0.45 * clamp(j / 2.5);
    for (let q = 0; q < 3; q++) I.px[i * 3 + q] = c[q] * (1 - g) + G[q] * ao * g;
  }
  return I;
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
