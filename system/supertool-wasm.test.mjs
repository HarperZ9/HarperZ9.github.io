import test from "node:test";
import assert from "node:assert/strict";
import { loadSupertoolWasm } from "./supertool-wasm.js";

test("BuildLang-compiled supertool_kernel.wasm executes all 5 flagship repository cores natively", async () => {
  const k = await loadSupertoolWasm();
  assert.equal(k.main(), 0, "BuildLang main() self-check passes");

  // 1. Superframe + RAW Rendering & Optics
  const ior = k.cauchy_ior(0.55, 1.5046, 0.00420);
  assert.ok(Math.abs(ior - 1.518484) < 1e-4, `cauchy_ior=${ior}`);
  assert.ok(k.fresnel_schlick(0.0, 0.04) > 0.99);
  assert.ok(k.ggx_ndf(1.0, 0.5) > 1.2);
  assert.ok(Math.abs(k.km_reflectance(0.25, 1.0) - 0.5) < 1e-9);
  assert.ok(k.sky_rayleigh_phase(1.0) > 0.11);

  // 2. The Playground Physics, Sand, Audio & Topology
  assert.equal(k.sand_can_displace(1, 2), 1);
  assert.equal(k.sand_can_displace(2, 1), 0);
  assert.equal(k.sand_thermal_react(1, 3), 7);
  assert.equal(k.sand_thermal_react(2, 1), 10);
  assert.ok(Math.abs(k.harmonic_fm_sample(1.570796, 0.0, 1.0) - 1.0) < 0.01);
  assert.equal(k.betti_euler_char(8, 12, 6), 2, "closed cube Euler characteristic = 2");

  // 3. The Flywheel Oracle & Articulate Prose Scorer
  assert.equal(k.flywheel_verdict(0.01, 0.05, 0.14), 1, "VERIFIED");
  assert.equal(k.flywheel_verdict(0.09, 0.05, 0.14), 0, "REFUTED");
  assert.equal(k.flywheel_verdict(0.01, 0.05, 0.02), -1, "INVALID_CONTROL");
  assert.equal(k.articulate_slop_score(0, 0, 100), 0);
  assert.equal(k.articulate_slop_score(2, 1, 100), 38);

  // 4. The Commons Provenance & 5. BuildOS-2.2 Quorum
  const h1 = k.scene_fnv1a(42, 960, 540, 10);
  const h2 = k.scene_fnv1a(42, 960, 540, 11);
  assert.notEqual(h1, h2);
  assert.notEqual(k.merkle_combine(h1, h2), k.merkle_combine(h2, h1));
  assert.equal(k.bft_quorum_check(3, 4), 1);
  assert.equal(k.bft_quorum_check(2, 4), 0);
});
