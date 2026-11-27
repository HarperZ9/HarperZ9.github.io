import test from "node:test";
import assert from "node:assert/strict";
import { loadSupertoolWasm } from "./supertool-wasm.js";

test("BuildLang-compiled supertool_kernel.wasm executes Cauchy optics, Kubelka-Munk, sand physics, and FNV-1a", async () => {
  const k = await loadSupertoolWasm();
  assert.equal(k.main(), 0, "BuildLang main() self-check passes");

  // Crown glass Cauchy IOR at 550nm (BK7 ~ 1.5185)
  const ior = k.cauchy_ior(0.55, 1.5046, 0.00420);
  assert.ok(Math.abs(ior - 1.518484) < 1e-4, `cauchy_ior=${ior}`);

  // Fresnel Schlick grazing reflection approaches 1.0
  assert.ok(k.fresnel_schlick(0.0, 0.04) > 0.99);
  assert.ok(Math.abs(k.fresnel_schlick(1.0, 0.04) - 0.04) < 1e-9);

  // Kubelka-Munk reflectance for K/S = 0.25 -> 1.25 - sqrt(0.5625) = 0.5
  const r = k.km_reflectance(0.25, 1.0);
  assert.ok(Math.abs(r - 0.5) < 1e-9, `km_reflectance=${r}`);

  // Cellular physics rules
  assert.equal(k.sand_can_displace(1, 2), 1, "sand sinks through water");
  assert.equal(k.sand_can_displace(2, 1), 0, "water cannot displace sand");
  assert.equal(k.sand_can_displace(1, 7), 0, "sand cannot displace glass");
  assert.equal(k.sand_thermal_react(1, 3), 7, "sand + high heat -> glass");
  assert.equal(k.sand_thermal_react(2, 1), 10, "water + heat -> steam");

  // Deterministic FNV-1a scene hash
  const h1 = k.scene_fnv1a(42, 960, 540, 10);
  const h2 = k.scene_fnv1a(42, 960, 540, 10);
  assert.equal(h1, h2);
  assert.notEqual(h1, k.scene_fnv1a(42, 960, 540, 11));
});
