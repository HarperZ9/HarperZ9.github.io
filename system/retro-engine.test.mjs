// Node-only contracts for the Retro dither and tube stages. No DOM: the
// modules take plain arrays and typed arrays, which is what makes the
// browser render and an offline render checkable against each other.
import test from "node:test";
import assert from "node:assert/strict";
import { ditherPlate, farSideIndex, DITHER_MODES } from "./retro-dither.js";
import { beamTable, maskTable, crtActive, MASK_MODES } from "./retro-crt.js";

const BW = [{ lab: [0, 0, 0] }, { lab: [1, 0, 0] }];
const flat = (tw, th, L) => Array.from({ length: tw * th }, () => [L, 0, 0]);
const lightShare = (idx) => { let n = 0; for (const i of idx) n += i; return n / idx.length; };

test("ordered dither of a flat 30% gray lands near 30% light pixels on a two-colour palette", () => {
  for (const mode of ["bayer2", "bayer4", "bayer8", "noise"]) {
    const idx = ditherPlate(flat(64, 64, 0.3), 64, 64, BW, mode, 1);
    const share = lightShare(idx);
    assert.ok(Math.abs(share - 0.3) < 0.06, `${mode}: ${share}`);
  }
});

test("dither strength 0 and mode none both collapse to the nearest entry", () => {
  const lab = flat(16, 16, 0.3);
  assert.equal(lightShare(ditherPlate(lab, 16, 16, BW, "bayer8", 0)), 0);
  assert.equal(lightShare(ditherPlate(lab, 16, 16, BW, "none", 1)), 0);
  assert.equal(lightShare(ditherPlate(flat(16, 16, 0.7), 16, 16, BW, "none", 1)), 1);
});

test("error diffusion preserves the mean lightness of the plate", () => {
  for (const L of [0.2, 0.5, 0.8]) {
    const idx = ditherPlate(flat(48, 48, L), 48, 48, BW, "diffusion", 1);
    assert.ok(Math.abs(lightShare(idx) - L) < 0.03, `L=${L}: ${lightShare(idx)}`);
  }
});

test("every dither mode is deterministic and returns one index per cell", () => {
  const lab = Array.from({ length: 40 * 30 }, (_, p) => [((p * 7919) % 1000) / 1000, 0, 0]);
  for (const mode of DITHER_MODES) {
    const a = ditherPlate(lab, 40, 30, BW, mode, 0.8), b = ditherPlate(lab, 40, 30, BW, mode, 0.8);
    assert.equal(a.length, 40 * 30, mode);
    assert.deepEqual(Array.from(a), Array.from(b), mode);
  }
});

test("beam scanline rows keep the retro.py row mean 1.05 - strength / 2 in every lum bucket", () => {
  for (const cell of [2, 3, 4, 6, 9]) for (const s of [0.1, 0.35, 0.8]) {
    const t = beamTable(cell, s, 0.5);
    for (let k = 0; k < 16; k++) {
      let sum = 0;
      for (let r = 0; r < cell; r++) sum += t[k * cell + r];
      assert.ok(Math.abs(sum / cell - (1.05 - s / 2)) < 1e-5, `cell ${cell} s ${s} bucket ${k}: ${sum / cell}`);
    }
  }
});

test("a brighter bucket spreads its beam wider than a darker one", () => {
  const t = beamTable(6, 0.5, 1);
  const edgeDark = t[0 * 6 + 0], edgeBright = t[15 * 6 + 0];
  assert.ok(edgeBright > edgeDark, `${edgeBright} > ${edgeDark}`);
});

test("mask tables: none is the identity, grille lifts the lit channel and dims the others", () => {
  assert.ok(Array.from(maskTable("none", 0.7)).every((v) => v === 1));
  const g = maskTable("grille", 0.4);
  assert.ok(Math.abs(g[0] - 1.18) < 1e-6, `lit gain ${g[0]}`);
  assert.ok(Math.abs(g[1] - 0.6 * 1.18) < 1e-6, `off gain ${g[1]}`);
  for (const mode of MASK_MODES) assert.equal(maskTable(mode, 0.5).length, 54, mode);
});

test("crtActive is false with every tube stage at zero and true once any stage is set", () => {
  const off = { scanlines: false, bloom: 0, halation: 0, curvature: 0, aberration: 0, vignette: 0, mask: "grille", maskStrength: 0 };
  assert.equal(crtActive(off), false);
  assert.equal(crtActive({ ...off, maskStrength: 0.3 }), true);
  assert.equal(crtActive({ ...off, halation: 0.2 }), true);
  assert.equal(crtActive({ ...off, aberration: 0.1 }), true);
});

// White, a pink one step away, and an orange further off in a and b.
const TINTS = [{ lab: [1, 0, 0] }, { lab: [0.8, 0.15, 0] }, { lab: [0.75, 0.1, 0.15] }];

test("a faintly tinted near-white dithers toward the nearer hue, not a sparse far one", () => {
  assert.equal(farSideIndex(0.97, 0.01, 0.02, 0, TINTS), 1);
});

test("a pixel midway between white and orange still brackets with orange", () => {
  assert.equal(farSideIndex(0.875, 0.05, 0.075, 0, TINTS), 2);
});

test("a pixel with nothing on its far side gets no bracketing partner", () => {
  assert.equal(farSideIndex(1.05, -0.02, -0.02, 0, TINTS), -1);
});
