// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ENV_IMPORTS = {
  env: {
    print_i64: () => {},
    print_u64: () => {},
    print_f64: () => {},
    print_str: () => {},
    print_bool: () => {},
    print_newline: () => {},
  },
};

async function loadKernel(filename) {
  const bytes = await readFile(join(__dirname, "wasm", filename));
  const { instance } = await WebAssembly.instantiate(bytes, ENV_IMPORTS);
  return instance.exports;
}

test("estuary_kernel.wasm: 60-aperture Perret lantern, metamer delta, Betti homology, and monodromy winding", async () => {
  const k = await loadKernel("estuary_kernel.wasm");
  assert.equal(k.main(), 0, "estuary main() self-check passes");

  // 1. 60-aperture Perret lantern spectral luminance
  const peak = k.perret_aperture_luminance(0, 0.0, Math.PI / 4, 555.0);
  const offBand = k.perret_aperture_luminance(0, 0.0, Math.PI / 4, 420.0);
  const shadowSide = k.perret_aperture_luminance(30, 0.0, Math.PI / 4, 555.0);
  const night = k.perret_aperture_luminance(0, 0.0, -0.2, 555.0);
  const expectedPeak = 0.88 * Math.cos(Math.PI / 4) * Math.sin(Math.PI / 4) + 0.12 * Math.sin(Math.PI / 4);
  assert.ok(Math.abs(peak - expectedPeak) < 1e-3, `peak aperture luminance=${peak}, expected=${expectedPeak}`);
  assert.ok(peak > offBand * 10, "555nm photopic peak dominates 420nm");
  assert.ok(peak > shadowSide * 4, "sun-facing aperture brighter than opposite aperture");
  assert.equal(night, 0.0, "below-horizon sun gives zero luminance");

  // Wrap-around modulo invariance across 60 apertures
  assert.ok(
    Math.abs(k.perret_aperture_luminance(60, 0.3, 0.6, 555.0) - k.perret_aperture_luminance(0, 0.3, 0.6, 555.0)) < 1e-12
  );
  const total555 = k.perret_lantern_total_luminance(0.0, Math.PI / 4, 555.0);
  const totalRot = k.perret_lantern_total_luminance(Math.PI / 3, Math.PI / 4, 555.0);
  assert.ok(total555 > 12.0 && total555 < 20.0, `total555=${total555}`);
  assert.ok(Math.abs(total555 - totalRot) < 1e-6, "60-aperture ring is rotationally symmetric");

  // 2. Spectral metamer delta
  assert.ok(Math.abs(k.metamer_delta(0.4, 0.5, 0.6, 0.4, 0.5, 0.6, 0.0)) < 1e-12, "identical colors under 0 shift");
  const shifted = k.metamer_delta(0.4, 0.5, 0.6, 0.4, 0.5, 0.6, 0.8);
  assert.ok(shifted > 0.1, `illuminant shift reveals metamer delta=${shifted}`);

  // 3. Betti homology (beta0 / beta1 / Euler)
  assert.equal(k.betti0_components(6, 4), 2);
  assert.equal(k.betti0_components(6, 5), 1);
  assert.equal(k.betti0_components(0, 0), 0);
  assert.equal(k.betti1_cycles(6, 7, 2), 3);
  assert.equal(k.betti1_cycles(4, 4, 1), 1, "single loop has beta1 = 1");
  assert.equal(k.euler_characteristic(8, 12, 6), 2, "cube Euler characteristic = 2");

  // 4. Monodromy winding
  assert.equal(k.monodromy_winding_index(0.0), 0);
  assert.equal(k.monodromy_winding_index(2 * Math.PI), 1);
  assert.equal(k.monodromy_winding_index(4 * Math.PI), 2);
  assert.equal(k.monodromy_winding_index(-2 * Math.PI), -1);
  const sheet0 = k.monodromy_sheet_phase(Math.PI, 2);
  const sheet1 = k.monodromy_sheet_phase(Math.PI + 2 * Math.PI, 2);
  assert.ok(Math.abs(sheet0 - 1.0) < 1e-4, `sheet0=${sheet0}`);
  assert.ok(Math.abs(sheet1 + 1.0) < 1e-4, `2-sheet monodromy flips sign after 2pi: sheet1=${sheet1}`);
});

test("plotter_loom_kernel.wasm: luma-to-hatch spacing, 4 weave modes, and relief quantization", async () => {
  const k = await loadKernel("plotter_loom_kernel.wasm");
  assert.equal(k.main(), 0, "plotter_loom main() self-check passes");

  // 1. Luma-to-hatch spacing & density
  assert.ok(Math.abs(k.luma_to_hatch_spacing(0.0, 0.4, 2.4, 1.0) - 0.4) < 1e-9);
  assert.ok(Math.abs(k.luma_to_hatch_spacing(1.0, 0.4, 2.4, 1.0) - 2.4) < 1e-9);
  assert.ok(Math.abs(k.luma_to_hatch_spacing(0.5, 0.4, 2.4, 1.0) - 1.4) < 1e-9);
  assert.ok(Math.abs(k.luma_to_hatch_spacing(0.5, 0.4, 2.4, 2.0) - 0.9) < 1e-9, "gamma=2.0 darkens midtone");
  assert.ok(
    Math.abs(k.luma_to_hatch_spacing(0.25, 0.4, 2.4, 0.5) - 1.4) < 1e-6,
    "gamma=0.5 sqrt(0.25)=0.5"
  );
  assert.ok(Math.abs(k.hatch_density_lines_per_cm(0.0, 0.5, 2.5) - 20.0) < 1e-9);
  assert.ok(Math.abs(k.hatch_density_lines_per_cm(1.0, 0.5, 2.5) - 4.0) < 1e-9);

  // 2. Weave matrix: 0=plain, 1=2/2 twill, 2=5-harness satin, 3=Jacquard
  // Plain weave alternates 1, 0, 1, 0
  assert.equal(k.weave_cell(0, 0, 0), 1);
  assert.equal(k.weave_cell(1, 0, 0), 0);
  assert.equal(k.weave_cell(0, 1, 0), 0);
  assert.equal(k.weave_cell(1, 1, 0), 1);
  assert.equal(k.weave_cell(-1, 0, 0), 0, "negative coordinates wrap cleanly");

  // 2/2 twill has 2 warp lifts out of every 4 picks
  let twillSum = 0;
  for (let x = 0; x < 4; x++) twillSum += k.weave_cell(x, 0, 1);
  assert.equal(twillSum, 2, "2/2 twill balanced 50% lift");

  // 5-harness satin has exactly 1 lift per 5x5 row and column
  for (let y = 0; y < 5; y++) {
    let rowSum = 0;
    for (let x = 0; x < 5; x++) rowSum += k.weave_cell(x, y, 2);
    assert.equal(rowSum, 1, `5-harness satin row ${y} has 1 lift`);
  }

  // Jacquard 8x8 diamond motif is periodic mod 8 and lifts center (3,3)
  assert.equal(k.weave_cell(3, 3, 3), 1);
  assert.equal(k.weave_cell(11, 11, 3), 1);
  assert.equal(k.weave_cell(0, 0, 3), 0);

  // 3. Relief height quantization
  assert.equal(k.relief_layer_index(0.0, 5), 0);
  assert.equal(k.relief_layer_index(0.5, 5), 2);
  assert.equal(k.relief_layer_index(1.0, 5), 4);
  assert.equal(k.relief_layer_index(1.5, 5), 4, "clamps above 1.0");
  assert.ok(Math.abs(k.relief_height_quantize(0.0, 5, 4.0) - 0.0) < 1e-9);
  assert.ok(Math.abs(k.relief_height_quantize(0.5, 5, 4.0) - 2.0) < 1e-9);
  assert.ok(Math.abs(k.relief_height_quantize(0.74, 5, 4.0) - 3.0) < 1e-9);
  assert.ok(Math.abs(k.relief_height_quantize(1.0, 5, 4.0) - 4.0) < 1e-9);
});

test("type_forge_kernel.wasm: cubic Bezier, stem-weight validation, and kerning pair spacing", async () => {
  const k = await loadKernel("type_forge_kernel.wasm");
  assert.equal(k.main(), 0, "type_forge main() self-check passes");

  // 1. Parametric cubic Bezier & derivative
  assert.ok(Math.abs(k.cubic_bezier(10.0, 30.0, 70.0, 100.0, 0.0) - 10.0) < 1e-12);
  assert.ok(Math.abs(k.cubic_bezier(10.0, 30.0, 70.0, 100.0, 1.0) - 100.0) < 1e-12);
  assert.ok(Math.abs(k.cubic_bezier(0.0, 0.0, 1.0, 1.0, 0.5) - 0.5) < 1e-12);
  // Derivative at t=0 is 3*(p1 - p0), at t=1 is 3*(p3 - p2)
  assert.ok(Math.abs(k.cubic_bezier_derivative(10.0, 30.0, 70.0, 100.0, 0.0) - 60.0) < 1e-12);
  assert.ok(Math.abs(k.cubic_bezier_derivative(10.0, 30.0, 70.0, 100.0, 1.0) - 90.0) < 1e-12);

  // 2. Stem-weight & counter validation
  assert.equal(k.validate_counter_weight(90.0, 600.0), 1, "15% stem ratio is optically valid");
  assert.equal(k.validate_counter_weight(10.0, 600.0), 0, "too thin hairline rejected");
  assert.equal(k.validate_counter_weight(280.0, 600.0), 0, "collapsed counter rejected");
  assert.equal(k.validate_counter_weight(350.0, 600.0), 0, "overlapping stems rejected");
  assert.equal(k.validate_counter_weight(0.0, 600.0), 0);
  assert.ok(Math.abs(k.counter_ratio(90.0, 600.0) - 0.7) < 1e-12);

  // 3. Kerning pair spacing
  assert.equal(k.kerning_pair_delta(65, 86), -75.0, "AV pair");
  assert.equal(k.kerning_pair_delta(84, 111), -65.0, "To pair");
  assert.equal(k.kerning_pair_delta(72, 73), 0.0, "HI neutral pair");
  assert.ok(Math.abs(k.kerning_pair_spacing(65, 86, 650.0, 0.0) - 575.0) < 1e-9);
  assert.ok(Math.abs(k.kerning_pair_spacing(65, 86, 650.0, 0.02) - 588.0) < 1e-9);
  assert.ok(Math.abs(k.kerning_pair_spacing(72, 73, 600.0, 0.0) - 600.0) < 1e-9);
});
