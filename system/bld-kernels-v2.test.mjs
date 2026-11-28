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

test("glass_optics_kernel.wasm: Luneburg lens, Snell refraction, Beer-Lambert, Airy iridescence + planted controls", async () => {
  const k = await loadKernel("glass_optics_kernel.wasm");
  assert.equal(k.main(), 0, "glass_optics main() self-check passes");

  // 1. Luneburg graded-index lens: n(0) = sqrt(2), n(1) = 1.0, ray bend = asin(b/R)
  assert.ok(Math.abs(k.luneburg_ior(0.0) - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(k.luneburg_ior(1.0) - 1.0) < 1e-12);
  assert.ok(Math.abs(k.luneburg_ior(1.5) - 1.0) < 1e-12);
  assert.ok(Math.abs(k.luneburg_ray_bend(0.5, 1.0) - Math.PI / 6) < 1e-6);
  assert.equal(k.luneburg_ray_bend(1.2, 1.0), 0.0, "ray outside lens radius does not bend");

  // 2. Snell refraction + planted TIR failure control
  assert.ok(Math.abs(k.snell_sin_theta_t(0.5, 1.0, 1.5) - 1 / 3) < 1e-12);
  assert.ok(Math.abs(k.snell_cos_theta_t(1.0, 1.0, 1.5) - 1.0) < 1e-12, "normal incidence stays normal");
  assert.equal(k.snell_sin_theta_t(0.9, 1.5, 1.0), -1.0, "planted control: total internal reflection flagged -1");
  assert.equal(k.snell_cos_theta_t(0.4, 1.5, 1.0), -1.0, "planted control: TIR cosine flagged -1");

  // 3. Beer-Lambert spectral absorption + planted negative-path guard
  assert.ok(Math.abs(k.beer_lambert_transmittance(1.0, 1.0, 0.0) - 1.0) < 1e-12);
  assert.ok(Math.abs(k.beer_lambert_transmittance(1.0, 1.0, 1.0) - Math.exp(-1.0)) < 1e-6);
  assert.equal(k.beer_lambert_transmittance(1.0, 1.0, -2.0), 0.0, "planted control: negative path rejected");

  // 4. Airy thin-film iridescence: destructive node at n*d = lambda/2, constructive peak at lambda/4
  const destructive = k.airy_thin_film_reflectance(1.5, 200.0, 1.0, 600.0, 0.25);
  const constructive = k.airy_thin_film_reflectance(1.5, 100.0, 1.0, 600.0, 0.25);
  assert.ok(destructive < 1e-6, `destructive node=${destructive}`);
  assert.ok(constructive > 0.2, `constructive peak=${constructive}`);
});

test("fluid_well_kernel.wasm: 2D curl-noise, vorticity confinement, Kubelka-Munk wet-well + planted controls", async () => {
  const k = await loadKernel("fluid_well_kernel.wasm");
  assert.equal(k.main(), 0, "fluid_well main() self-check passes");

  // 1. 2D curl-noise is divergence-free (incompressible)
  const vx = k.curl_noise_vx(0.7, 1.1, 1.5, 0.4);
  const vy = k.curl_noise_vy(0.7, 1.1, 1.5, 0.4);
  const div = k.curl_noise_divergence(0.7, 1.1, 1.5, 0.4);
  assert.ok(Math.abs(vx) + Math.abs(vy) > 0.2, "non-trivial curl velocity field");
  assert.ok(Math.abs(div) < 1e-5, `divergence-free field div=${div}`);

  // 2. Vorticity confinement force perpendicular to grad|omega| + planted zero-gradient control
  const fx = k.vorticity_confinement_fx(3.0, 4.0, 2.0, 0.5, 0.1);
  const fy = k.vorticity_confinement_fy(3.0, 4.0, 2.0, 0.5, 0.1);
  assert.ok(Math.abs(fx - 0.08) < 1e-12, `fx=${fx}`);
  assert.ok(Math.abs(fy + 0.06) < 1e-12, `fy=${fy}`);
  assert.ok(Math.abs(3.0 * fx + 4.0 * fy) < 1e-12, "confinement force orthogonal to gradient");
  assert.equal(k.vorticity_confinement_fx(0.0, 0.0, 5.0, 0.5, 0.1), 0.0, "planted control: zero gradient yields 0");

  // 3. Kubelka-Munk two-pigment wet-well blend
  assert.ok(Math.abs(k.km_reflectance(0.25, 1.0) - 0.5) < 1e-9);
  const dry = k.km_wet_well_blend(0.25, 1.0, 0.25, 1.0, 0.5, 0.0);
  const wet = k.km_wet_well_blend(0.25, 1.0, 0.25, 1.0, 0.5, 1.0);
  assert.ok(Math.abs(dry - 0.5) < 1e-9);
  assert.ok(Math.abs(wet - 0.325) < 1e-9, "full wetness darkens by Saunderson factor 0.65");
  assert.equal(k.km_reflectance(1.0, 0.0), 0.0, "planted control: zero scattering guarded");
});

test("daw_synth_kernel.wasm: Karplus-Strong, coastal jazz chord, 1-pole resonant LPF, LUFS meter + planted controls", async () => {
  const k = await loadKernel("daw_synth_kernel.wasm");
  assert.equal(k.main(), 0, "daw_synth main() self-check passes");

  // 1. Karplus-Strong step & coastal jazz chord voice
  assert.ok(Math.abs(k.karplus_strong_step(1.0, 0.5, 0.99) - 0.7425) < 1e-12);
  // Planted control: damping > 1.0 clamped so feedback cannot blow up
  assert.ok(k.karplus_strong_step(1.0, 1.0, 5.0) < 1.0, "planted control: damping clamped < 1.0");
  const maj = k.coastal_jazz_chord_sample(0.01, 220.0, 0);
  const min = k.coastal_jazz_chord_sample(0.01, 220.0, 1);
  assert.notEqual(maj, min, "Maj7/9 and Min7/9 voicings produce distinct waveforms");
  assert.equal(k.coastal_jazz_chord_sample(-0.1, 220.0, 0), 0.0, "planted control: negative time silent");

  // 2. 1-pole resonant lowpass filter
  const alpha = k.one_pole_lpf_alpha(1000.0, 48000.0);
  const expectedAlpha = 1.0 - Math.exp((-2 * Math.PI * 1000.0) / 48000.0);
  assert.ok(Math.abs(alpha - expectedAlpha) < 1e-6, `alpha=${alpha}`);
  const out = k.resonant_lpf_step(1.0, 0.0, 0.2, 0.5, 0.5);
  assert.ok(Math.abs(out - 0.45) < 1e-12, `resonant LPF step=${out}`);

  // 3. LUFS-style RMS loudness meter
  assert.ok(Math.abs(k.rms_4_samples(0.5, -0.5, 0.5, -0.5) - 0.5) < 1e-12);
  assert.ok(Math.abs(k.lufs_from_rms(1.0) - -0.691) < 1e-6, "0 dBFS RMS maps to -0.691 LUFS");
  assert.ok(Math.abs(k.lufs_from_rms(0.1) - -20.691) < 1e-5, "-20 dBFS RMS maps to -20.691 LUFS");
  assert.equal(k.lufs_from_rms(0.0), -70.0, "planted control: digital silence clamped to -70 LUFS floor");
});
