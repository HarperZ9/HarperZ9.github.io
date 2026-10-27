// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// substrate/thinfilm: thin-film interference colour by thickness, for the light material, glyph
// and ornament generators (and any SVG gradient). Light reflecting from the top and the bottom of
// a film of index n and thickness d interferes. The phase difference is 4 pi n d cos(theta) / lambda.
// A soap film in air flips the phase of one reflection, so a film far thinner than the light's
// wavelength reflects nothing (the black film); `flip: false` models a film between two media
// that leaves both reflections unflipped.
//
// The colour is a three-sample approximation: reflectance at 650, 532 and 450 nm read directly as
// linear R, G and B, then encoded to sRGB. It walks the Newton sequence (magenta, blue, cyan,
// yellow) in order, but it is not a full spectral integral, and orders above the third wash out
// more slowly than real films do.

import { linearToSrgb } from "./vendor/superstack.mjs";

export const WAVELENGTHS = Object.freeze({ r: 650, g: 532, b: 450 });

// Reflectance 0..1 of a two-beam thin film at one wavelength (nanometres).
export function reflectance(dNm, lambdaNm, { n = 1.33, cosTheta = 1, flip = true } = {}) {
  if (!(lambdaNm > 0 && n > 0)) throw new RangeError("thinfilm: wavelength and index must be above 0");
  const c = Math.cos((4 * Math.PI * n * dNm * cosTheta) / lambdaNm);
  return flip ? 0.5 - 0.5 * c : 0.5 + 0.5 * c;
}

// Linear RGB (0..1 each) for a thickness in nanometres.
export function filmLinear(dNm, opts = {}) {
  const { r, g, b } = WAVELENGTHS;
  return [reflectance(dNm, r, opts), reflectance(dNm, g, opts), reflectance(dNm, b, opts)];
}

// sRGB bytes [r, g, b] for a thickness in nanometres.
export function filmRgb8(dNm, opts = {}) {
  return filmLinear(dNm, opts).map((v) => Math.round(255 * linearToSrgb(Math.min(1, Math.max(0, v)))));
}

export const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

// A lookup table of `steps` colours from dMin to dMax nanometres, as packed RGB bytes, so a shader
// or a canvas loop indexes thickness instead of evaluating cosines per pixel.
export function filmLut({ dMin = 0, dMax = 900, steps = 256, ...opts } = {}) {
  if (!(steps >= 2 && dMax > dMin)) throw new RangeError("thinfilm: need steps >= 2 and dMax > dMin");
  const out = new Uint8Array(steps * 3);
  for (let i = 0; i < steps; i++) out.set(filmRgb8(dMin + ((dMax - dMin) * i) / (steps - 1), opts), i * 3);
  return out;
}

// Gradient stops for SVG or CSS: [{ offset 0..1, color "#rrggbb" }] across a thickness range.
export function filmStops({ dMin = 100, dMax = 700, count = 12, ...opts } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const u = i / (count - 1);
    return { offset: +u.toFixed(4), color: hex(filmRgb8(dMin + (dMax - dMin) * u, opts)) };
  });
}

// An SVG <linearGradient> with those stops, ready to drop into <defs>. Without `line` it runs
// left to right across each filled shape; with line = [x1, y1, x2, y2] it runs in user space, so
// many small shapes (halftone dots, glyph cells) share one sweep.
export function filmGradientSvg(id, { line = null, ...opts } = {}) {
  const stops = filmStops(opts).map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join("");
  const geo = line
    ? `gradientUnits="userSpaceOnUse" x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}"`
    : `x1="0" y1="0" x2="1" y2="0"`;
  return `<linearGradient id="${String(id).replace(/[^\w-]/g, "")}" ${geo}>${stops}</linearGradient>`;
}
