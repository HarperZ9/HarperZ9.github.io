// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  FLOOR_WASM_KERNELS,
  WASM_NOOP_ENV,
  probeKernelExports,
  probeAllKernels,
} from "./floor-wasm-runner.js";
import {
  TEN_DOMAINS,
  createUnifiedStateBus,
  computeStateDigestHex,
} from "./studio-state-bus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadAllFloorKernels() {
  const map = new Map();
  for (const meta of FLOOR_WASM_KERNELS) {
    const bytes = await readFile(join(__dirname, "wasm", meta.file));
    const { instance } = await WebAssembly.instantiate(bytes, WASM_NOOP_ENV);
    map.set(meta.id, instance.exports);
  }
  return map;
}

test("FLOOR_WASM_KERNELS lists all 7 compiled BuildLang WASM kernels", () => {
  assert.equal(FLOOR_WASM_KERNELS.length, 7);
  const ids = FLOOR_WASM_KERNELS.map((k) => k.id);
  for (const expected of [
    "supertool_kernel",
    "estuary_kernel",
    "plotter_loom_kernel",
    "type_forge_kernel",
    "glass_optics_kernel",
    "fluid_well_kernel",
    "daw_synth_kernel",
  ]) {
    assert.ok(ids.includes(expected), `missing kernel ${expected}`);
  }
});

test("TEN_DOMAINS enforces exact 10 cohesive studio domains backed by the 7 BuildLang WASM kernels", () => {
  assert.equal(TEN_DOMAINS.length, 10);
  const labels = TEN_DOMAINS.map((d) => d.label);
  assert.deepEqual(labels, [
    "1. Tools",
    "2. Engine",
    "3. Exhibit",
    "4. Motion & Film",
    "5. Data & Visualizer",
    "6. Sound",
    "7. Ink & Water",
    "8. Mosaic",
    "9. Type & Lettering",
    "10. Light & Glass",
  ]);
  const validKernelIds = new Set(FLOOR_WASM_KERNELS.map((k) => k.id));
  for (const d of TEN_DOMAINS) {
    assert.ok(d.kernels.length >= 2, `${d.id} must be backed by BuildLang WASM kernels`);
    for (const kid of d.kernels) {
      assert.ok(validKernelIds.has(kid), `${d.id} references unknown kernel ${kid}`);
    }
  }
});

test("createUnifiedStateBus propagates cross-domain updates reactively and updates WASM receiptSha256", async () => {
  const kernels = await loadAllFloorKernels();
  const stWasm = kernels.get("supertool_kernel");
  const bus = createUnifiedStateBus({}, stWasm);
  const seen = [];
  const unsub = bus.subscribe((snap, origin) => seen.push({ domain: snap.activeDomain, origin, hash: snap.receiptSha256 }));

  const h0 = bus.getState().receiptSha256;
  assert.match(h0, /^[0-9a-f]{16}$/);

  const s1 = bus.update({ activeDomain: "light-glass", optics: { iorA: 1.72, filmNm: 520 } }, "optics");
  assert.equal(s1.activeDomain, "light-glass");
  assert.equal(s1.optics.iorA, 1.72);
  assert.notEqual(s1.receiptSha256, h0, "optics edit must update shared receipt digest");

  const s2 = bus.update({ activeDomain: "ink-water", fluid: { wetness: 0.88 }, typeText: "Estuary" }, "fluid");
  assert.equal(s2.fluid.wetness, 0.88);
  assert.equal(s2.typeText, "Estuary");
  assert.notEqual(s2.receiptSha256, s1.receiptSha256, "fluid/type edit must update shared receipt digest");
  assert.equal(seen.length, 2);

  // Deterministic digest verification
  assert.equal(computeStateDigestHex(s2, stWasm), s2.receiptSha256);
  unsub();
  bus.update({ activeDomain: "sound" }, "after-unsub");
  assert.equal(seen.length, 2, "unsubscribed listener should not fire");
});

test("probeAllKernels executes and passes all 7 real BuildLang WASM binaries", async () => {
  const kernels = await loadAllFloorKernels();
  const report = probeAllKernels(kernels, { mix: 0.5, iorA: 1.5046, cutoff: 1800, wetness: 0.45 });
  assert.equal(report.total, 7);
  assert.equal(report.passed, 7, JSON.stringify(report.results, null, 2));
  assert.equal(report.allOk, true);
  for (const r of report.results) {
    assert.equal(r.ok, true, `${r.id}: ${r.summary}`);
    assert.ok(r.summary.length > 8, `${r.id} should report numeric telemetry`);
  }
});

test("probeAllKernels remains finite and passes across parameter sweep", async () => {
  const kernels = await loadAllFloorKernels();
  for (const params of [
    { mix: 0.0, iorA: 1.33, cutoff: 400, wetness: 0.0 },
    { mix: 0.35, iorA: 1.62, cutoff: 1400, wetness: 0.55 },
    { mix: 0.95, iorA: 2.25, cutoff: 5400, wetness: 1.0 },
  ]) {
    const report = probeAllKernels(kernels, params);
    assert.equal(report.allOk, true, `sweep ${JSON.stringify(params)} failed: ${JSON.stringify(report.results)}`);
  }
});

test("probeKernelExports reports offline cleanly when kernel is null", () => {
  const res = probeKernelExports("glass_optics_kernel", null);
  assert.equal(res.ok, false);
  assert.match(res.summary, /not loaded/);
});
