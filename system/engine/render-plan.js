// system/engine/render-plan.js
// Generalized hardware render planner for the Telos engine.
// Pure ES module: converts a capability record + scene load into concrete budgets.

import {
  deriveTier,
  pickTier,
  selectBackend,
  TIER_BUDGETS,
} from "./capability.js";

const SPLAT_BUDGETS = Object.freeze({
  low: 25000,
  mid: 120000,
  high: 400000,
  max: 1200000,
});

const TEXTURE_MAX = Object.freeze({
  low: 2048,
  mid: 4096,
  high: 8192,
  max: 16384,
});

const POST_PASSES = Object.freeze({
  low: 0,
  mid: 2,
  high: 4,
  max: 8,
});

const SHADER_QUALITY = Object.freeze({
  low: "basic",
  mid: "standard",
  high: "high",
  max: "path",
});

const READBACK_EVERY = Object.freeze({
  low: 4,
  mid: 2,
  high: 1,
  max: 1,
});

export function makeHardwareRenderPlan(capability, scene = {}, override = "auto") {
  const cap = capability || {};
  const tier = pickTier(cap, override);
  const backend = normalizeBackend(selectBackend(cap, tier), tier);
  const load = estimateSceneLoad(scene);
  const renderScale = renderScaleFor(tier, load, scene);

  return Object.freeze({
    schema: "project-telos.hardware-render-plan/v1",
    tier,
    backend,
    workerMode: shouldUseWorker(cap, backend) ? "worker" : "main",
    particleBudget: budgetWithLoad(TIER_BUDGETS[tier] || TIER_BUDGETS.low, load, tier),
    splatBudget: budgetWithLoad(SPLAT_BUDGETS[tier] || SPLAT_BUDGETS.low, load, tier),
    textureMax: TEXTURE_MAX[tier] || TEXTURE_MAX.low,
    renderScale,
    shaderQuality: SHADER_QUALITY[tier] || SHADER_QUALITY.low,
    readbackEveryNFrames: READBACK_EVERY[tier] || READBACK_EVERY.low,
    postPassBudget: POST_PASSES[tier] || POST_PASSES.low,
    sceneLoad: load,
    reason: cap.reducedMotion === true ? "reduced-motion" : "capability",
  });
}

export function estimateSceneLoad(scene = {}) {
  const width = pos(scene.width, 1280);
  const height = pos(scene.height, 720);
  const dpr = Math.max(1, Math.min(4, Number(scene.dpr) || 1));
  const megapixels = (width * height * dpr * dpr) / 1000000;
  const splats = Math.max(0, Number(scene.splats) || 0) / 250000;
  const meshes = Math.max(0, Number(scene.meshes) || 0) * 0.15;
  const post = Math.max(0, Number(scene.postPasses) || 0) * 0.2;
  const volume = Math.max(0, Number(scene.volumes) || 0) * 0.5;
  return round2(Math.max(0.1, megapixels + splats + meshes + post + volume));
}

function normalizeBackend(backend, tier) {
  if (backend === "webgpu" || backend === "webgl2") return backend;
  if (tier === "mid") return "webgl2";
  return "cpu";
}

function shouldUseWorker(cap, backend) {
  if (backend === "cpu") return false;
  return !!(cap && cap.workers && cap.offscreenCanvas);
}

function budgetWithLoad(base, load, tier) {
  if (tier === "low") return Math.floor(base);
  if (load <= 4) return Math.floor(base);
  if (load <= 10) return Math.floor(base * 0.75);
  return Math.floor(base * 0.5);
}

function renderScaleFor(tier, load, scene) {
  if (scene && typeof scene.renderScale === "number") {
    return clamp(scene.renderScale, 0.25, 1);
  }
  const ceiling = tier === "low" ? 0.75 : tier === "mid" ? 0.9 : 1;
  if (load <= 4) return ceiling;
  if (load <= 10) return round2(Math.max(0.5, ceiling - 0.15));
  return round2(Math.max(0.35, ceiling - 0.3));
}

function pos(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export default { makeHardwareRenderPlan, estimateSceneLoad };
