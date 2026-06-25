// system/engine/capability.test.mjs
// Node:test suite for the PURE capability -> tier mapping and the backend-selection ladder.
// No DOM, no WebGPU, no WebGL: tests the deterministic decision math only (the probe itself is
// browser-only and not exercised here). Run: node --test system/engine/capability.test.mjs
// ASCII only.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveTier, selectBackend, pickTier, workerPoolSize, TIERS, TIER_BUDGETS,
  WEBGPU_WORKGROUP_STORAGE_BUCKET, WEBGPU_MAX_TEXTURE_BUCKET,
} from "./capability.js";

// ---------------------------------------------------------------------------
// Mocked capability records
// ---------------------------------------------------------------------------
function capNone() {
  // Lowest-end: no WebGPU, no WebGL2, WebGL1 only or even Canvas2D only.
  return { cores: 4, deviceMemory: null, webgpu: null, webgl2: null, webgl1: true,
           offscreenCanvas: false, workers: false, sab: false, reducedMotion: false };
}
function capWebGL2(colorBufferFloat = true) {
  return { cores: 8, deviceMemory: 8, webgpu: null,
           webgl2: { maxTextureSize: 8192, colorBufferFloat }, webgl1: true,
           offscreenCanvas: true, workers: true, sab: false, reducedMotion: false };
}
function capWebGPUHigh() {
  // WebGPU present, portable workgroup bucket, modest texture dimension -> high.
  return { cores: 8, deviceMemory: 8,
           webgpu: { adapter: {}, device: {}, limits: {
             maxComputeWorkgroupStorageSize: WEBGPU_WORKGROUP_STORAGE_BUCKET,
             maxTextureDimension2D: 8192,
             maxStorageBufferBindingSize: 64 * 1024 * 1024,
           } },
           webgl2: { maxTextureSize: 8192, colorBufferFloat: true }, webgl1: true,
           offscreenCanvas: true, workers: true, sab: false, reducedMotion: false };
}
function capWebGPUMax() {
  // Desktop-class: big texture dimension -> max.
  return { cores: 16, deviceMemory: 8,
           webgpu: { adapter: {}, device: {}, limits: {
             maxComputeWorkgroupStorageSize: WEBGPU_WORKGROUP_STORAGE_BUCKET,
             maxTextureDimension2D: WEBGPU_MAX_TEXTURE_BUCKET,
             maxStorageBufferBindingSize: 256 * 1024 * 1024,
           } },
           webgl2: { maxTextureSize: 16384, colorBufferFloat: true }, webgl1: true,
           offscreenCanvas: true, workers: true, sab: false, reducedMotion: false };
}
function capWebGPUDegraded() {
  // WebGPU present but reports a sub-bucket workgroup storage (blacklisted/degraded): do NOT trust
  // it for compute; should fall to the WebGL2 (mid) decision.
  return { cores: 8, deviceMemory: 8,
           webgpu: { adapter: {}, device: {}, limits: {
             maxComputeWorkgroupStorageSize: 8192,    // below the 16384 portable bucket
             maxTextureDimension2D: 8192,
             maxStorageBufferBindingSize: 64 * 1024 * 1024,
           } },
           webgl2: { maxTextureSize: 8192, colorBufferFloat: true }, webgl1: true,
           offscreenCanvas: true, workers: true, sab: false, reducedMotion: false };
}

// ---------------------------------------------------------------------------
// deriveTier
// ---------------------------------------------------------------------------
test("deriveTier: no WebGPU and no WebGL2 -> low", () => {
  assert.equal(deriveTier(capNone()), "low");
});

test("deriveTier: WebGL2 present, WebGPU absent -> mid", () => {
  assert.equal(deriveTier(capWebGL2()), "mid");
});

test("deriveTier: WebGPU with the portable 16384 workgroup bucket -> high", () => {
  assert.equal(deriveTier(capWebGPUHigh()), "high");
});

test("deriveTier: WebGPU with a desktop-class texture bucket -> max", () => {
  assert.equal(deriveTier(capWebGPUMax()), "max");
});

test("deriveTier: a degraded WebGPU adapter (sub-bucket storage) is not trusted -> falls to mid", () => {
  assert.equal(deriveTier(capWebGPUDegraded()), "mid");
});

test("deriveTier: prefers-reduced-motion forces low regardless of hardware", () => {
  const cap = capWebGPUMax();
  cap.reducedMotion = true;
  assert.equal(deriveTier(cap), "low");
});

test("deriveTier never throws on a partial/empty record and defaults to low", () => {
  assert.equal(deriveTier({}), "low");
  assert.equal(deriveTier(null), "low");
  assert.equal(deriveTier(undefined), "low");
  assert.equal(deriveTier({ webgpu: { limits: {} } }), "low");   // present but no usable limits
});

test("deriveTier: a large storage-buffer bucket alone (with the workgroup bucket) lifts to max", () => {
  const cap = capWebGPUHigh();
  cap.webgpu.limits.maxTextureDimension2D = 8192;             // not desktop-class by texture
  cap.webgpu.limits.maxStorageBufferBindingSize = 256 * 1024 * 1024; // but a big storage buffer
  assert.equal(deriveTier(cap), "max");
});

// ---------------------------------------------------------------------------
// selectBackend (the three-rung ladder)
// ---------------------------------------------------------------------------
test("selectBackend: high/max with WebGPU -> webgpu", () => {
  assert.equal(selectBackend(capWebGPUHigh(), "high"), "webgpu");
  assert.equal(selectBackend(capWebGPUMax(), "max"), "webgpu");
});

test("selectBackend: mid with WebGL2 + colorBufferFloat -> webgl2", () => {
  assert.equal(selectBackend(capWebGL2(true), "mid"), "webgl2");
});

test("selectBackend: WebGL2 WITHOUT colorBufferFloat degrades to cpu", () => {
  assert.equal(selectBackend(capWebGL2(false), "mid"), "cpu");
});

test("selectBackend: low tier always -> cpu (the universal floor)", () => {
  assert.equal(selectBackend(capNone(), "low"), "cpu");
  assert.equal(selectBackend(capWebGL2(true), "low"), "cpu");   // tier forced low overrides webgl2
});

test("selectBackend: degraded WebGPU at mid tier -> webgl2 (not webgpu)", () => {
  // deriveTier said mid for the degraded adapter; the ladder must not pick webgpu.
  const cap = capWebGPUDegraded();
  assert.equal(selectBackend(cap, "mid"), "webgl2");
});

test("selectBackend: the ladder always lands on a runnable rung (never null/undefined)", () => {
  for (const cap of [capNone(), capWebGL2(true), capWebGL2(false), capWebGPUHigh(), capWebGPUMax()]) {
    const b = selectBackend(cap, deriveTier(cap));
    assert.ok(["webgpu", "webgl2", "cpu"].includes(b), `got ${b}`);
  }
});

test("selectBackend: tier omitted falls back to deriveTier internally", () => {
  assert.equal(selectBackend(capWebGPUHigh()), "webgpu");
  assert.equal(selectBackend(capNone()), "cpu");
});

// ---------------------------------------------------------------------------
// pickTier (Auto / forced override with clamp-up)
// ---------------------------------------------------------------------------
test("pickTier: auto returns the derived tier", () => {
  assert.equal(pickTier(capWebGPUHigh(), "auto"), "high");
  assert.equal(pickTier(capWebGPUHigh(), null), "high");
  assert.equal(pickTier(capNone()), "low");
});

test("pickTier: forcing DOWN is honored", () => {
  assert.equal(pickTier(capWebGPUMax(), "low"), "low");
  assert.equal(pickTier(capWebGPUMax(), "mid"), "mid");
  assert.equal(pickTier(capWebGPUHigh(), "low"), "low");
});

test("pickTier: forcing UP is clamped to what the hardware supports", () => {
  // A low-end device cannot be forced to max; it clamps to the auto tier (low).
  assert.equal(pickTier(capNone(), "max"), "low");
  // A mid device forced to high clamps to mid.
  assert.equal(pickTier(capWebGL2(true), "high"), "mid");
});

test("pickTier: an unknown override string falls back to auto", () => {
  assert.equal(pickTier(capWebGPUHigh(), "ultra"), "high");
});

// ---------------------------------------------------------------------------
// workerPoolSize (hardwareConcurrency sizes the pool ONLY)
// ---------------------------------------------------------------------------
test("workerPoolSize: min(cores-1, 4), floored at 1", () => {
  assert.equal(workerPoolSize({ cores: 16 }), 4);
  assert.equal(workerPoolSize({ cores: 8 }), 4);
  assert.equal(workerPoolSize({ cores: 4 }), 3);
  assert.equal(workerPoolSize({ cores: 2 }), 1);
  assert.equal(workerPoolSize({ cores: 1 }), 1);
  assert.equal(workerPoolSize({}), 3);          // default cores 4 -> 3
});

// ---------------------------------------------------------------------------
// vocabulary / budgets sanity
// ---------------------------------------------------------------------------
test("TIERS is the ordered weakest->strongest vocabulary", () => {
  assert.deepEqual(TIERS, ["low", "mid", "high", "max"]);
});

test("TIER_BUDGETS are monotonic and match the spec targets (3k/100k/250k/1M)", () => {
  assert.equal(TIER_BUDGETS.low, 3000);
  assert.equal(TIER_BUDGETS.mid, 100000);
  assert.equal(TIER_BUDGETS.high, 250000);
  assert.equal(TIER_BUDGETS.max, 1000000);
  assert.ok(TIER_BUDGETS.low < TIER_BUDGETS.mid);
  assert.ok(TIER_BUDGETS.mid < TIER_BUDGETS.high);
  assert.ok(TIER_BUDGETS.high < TIER_BUDGETS.max);
});
