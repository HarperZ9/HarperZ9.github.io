// fractal-color.test.mjs — the colour recipe the Studio's two fractal renderers share.
//
// fractal.js runs these functions directly; fractal-gl.js compiles the same formulas as GLSL from
// fractal-glsl-lib.js. Nothing here needs a GL context, so the arithmetic contracts are checked on
// the CPU twin and the shader is checked as SOURCE TEXT: every block the GPU pastes has to be the
// one this file just exercised, and both precision variants have to paste the same one.
//
// Run: node --test system/fractal-color.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  srgbToLinear, srgbEncode, linearToOklab, oklabToLinear,
  preparePalette, rampLinear, relief, trapWeight, holdGamut, TRAP_GAMMA,
} from "./fractal-color.js";
import { PALETTES } from "./fractal.js";
import { _buildFragment, _palToFloats } from "./fractal-gl.js";
import { RAMP_LIB, SHADE_LIB, ENCODE_LIB } from "./fractal-glsl.js";

const PAL_NAMES = Object.keys(PALETTES);

// ── The ramp ──────────────────────────────────────────────────────────────────────────────────

test("every palette stop survives the trip through OKLab and back to its authored byte", () => {
  // The ramp converts sRGB bytes to linear, then to OKLab, splines there, and converts back. Three
  // transfer functions and two matrices, none of which may move a colour the operator chose by eye.
  // Catmull-Rom passes through its control points, so t = i must return stop i exactly.
  for (const name of PAL_NAMES) {
    const pal = PALETTES[name];
    const { lab } = preparePalette(pal);
    const out = [0, 0, 0];
    for (let i = 0; i < pal.length; i++) {
      rampLinear(lab, i, out);
      for (let k = 0; k < 3; k++) {
        const got = srgbEncode(out[k]) * 255;
        assert.ok(Math.abs(got - pal[i][k]) < 0.5,
          `${name} stop ${i} channel ${k}: authored ${pal[i][k]}, round-tripped ${got.toFixed(3)}`);
      }
    }
  }
});

test("the wrap segment is a mid-tone, not a bright neutral band", () => {
  // The regression this ramp was rewritten to fix. The ramp is cyclic, so a full sixth of every
  // cycle runs from the LIGHTEST stop back to the DARKEST one, and the smooth-iteration field
  // sweeps that segment many times across one frame. Interpolating it in linear light spends most
  // of the distance near the bright end, because radiance is not perceptual: ember's midpoint came
  // out #bcbdb3 (measured), a pale neutral sitting 0.24 of OKLab L ABOVE the average of the two
  // stops it joins. Interpolating in OKLab puts it where the eye expects it. The gap between the
  // two behaviours is wide (old: 0.195 to 0.284 high on these five palettes; new: under 0.008), so
  // this threshold does not need to be delicate to catch a relapse.
  for (const name of PAL_NAMES) {
    const pal = PALETTES[name];
    const { lab } = preparePalette(pal);
    const mid = rampLinear(lab, pal.length - 0.5, [0, 0, 0]);
    const L = linearToOklab(mid[0], mid[1], mid[2])[0];
    const meanEnds = (lab[pal.length - 1][0] + lab[0][0]) / 2;
    assert.ok(Math.abs(L - meanEnds) < 0.05,
      `${name}: wrap midpoint L ${L.toFixed(4)} against stop mean ${meanEnds.toFixed(4)}`);
  }
});

test("the ramp is cyclic and continuous across the seam", () => {
  // t is in stops and wraps, so the frame has no visible ring where the cycle restarts.
  const { lab } = preparePalette(PALETTES.ocean);
  const a = rampLinear(lab, 5.999, [0, 0, 0]).slice();
  const b = rampLinear(lab, 6.001, [0, 0, 0]).slice();
  const c = rampLinear(lab, 0.001, [0, 0, 0]).slice();
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(b[k] - c[k]) < 1e-12, `t = 6 + e and t = e agree on channel ${k}`);
    assert.ok(Math.abs(a[k] - b[k]) < 5e-3, `no step across the seam on channel ${k}`);
  }
});

test("preparePalette hands the shader OKLab stops and a LINEAR tint", () => {
  // Two different jobs for one palette. The stops are interpolated, which belongs in a perceptual
  // space; the tint is ADDED as light by the trap glow, which belongs in radiance. Shipping either
  // one in the other's space is the failure this split exists to prevent.
  for (const name of PAL_NAMES) {
    const pal = PALETTES[name];
    const { lab, tint } = preparePalette(pal);
    assert.equal(lab.length, pal.length);
    for (let i = 0; i < pal.length; i++) {
      const linear = pal[i].map(v => srgbToLinear(v / 255));
      const want = linearToOklab(linear[0], linear[1], linear[2]);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(lab[i][k] - want[k]) < 1e-12);
    }
    const last = pal[pal.length - 1];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(tint[k] - srgbToLinear(last[k] / 255)) < 1e-12,
      `${name}: tint is the lightest stop in linear light`);
  }
});

test("preparePalette caches per palette rather than per frame", () => {
  const a = preparePalette(PALETTES.dusk);
  const b = preparePalette(PALETTES.dusk);
  assert.equal(a, b, "same stop array returns the same prepared object");
});

test("oklabToLinear inverts linearToOklab and never returns negative radiance", () => {
  const out = [0, 0, 0];
  for (const c of [[0, 0, 0], [1, 1, 1], [0.21, 0.04, 0.6], [0.9, 0.35, 0.02]]) {
    const [L, a, b] = linearToOklab(c[0], c[1], c[2]);
    oklabToLinear(L, a, b, out);
    // The two matrices are published to ten digits and are not exact inverses at that width, so
    // the pair leaves about 3e-7 of residual at the bright end: a fifteenth of one code value.
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(out[k] - c[k]) < 1e-6, "round trip");
  }
  // A spline through OKLab can leave the sRGB gamut; downstream has no meaning for negative light.
  oklabToLinear(0.5, 0.9, -0.9, out);
  for (let k = 0; k < 3; k++) assert.ok(out[k] >= 0, "clipped at zero");
});

// ── The trap glow ─────────────────────────────────────────────────────────────────────────────

test("the trap opacity authored at 0.30 still reads as 0.30 after the move to linear light", () => {
  // The glow was drawn as a 30% veil in DISPLAY code values. Compositing that same number against
  // radiance lands at roughly twice the weight: 0.30 of the radiance encodes to 0.58 of a code
  // value, and since the tint is each palette's lightest stop, every frame drifted toward it.
  assert.equal(TRAP_GAMMA, 2.2);
  assert.ok(Math.abs(srgbEncode(trapWeight(0.30)) - 0.30) < 0.01,
    `weighted glow encodes back to the authored opacity (got ${srgbEncode(trapWeight(0.30)).toFixed(4)})`);
  assert.ok(srgbEncode(0.30) > 0.55, "the unweighted number really is about twice as strong");
  assert.equal(trapWeight(0), 0, "no trap, no glow");
  assert.equal(trapWeight(1), 1, "full trap still reaches the tint");
});

// ── Relief ────────────────────────────────────────────────────────────────────────────────────

test("relief is a multiplier centred on 1, bounded by its own depth constant", () => {
  // Shading must not re-grade the image. The term is centred on 1 and spans 1 +/- RELIEF (0.42), so
  // mean exposure across a frame is unchanged and only local contrast is added.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const s = relief(Math.cos(a), Math.sin(a), 1, 0);
    assert.ok(Number.isFinite(s));
    lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  assert.ok(lo >= 0.58 - 1e-9 && hi <= 1.42 + 1e-9, `relief stayed in [0.58, 1.42], got [${lo}, ${hi}]`);
  assert.ok(hi - lo > 0.3, "and it actually varies with direction, rather than sitting flat");
});

test("relief degrades to flat, never to a black pixel", () => {
  // Every rejection path returns 1 exactly. The comparisons are negated so NaN takes them too:
  // any comparison against NaN is false.
  assert.equal(relief(1, 0, 0, 0), 1, "zero derivative");
  assert.equal(relief(1, 0, 1e30, 1e30), 1, "derivative out of range");
  assert.equal(relief(1, 0, NaN, 0), 1, "NaN derivative");
  assert.equal(relief(0, 0, 1, 0), 1, "zero orbit point");
});

// ── Highlight hold ────────────────────────────────────────────────────────────────────────────

test("holdGamut spends highlight headroom instead of saturation", () => {
  // relief multiplies by up to 1.42, which pushes the bright end of a palette past 1. Clipping each
  // channel on its own drains the colour, so the filaments the shading was added to light up were
  // the ones losing their hue. Dividing the triple by its own maximum walks it back to the gamut
  // boundary along the SAME hue.
  const c = holdGamut([2.0, 1.0, 0.5]);
  assert.ok(Math.abs(c[0] - 1) < 1e-12, "the maximum lands exactly on the boundary");
  assert.ok(Math.abs(c[1] / c[0] - 0.5) < 1e-12, "channel ratios, and so the hue, are unchanged");
  assert.ok(Math.abs(c[2] / c[0] - 0.25) < 1e-12);
  // Per-channel clipping is what this replaces: it would have returned [1, 1, 0.5], a colour with
  // a different hue and much less of it.
  const untouched = holdGamut([0.8, 0.4, 0.1]);
  assert.deepEqual(untouched, [0.8, 0.4, 0.1], "nothing in gamut is touched");
});

// ── The GPU pastes the recipe this file just checked ───────────────────────────────────────────

test("_palToFloats uploads OKLab stops, not linear RGB", () => {
  // The uniform changed meaning when the ramp moved spaces, and a stale uploader would still fill
  // eighteen plausible floats. Checked numerically against the CPU twin, and against the space it
  // used to be in: OKLab's two chroma axes are signed and small, linear RGB's components are not.
  for (const name of PAL_NAMES) {
    const pal = PALETTES[name];
    const got = _palToFloats(name);
    assert.equal(got.length, 18);
    const { lab } = preparePalette(pal);
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 3; k++) {
        assert.ok(Math.abs(got[i * 3 + k] - lab[i][k]) < 1e-6,
          `${name} stop ${i} axis ${k}: ${got[i * 3 + k]} against ${lab[i][k]}`);
      }
    }
  }
  // The brightest stop of a saturated palette: L near 1, chroma small. Linear RGB would put all
  // three components in the same range as each other and none of them negative.
  const ember = _palToFloats("ember");
  assert.ok(ember[15] > 0.5, "L of the lightest stop is high");
  assert.ok(Math.abs(ember[16]) < 0.4 && Math.abs(ember[17]) < 0.4, "chroma axes are small");
});

test("an unknown palette name falls back rather than uploading zeros", () => {
  assert.deepEqual(Array.from(_palToFloats("no-such-palette")), Array.from(_palToFloats("ocean")));
});

test("both precision programs paste the same colour blocks, verbatim", () => {
  // The shader source is assembled from shared strings. If a variant ever pasted its own copy, the
  // GPU frame would drift away from the gated CPU reference one edit at a time.
  for (const type of ["mandelbrot", "julia", "burningship"]) {
    for (const precision of ["single", "double"]) {
      const src = _buildFragment(type, precision);
      for (const [name, block] of [["RAMP_LIB", RAMP_LIB], ["SHADE_LIB", SHADE_LIB], ["ENCODE_LIB", ENCODE_LIB]]) {
        assert.ok(src.includes(block.trim()), `${type}/${precision} pastes ${name} unmodified`);
      }
    }
  }
});

test("the GPU carries every step of the CPU recipe, in both precisions", () => {
  for (const precision of ["single", "double"]) {
    const src = _buildFragment("mandelbrot", precision);
    // The palette is read in OKLab and returned to light before anything is done with it.
    assert.ok(src.includes("vec3 oklabToLinear(vec3 lab)"), `${precision}: OKLab conversion present`);
    assert.match(src, /uniform vec3\s+u_pal\[6\];/);
    // The tint travels separately, in linear light, because the glow adds it rather than mixing it.
    assert.match(src, /uniform vec3\s+u_tint;/);
    assert.ok(src.includes("const float TRAP_GAMMA = 2.2;"), `${precision}: same trap gamma as the CPU`);
    assert.ok(src.includes("float trapWeight(float a) { return pow(a, TRAP_GAMMA); }"));
    assert.ok(src.includes("u_tint * trapWeight(glow)"), `${precision}: the glow is added as light`);
    // Highlight hold, then the single encode point.
    assert.ok(src.includes("vec3 holdGamut(vec3 c)"), `${precision}: highlight hold present`);
    assert.ok(src.includes("holdGamut(base * relief("), `${precision}: hold wraps the shaded colour`);
    assert.ok(src.includes("encodeOut("), `${precision}: dithered encode is the last step`);
  }
});

test("the trap glow is emission, not a blend toward the tint", () => {
  // A mix() toward the lightest stop pulls EVERY lit pixel that way, including the majority of a
  // frame where the trap is weak, which is how the palettes drained. Adding light leaves the base
  // hue alone where the glow is faint and still prints the filament where it is strong.
  for (const precision of ["single", "double"]) {
    const src = _buildFragment("mandelbrot", precision);
    assert.ok(!/mix\(\s*base[^)]*u_tint/.test(src), `${precision}: no blend toward the tint survives`);
    assert.match(src, /base \* relief\(.*?\) \+ u_tint \* trapWeight\(glow\)/);
  }
});
