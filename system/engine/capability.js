// system/engine/capability.js
// Stage 1 of the Telos scalable engine: the capability PROBE and the capability -> tier mapping.
// Zero external dependencies. Pure ES module. ASCII only (no em-dashes anywhere).
//
// Two layers, deliberately separated so the decision math is node-testable while the probe stays
// browser-only:
//
//   deriveTier(cap)            PURE. Given a capability record, return "low" | "mid" | "high" | "max".
//                              No DOM, no globals. This is the unit under test.
//   selectBackend(cap, tier)   PURE. Given the capability record + tier, return the particle backend
//                              rung: "webgpu" | "webgl2" | "cpu". The backend-selection ladder.
//   pickTier(cap, override)    PURE. Resolve an Auto/Low/Mid/High/Max override against the auto tier.
//   probeCapability()          BROWSER-ONLY (async). Builds the real capability record from
//                              navigator / WebGL2 / WebGPU. Never throws; absence is reported as a
//                              null/false field, never a fabricated capability (honest-null).
//
// Research basis (SPEC-telos-scalable-engine.md, web-verified 2026-06-25; confidence labels inline):
//  - navigator.hardwareConcurrency exists everywhere but WebKit caps it (8 macOS / 2 iOS) for
//    anti-fingerprinting, so it sizes the worker pool ONLY, never the GPU tier (high).
//  - navigator.deviceMemory is Chromium-only and quantized/capped at 8 (high).
//  - WebGPU adapter.limits are bucketed (a 16384 GPU may report 8192), so threshold against bucket
//    values, not arbitrary numbers (high). maxComputeWorkgroupStorageSize == 16384 is present on
//    ~100% of surveyed WebGPU devices (high), so it is the portable "real WebGPU" gate.
//  - requestAdapter() never rejects; it resolves null when unavailable. Canonical detect:
//    if (!navigator.gpu) return null; then await adapter then device (high).
//  - SharedArrayBuffer requires crossOriginIsolated (COOP/COEP), which GitHub Pages cannot set, so
//    sab defaults false and is only a detected enhancement (high).

// ---------------------------------------------------------------------------
// PURE: tier derivation (the unit under test)
// ---------------------------------------------------------------------------

// The four tiers, ordered weakest -> strongest. Exported so callers and tests share the vocabulary.
export const TIERS = ["low", "mid", "high", "max"];

// Default particle budgets per tier (governor-corrected starting points, NOT hard caps).
// "low" stays at today's behavior class so nothing regresses on a weak device (~280-class, raised
// modestly to 3000 since the CPU loop in particles-cpu.js is the same cost per particle as today).
export const TIER_BUDGETS = Object.freeze({
  low: 3000,
  mid: 100000,
  high: 250000,
  max: 1000000,
});

// The portable WebGPU workgroup-storage bucket: 16384 bytes is the spec floor and is present on
// ~100% of surveyed WebGPU devices, so it is the gate for a genuine "high" WebGPU path (vs a
// degraded/blacklisted adapter that reports a smaller bucket).
export const WEBGPU_WORKGROUP_STORAGE_BUCKET = 16384;
// Desktop-class texture-dimension bucket that lifts a WebGPU device from "high" to "max".
export const WEBGPU_MAX_TEXTURE_BUCKET = 16384;

// deriveTier(cap) -> "low" | "mid" | "high" | "max"
// cap is the frozen capability record (see probeCapability). Pure; never throws on a partial record.
// Rules (from the spec's tier table, bucket-aligned):
//   low  : no WebGPU AND no WebGL2 (WebGL1 / Canvas2D only), OR prefers-reduced-motion.
//   mid  : WebGL2 present, WebGPU absent.
//   high : WebGPU present with the portable 16384 workgroup-storage bucket.
//   max  : WebGPU present AND a desktop-class texture-dimension bucket (>= 16384) or a large
//          storage-buffer bucket.
export function deriveTier(cap) {
  const c = cap || {};

  // prefers-reduced-motion is an explicit accessibility floor: force low regardless of hardware.
  if (c.reducedMotion === true) return "low";

  const gpu = c.webgpu || null;
  if (gpu) {
    const limits = gpu.limits || {};
    const wgStorage = numOr(limits.maxComputeWorkgroupStorageSize, 0);
    const maxTex = numOr(limits.maxTextureDimension2D, 0);
    const maxStorageBuf = numOr(limits.maxStorageBufferBindingSize, 0);

    // A genuine WebGPU compute device clears the portable workgroup-storage bucket.
    if (wgStorage >= WEBGPU_WORKGROUP_STORAGE_BUCKET) {
      // Desktop-class: a big 2D texture dimension OR a large (>128 MB) storage buffer bucket -> max.
      if (maxTex >= WEBGPU_MAX_TEXTURE_BUCKET || maxStorageBuf >= 128 * 1024 * 1024) return "max";
      return "high";
    }
    // WebGPU present but the adapter reports a sub-bucket storage size (degraded/blacklisted):
    // do not trust it for compute. Fall through to the WebGL2 decision.
  }

  // No trusted WebGPU compute path: WebGL2 -> mid, otherwise low.
  if (c.webgl2) return "mid";
  return "low";
}

// numOr(v, d): coerce v to a finite number, else default d. Keeps deriveTier total on partial records.
function numOr(v, d) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}

// ---------------------------------------------------------------------------
// PURE: the backend-selection ladder (the three-rung fallback, A.3)
// ---------------------------------------------------------------------------

// selectBackend(cap, tier) -> "webgpu" | "webgl2" | "cpu"
// The interface is the contract; a module never branches on the backend. Selection is exactly this
// function: capability probe + tier. The ladder degrades rung by rung and ALWAYS lands on a runnable
// floor ("cpu"), which is the universal guaranteed path (graceful degradation is mandatory).
//   1. webgpu : tier high|max AND a trusted WebGPU device is present.
//   2. webgl2 : WebGL2 present AND EXT_color_buffer_float available (transform feedback for 1D
//               particle state does not itself need float-render, but the spec ties the mid GPU rung
//               to the float-buffer guard so a mobile WebGL2 without it degrades honestly).
//   3. cpu    : the universal floor (today's Canvas2D loop), used for tier low and whenever the GPU
//               rungs are unavailable.
export function selectBackend(cap, tier) {
  const c = cap || {};
  const t = tier || deriveTier(c);

  // Forcing (or auto-deriving) the low tier pins the backend to the CPU floor regardless of what the
  // GPU could do. This is the point of the low tier: "today's behavior, main thread" (the spec tier
  // table). A user who forces Low gets the guaranteed Canvas2D path, not a GPU rung.
  if (t === "low") return "cpu";

  if ((t === "high" || t === "max") && c.webgpu) return "webgpu";

  // The mid GPU rung. Transform feedback for 1D particles is broadly available where WebGL2 is, but
  // we keep the float-buffer guard so a device that auto-tiered to mid but lacks the float extension
  // does not silently pick a path it cannot fully run; it falls to cpu, which always runs.
  if (c.webgl2 && c.webgl2.colorBufferFloat) return "webgl2";

  return "cpu";
}

// ---------------------------------------------------------------------------
// PURE: tier override resolution (Auto / Low / Mid / High / Max)
// ---------------------------------------------------------------------------

// pickTier(cap, override) -> tier
// override is "auto" (or falsy) to use the auto-derived tier, or one of TIERS to force it. A forced
// tier is CLAMPED to what the hardware can actually run so the user cannot force "max" on a device
// with no WebGPU (which would just jank); forcing DOWN is always allowed (a sandbag is honored).
export function pickTier(cap, override) {
  const auto = deriveTier(cap);
  if (!override || override === "auto") return auto;
  if (!TIERS.includes(override)) return auto;

  const autoIdx = TIERS.indexOf(auto);
  const wantIdx = TIERS.indexOf(override);
  // Forcing weaker-or-equal: honor it. Forcing stronger: clamp to what the hardware supports (auto),
  // because deriveTier is the ceiling of what this device can run without the governor thrashing.
  return wantIdx <= autoIdx ? override : auto;
}

// workerPoolSize(cap) -> integer in [1, 4]
// hardwareConcurrency sizes the pool ONLY (never the GPU tier). min(cores - 1, 4), floored at 1.
export function workerPoolSize(cap) {
  const cores = numOr(cap && cap.cores, 4);
  return Math.max(1, Math.min(4, Math.floor(cores) - 1));
}

// ---------------------------------------------------------------------------
// BROWSER-ONLY: the real probe
// ---------------------------------------------------------------------------

// probeCapability() -> Promise<frozen capability record>
// Runs once at engine boot. Never throws; every absence is an honest null/false. The WebGPU probe
// requests an adapter+device (requestAdapter resolves null when unavailable, never rejects).
export async function probeCapability() {
  const cap = {
    cores: 4,
    deviceMemory: null,
    webgpu: null,
    webgl2: null,
    webgl1: false,
    offscreenCanvas: false,
    workers: false,
    sab: false,
    reducedMotion: false,
  };

  // navigator-derived (guarded; some fields are Chromium-only).
  try {
    if (typeof navigator !== "undefined") {
      if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0) {
        cap.cores = navigator.hardwareConcurrency;
      }
      if (typeof navigator.deviceMemory === "number") cap.deviceMemory = navigator.deviceMemory;
    }
  } catch (_) { /* honest-null on any access error */ }

  // workers + OffscreenCanvas + SAB (crossOriginIsolated).
  try { cap.workers = typeof Worker !== "undefined"; } catch (_) {}
  try {
    cap.offscreenCanvas = typeof OffscreenCanvas !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function";
  } catch (_) {}
  try { cap.sab = (typeof globalThis !== "undefined" && globalThis.crossOriginIsolated === true); } catch (_) {}

  // prefers-reduced-motion.
  try {
    if (typeof matchMedia === "function") {
      cap.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches === true;
    }
  } catch (_) {}

  // WebGL1 / WebGL2 (a throwaway canvas; mirror fractal-gl.js's isFractalGLAvailable pattern).
  try {
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      const gl1 = c.getContext("webgl") || c.getContext("experimental-webgl");
      cap.webgl1 = !!gl1;
      const c2 = document.createElement("canvas");
      const gl2 = c2.getContext("webgl2");
      if (gl2) {
        const colorBufferFloat = !!gl2.getExtension("EXT_color_buffer_float");
        let maxTextureSize = 0;
        try { maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE) || 0; } catch (_) {}
        cap.webgl2 = { maxTextureSize, colorBufferFloat };
      }
    }
  } catch (_) { /* honest-null: no WebGL is a real, reported state */ }

  // WebGPU (async; requestAdapter resolves null, never rejects).
  try {
    if (typeof navigator !== "undefined" && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        let device = null;
        try { device = await adapter.requestDevice(); } catch (_) { device = null; }
        // Snapshot the limits we threshold against (bucketed values; see deriveTier).
        const lim = adapter.limits || {};
        cap.webgpu = {
          adapter,
          device,
          limits: {
            maxComputeWorkgroupStorageSize: numOr(lim.maxComputeWorkgroupStorageSize, 0),
            maxTextureDimension2D: numOr(lim.maxTextureDimension2D, 0),
            maxStorageBufferBindingSize: numOr(lim.maxStorageBufferBindingSize, 0),
            maxComputeInvocationsPerWorkgroup: numOr(lim.maxComputeInvocationsPerWorkgroup, 0),
          },
        };
      }
    }
  } catch (_) { cap.webgpu = null; }

  return Object.freeze(cap);
}

export default { TIERS, TIER_BUDGETS, deriveTier, selectBackend, pickTier, workerPoolSize, probeCapability };
