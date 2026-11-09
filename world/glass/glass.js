// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// glass.js: real-time refraction of anything behind a glass body. The CPU path here is the reference (tests,
// node renders, the Canvas 2D fallback, the studio plate and the super-framework node); lib/glass-gl.js runs the
// same model in a WebGL2 fragment shader.
//
// Model, per pixel of the body (a height field, lib/body.js):
//   1. the view ray refracts at the front face (normal from the height gradient), crosses the local thickness,
//      exits a flat back face and travels `gap` px to the background plane: a lateral offset per channel, with the
//      channel's own index (Cauchy through n_d and V_d at 650, 532 and 450 nm), so edges fringe by dispersion;
//   2. Beer-Lambert absorption along the path inside, tinted;
//   3. exact Fresnel reflection of an environment (gradient sky plus a key light), with an optional thin-film coat;
//   4. caustics: the same refraction run forward from a light, splatted onto the background and normalised so open
//      ground stays at 1 (energy moves, it is not created);
//   5. a rim term for the dark edge real glass shows when its surroundings are darker than what it refracts.
//
//   const out = renderGlass(bg, body, { glass: 'crown', gap: 120, tint: '#e8f1ee', density: 0.25 });
import { raster, sample, clamp, hexLin, boxBlur, mix } from './lib/raster.js';
import { channelIor, fresnel, reflect, slabOffset } from './lib/optics.js';
import { normalAt } from './lib/body.js';
import { filmLinear } from '../substrate/lib/thinfilm.mjs';

export * from './lib/body.js';
export { pane, pebble, ribbons, flowPaths } from './lib/surface.js';
export { GLASSES, channelIor, fresnel, schlick, slabOffset } from './lib/optics.js';

export const DEFAULTS = Object.freeze({
  glass: 'crown', spread: 1, gap: 120, thicknessScale: 1,
  tint: '#eef4f1', density: 0.18,              // transmittance of 100 px of glass is tint ^ density
  env: { zenith: '#9fb4c4', horizon: '#e9e2d3', ground: '#2a2a2c' },
  key: { dir: [-0.45, -0.55, 0.7], power: 2.2, shine: 90 },
  rim: 0.35,                                    // share of the edge darkening at grazing normals
  soften: 0,                                    // px blur of what is seen through the glass (defocus, light frosting)
  frost: null,                                  // { radius px, taps }: scatter through a frosted face, a jittered disc per pixel
  film: null,                                   // { minNm, maxNm, amount }: thin coat on the front face
  caustic: { strength: 0.9, light: [0.18, -0.25], blur: 1 },
});

const opt = o => ({ ...DEFAULTS, ...o, env: { ...DEFAULTS.env, ...(o?.env ?? {}) }, key: { ...DEFAULTS.key, ...(o?.key ?? {}) },
  caustic: o?.caustic === null ? null : { ...DEFAULTS.caustic, ...(o?.caustic ?? {}) } });

export function envColour(E, R, key) {
  const up = -R[1], z = [hexLin(E.zenith), hexLin(E.horizon), hexLin(E.ground)];
  const t = clamp(up * 1.6), g = clamp(-up * 3);
  const base = up >= 0 ? z[1].map((v, c) => mix(v, z[0][c], t)) : z[1].map((v, c) => mix(v, z[2][c], g));
  const L = key.dir, l = Math.hypot(...L), d = Math.max(0, (R[0] * L[0] + R[1] * L[1] + R[2] * L[2]) / l);
  const s = key.power * d ** key.shine;
  return base.map(v => v + s);
}

// Per-pixel optics for a body: offsets per channel, path, Fresnel and the reflected colour. Shared by the
// renderer, the caustic splat and the SVG displacement map, so all three agree.
export function opticsField(body, o = {}) {
  const p = opt(o), { w, h, mask, height } = body, n = channelIor(p.glass, p.spread);
  const N = w * h, off = new Float32Array(N * 6), path = new Float32Array(N), F = new Float32Array(N), refl = new Float32Array(N * 3), cosv = new Float32Array(N);
  const coat = p.film ? Math.max(1e-6, p.film.amount ?? 0.5) : 0;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    if (mask[i] <= 0) continue;
    const Nn = normalAt(body, x, y), t = height[i] * p.thicknessScale;
    for (let c = 0; c < 3; c++) {
      const s = slabOffset(Nn, n[c], t, p.gap);
      if (s) { off[i * 6 + c * 2] = s.dx; off[i * 6 + c * 2 + 1] = s.dy; if (c === 1) path[i] = s.path; }
      else if (c === 1) path[i] = -1;
    }
    F[i] = fresnel(Nn[2], 1, n[1]); cosv[i] = Nn[2];
    let e = envColour(p.env, reflect([0, 0, -1], Nn), p.key);
    if (coat) {
      // coat thickness follows the slope (a dip-coated film thins on steep faces) with a slow wave over the height
      const u = clamp(1.4 * (1 - Nn[2]) + 0.15 * (1 + Math.sin(height[i] * 0.15)));
      const film = filmLinear(p.film.minNm + (p.film.maxNm - p.film.minNm) * u, { n: 1.38 });
      e = e.map((v, c) => mix(v, v * (0.4 + 1.6 * film[c]), coat));
    }
    refl[i * 3] = e[0]; refl[i * 3 + 1] = e[1]; refl[i * 3 + 2] = e[2];
  }
  return { w, h, off, path, F, refl, cosv, n };
}

// Forward caustic splat: light that crosses the glass lands where its refracted ray hits the background plane.
// Returns per-channel irradiance relative to open ground (1 where nothing is in the way).
export function causticMap(body, field, o = {}) {
  const p = opt(o), { w, h, mask } = body, C = new Float32Array(w * h * 3), tint = hexLin(p.tint);
  const sig = tint.map(v => -Math.log(Math.max(1e-4, v)) * p.density / 100);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const a = mask[i];
    for (let c = 0; c < 3; c++) {
      if (a < 1) splat(C, w, h, x + 0.5, y + 0.5, c, 1 - a);
      if (a > 0 && field.path[i] >= 0) {
        const e = a * (1 - field.F[i]) * Math.exp(-sig[c] * field.path[i]);
        splat(C, w, h, x + 0.5 + field.off[i * 6 + c * 2], y + 0.5 + field.off[i * 6 + c * 2 + 1], c, e);
      }
    }
  }
  const r = p.caustic?.blur ?? 1;
  return r > 0 ? boxBlur(C, w, h, r, { stride: 3, passes: 2 }) : C;
}
function splat(C, w, h, x, y, c, e) {
  x -= 0.5; y -= 0.5; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  for (const [dx, dy, k] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
    const xx = x0 + dx, yy = y0 + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; C[(yy * w + xx) * 3 + c] += e * k;
  }
}

// Light the background with the caustic map, shifted by the light's lateral direction times the gap.
export function lightBackground(bg, C, o = {}) {
  const p = opt(o); if (!p.caustic) return bg;
  const { w, h } = bg, O = raster(w, h), sx = p.caustic.light[0] * p.gap, sy = p.caustic.light[1] * p.gap, k = p.caustic.strength;
  const CF = { w, h, data: C };
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    for (let c = 0; c < 3; c++) {
      const L = sampleC(CF, x + 0.5 - sx, y + 0.5 - sy, c);
      O.data[i * 4 + c] = bg.data[i * 4 + c] * (1 + k * (L - 1));
    }
    O.data[i * 4 + 3] = bg.data[i * 4 + 3];
  }
  return O;
}
function sampleC(F, x, y, c) {
  const { w, h, data } = F; if (x < 0 || y < 0 || x >= w || y >= h) return 1;
  x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = (y0 * w + x0) * 3 + c;
  return (data[i] * (1 - fx) + data[i + 3] * fx) * (1 - fy) + (data[i + w * 3] * (1 - fx) + data[i + w * 3 + 3] * fx) * fy;
}

// The whole glass: background (lit by caustics) seen through the body, plus reflection and rim. Returns a raster.
export function renderGlass(bg, body, o = {}) {
  const p = opt(o);
  if (bg.w !== body.w || bg.h !== body.h) throw new RangeError(`glass: background ${bg.w} x ${bg.h} and body ${body.w} x ${body.h} differ`);
  const field = opticsField(body, p), lit = p.caustic ? lightBackground(bg, causticMap(body, field, p), p) : bg;
  const { w, h, mask } = body, O = raster(w, h), tint = hexLin(p.tint);
  const sig = tint.map(v => -Math.log(Math.max(1e-4, v)) * p.density / 100);
  const fr = p.frost?.radius > 0 ? { r: p.frost.radius, n: p.frost.taps ?? 8 } : null;
  const seen = p.soften > 0 ? { w, h, data: boxBlur(lit.data, w, h, Math.round(p.soften), { stride: 4, passes: 2 }) } : lit;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
    const a = mask[i], j = i * 4;
    for (let c = 0; c < 3; c++) O.data[j + c] = lit.data[j + c];
    O.data[j + 3] = 1;
    if (a <= 0) continue;
    const F = field.F[i], rim = 1 - p.rim * (1 - field.cosv[i]) ** 1.5;
    for (let c = 0; c < 3; c++) {
      let t;
      if (field.path[i] < 0) t = 0;
      else {
        const sx = x + 0.5 + field.off[i * 6 + c * 2], sy = y + 0.5 + field.off[i * 6 + c * 2 + 1];
        t = (fr ? frosted(seen, sx, sy, c, fr, i) : sample(seen, sx, sy, c)) * Math.exp(-sig[c] * field.path[i]);
      }
      // a trapped ray (total internal reflection at the back) shows the room reflected, not black
      const g = field.path[i] < 0 ? field.refl[i * 3 + c] * rim : (1 - F) * t * rim + F * field.refl[i * 3 + c];
      O.data[j + c] = mix(lit.data[j + c], g, a);
    }
  }
  return O;
}

// Displacement for the live-page path (SVG feDisplacementMap): green-channel offsets packed into 8-bit R and G
// around 128 at `scale` px full range, plus the red and blue spread relative to green. Also an overlay raster
// (reflection, rim and Fresnel as premultiplied light over the page).
export function displacementMap(body, o = {}, scale = 64) {
  const p = opt(o), f = opticsField(body, p), { w, h, mask } = body, rgba = new Uint8ClampedArray(w * h * 4), over = raster(w, h);
  let sumG = 0, sumR = 0, sumB = 0;
  for (let i = 0; i < w * h; i++) {
    const dx = f.off[i * 6 + 2], dy = f.off[i * 6 + 3];
    rgba[i * 4] = 128 + clamp(dx / scale, -0.5, 0.5) * 255; rgba[i * 4 + 1] = 128 + clamp(dy / scale, -0.5, 0.5) * 255; rgba[i * 4 + 2] = 128; rgba[i * 4 + 3] = 255;
    const m = Math.hypot(dx, dy); if (m > 0.5) { sumG += m; sumR += Math.hypot(f.off[i * 6], f.off[i * 6 + 1]); sumB += Math.hypot(f.off[i * 6 + 4], f.off[i * 6 + 5]); }
    const a = mask[i]; if (a <= 0) continue;
    const rim = p.rim * (1 - f.cosv[i]) ** 1.5;
    for (let c = 0; c < 3; c++) over.data[i * 4 + c] = f.F[i] * f.refl[i * 3 + c];
    over.data[i * 4 + 3] = a * clamp(f.F[i] + rim);
  }
  return { w, h, rgba, scale, spread: { r: sumR / Math.max(1e-6, sumG), b: sumB / Math.max(1e-6, sumG) }, overlay: over };
}

// Frosted scatter: light through a ground or pebbled face leaves in a cone, so each pixel averages a Vogel disc of
// taps around its refracted point, rotated by a per-pixel hash (no visible pattern, deterministic).
function frosted(R, x, y, c, fr, i) {
  const rot = ((Math.imul(i, 2654435761) >>> 0) / 4294967296) * 6.2832; let s = 0;
  for (let k = 0; k < fr.n; k++) { const r = fr.r * Math.sqrt((k + 0.5) / fr.n), a = rot + k * 2.39996; s += sample(R, x + r * Math.cos(a), y + r * Math.sin(a), c); }
  return s / fr.n;
}
