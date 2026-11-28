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

test("probeAllKernels executes and passes all 7 real BuildLang WASM binaries", async () => {
  const kernels = await loadAllFloorKernels();
  const report = probeAllKernels(kernels, { mix: 0.5, iorA: 1.5046, cutoff: 1800 });
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
    { mix: 0.0, iorA: 1.33, cutoff: 400 },
    { mix: 0.35, iorA: 1.62, cutoff: 1400 },
    { mix: 0.95, iorA: 2.25, cutoff: 5400 },
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
