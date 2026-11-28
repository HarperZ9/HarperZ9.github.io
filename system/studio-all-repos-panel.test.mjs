// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
//
// system/studio-all-repos-panel.test.mjs
// Verifies all pure helper logic and live supertool_kernel.wasm integration for studio-all-repos-panel.js.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeProse,
  verdictLabel,
  chunkAndMerkle,
  computeBftState,
  renderSuperframeToRgba,
  synthesizeFmBuffer,
  sha256Hex,
} from "./studio-all-repos-panel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.join(__dirname, "wasm", "supertool_kernel.wasm");

async function loadKernel() {
  const bytes = readFileSync(wasmPath);
  const imports = {
    env: new Proxy({}, { get: () => () => {} }),
  };
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance.exports;
}

test("analyzeProse counts em dashes, filler words, and words deterministically", () => {
  const clean = analyzeProse("Measured 39 renderer modules at 0 ULP parity.");
  assert.equal(clean.emDashes, 0);
  assert.equal(clean.fillerHits, 0);
  assert.equal(clean.wordCount, 8);

  const sloppy = analyzeProse("This is basically just very \u2014 really arguably broken.");
  assert.equal(sloppy.emDashes, 1);
  assert.equal(sloppy.fillerHits, 5);
  assert.equal(sloppy.wordCount, 8);
});

test("verdictLabel maps Flywheel WASM verdict codes cleanly", async () => {
  const wasm = await loadKernel();
  assert.equal(verdictLabel(wasm.flywheel_verdict(0.01, 0.05, 0.14)), "VERIFIED");
  assert.equal(verdictLabel(wasm.flywheel_verdict(0.09, 0.05, 0.14)), "REFUTED");
  assert.equal(verdictLabel(wasm.flywheel_verdict(0.01, 0.05, 0.02)), "INVALID_CONTROL");
});

test("chunkAndMerkle builds deterministic Merkle root through WASM merkle_combine", async () => {
  const wasm = await loadKernel();
  const a = chunkAndMerkle("Superframe 0.4.0 | Flywheel 2.1.0 | CMMNS 3.11.0", wasm, 16);
  const b = chunkAndMerkle("Superframe 0.4.0 | Flywheel 2.1.0 | CMMNS 3.11.0", wasm, 16);
  const c = chunkAndMerkle("Superframe 0.4.0 | Flywheel 2.1.0 | CMMNS 3.11.1", wasm, 16);
  assert.equal(a.chunks.length, 3);
  assert.equal(a.root, b.root);
  assert.notEqual(a.root, c.root);
  assert.match(a.rootHex, /^0x[0-9a-f]{8}$/);
});

test("computeBftState enforces 3f+1 Byzantine quorum via WASM bft_quorum_check", async () => {
  const wasm = await loadKernel();
  const q1 = computeBftState(new Set([0, 1]), 7, wasm);
  assert.equal(q1.agree, 5);
  assert.equal(q1.maxFaults, 2);
  assert.equal(q1.quorum, true);
  assert.equal(q1.status, "QUORUM REACHED");

  const q2 = computeBftState(new Set([0, 1, 2]), 7, wasm);
  assert.equal(q2.agree, 4);
  assert.equal(q2.quorum, false);
  assert.equal(q2.status, "FAIL-SAFE HALT");
});

test("renderSuperframeToRgba shades live pixels and computes Reference-vs-Fast RMSE/FLIP", async () => {
  const wasm = await loadKernel();
  const frame = renderSuperframeToRgba(wasm, { width: 32, height: 18, sunElev: 0.3, roughness: 0.3, iorA: 1.52, kmK: 0.25, splitPct: 50 });
  assert.equal(frame.rgba.length, 32 * 18 * 4);
  assert.ok(frame.rmse > 0 && frame.rmse < 0.5, `expected realistic RMSE, got ${frame.rmse}`);
  assert.ok(frame.flipProxy > 0 && frame.flipProxy <= 1.0, `expected bounded FLIP proxy, got ${frame.flipProxy}`);
  // Alpha channel is fully opaque
  assert.equal(frame.rgba[3], 255);
});

test("synthesizeFmBuffer produces bounded non-zero audio via WASM harmonic_fm_sample", async () => {
  const wasm = await loadKernel();
  const buf = synthesizeFmBuffer(wasm, { freqHz: 220, modIndex: 2.5, ratio: 2.0, sampleRate: 8000, durationSec: 0.1 });
  assert.equal(buf.length, 800);
  let peak = 0;
  for (let i = 0; i < buf.length; i++) {
    assert.ok(buf[i] >= -1 && buf[i] <= 1, `sample out of bounds: ${buf[i]}`);
    peak = Math.max(peak, Math.abs(buf[i]));
  }
  assert.ok(peak > 0.05, `expected audible peak, got ${peak}`);
});

test("sha256Hex produces a 64-hex SHA-256 receipt digest", async () => {
  const h1 = await sha256Hex("VERIFIED|0.01|0.05|0.14");
  const h2 = await sha256Hex("VERIFIED|0.01|0.05|0.14");
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
});
