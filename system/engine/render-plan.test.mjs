// system/engine/render-plan.test.mjs
// Tests for the generalized hardware render planner. No DOM or GPU required.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeHardwareRenderPlan,
  estimateSceneLoad,
} from "./render-plan.js";
import {
  WEBGPU_WORKGROUP_STORAGE_BUCKET,
  WEBGPU_MAX_TEXTURE_BUCKET,
} from "./capability.js";

function capLow() {
  return { cores: 4, webgpu: null, webgl2: null, reducedMotion: false, workers: false, offscreenCanvas: false };
}

function capMid() {
  return {
    cores: 8,
    webgpu: null,
    webgl2: { maxTextureSize: 8192, colorBufferFloat: true },
    workers: true,
    offscreenCanvas: true,
    reducedMotion: false,
  };
}

function capHigh() {
  return {
    cores: 8,
    webgpu: { limits: {
      maxComputeWorkgroupStorageSize: WEBGPU_WORKGROUP_STORAGE_BUCKET,
      maxTextureDimension2D: 8192,
      maxStorageBufferBindingSize: 64 * 1024 * 1024,
    }},
    webgl2: { maxTextureSize: 8192, colorBufferFloat: true },
    workers: true,
    offscreenCanvas: true,
    reducedMotion: false,
  };
}

function capMax() {
  return {
    cores: 16,
    webgpu: { limits: {
      maxComputeWorkgroupStorageSize: WEBGPU_WORKGROUP_STORAGE_BUCKET,
      maxTextureDimension2D: WEBGPU_MAX_TEXTURE_BUCKET,
      maxStorageBufferBindingSize: 256 * 1024 * 1024,
    }},
    webgl2: { maxTextureSize: 16384, colorBufferFloat: true },
    workers: true,
    offscreenCanvas: true,
    reducedMotion: false,
  };
}

test("makeHardwareRenderPlan maps low hardware to CPU-safe budgets", () => {
  const plan = makeHardwareRenderPlan(capLow(), { width: 1920, height: 1080, dpr: 2 });

  assert.equal(plan.tier, "low");
  assert.equal(plan.backend, "cpu");
  assert.equal(plan.workerMode, "main");
  assert.equal(plan.shaderQuality, "basic");
  assert.ok(plan.particleBudget <= 3000);
  assert.ok(plan.splatBudget <= 25000);
  assert.equal(plan.readbackEveryNFrames, 4);
});

test("makeHardwareRenderPlan maps WebGL2 hardware to mid render budgets", () => {
  const plan = makeHardwareRenderPlan(capMid(), { width: 1440, height: 900, dpr: 1.5 });

  assert.equal(plan.tier, "mid");
  assert.equal(plan.backend, "webgl2");
  assert.equal(plan.workerMode, "worker");
  assert.equal(plan.shaderQuality, "standard");
  assert.ok(plan.particleBudget >= 75000);
  assert.ok(plan.textureMax <= 4096);
});

test("makeHardwareRenderPlan maps trusted WebGPU hardware to high and max plans", () => {
  const high = makeHardwareRenderPlan(capHigh(), { width: 2560, height: 1440, dpr: 1 });
  const max = makeHardwareRenderPlan(capMax(), { width: 3840, height: 2160, dpr: 1 });

  assert.equal(high.tier, "high");
  assert.equal(high.backend, "webgpu");
  assert.equal(high.shaderQuality, "high");
  assert.ok(high.splatBudget >= 250000);

  assert.equal(max.tier, "max");
  assert.equal(max.backend, "webgpu");
  assert.equal(max.shaderQuality, "path");
  assert.ok(max.splatBudget > high.splatBudget);
  assert.ok(max.postPassBudget > high.postPassBudget);
});

test("makeHardwareRenderPlan floors motion-heavy plans when reduced motion is active", () => {
  const cap = capMax();
  cap.reducedMotion = true;

  const plan = makeHardwareRenderPlan(cap, { width: 1920, height: 1080, dpr: 1 });

  assert.equal(plan.tier, "low");
  assert.equal(plan.backend, "cpu");
  assert.equal(plan.reason, "reduced-motion");
});

test("estimateSceneLoad increases with resolution, splats, meshes, and post passes", () => {
  const small = estimateSceneLoad({ width: 640, height: 480, dpr: 1, splats: 0, meshes: 1, postPasses: 0 });
  const heavy = estimateSceneLoad({ width: 3840, height: 2160, dpr: 2, splats: 1000000, meshes: 20, postPasses: 6 });

  assert.ok(heavy > small);
  assert.ok(small > 0);
});
