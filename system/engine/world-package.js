// system/engine/world-package.js
// The certified world package: the container the spatial renderer consumes and
// the gallery runtime serves. Pure ES module: no DOM, no GPU, node-testable.
//
// A package is one JSON manifest plus sidecar binaries (per-layer depth and
// mask fields, one splat block). The manifest carries the lane, the source
// receipt, the camera boundary, the temporal systems, the disclosure, and a
// SHA-256 receipt for every sidecar, so a package can be re-checked byte for
// byte before it is rendered or served.

export const WORLD_PACKAGE_SCHEMA = "zentropy.world-package/v1";

// The splat record layout shared with the renderer and the builder:
// position xyz, color rgb, size, alpha, kind, seed. Ten float32s.
export const SPLAT_RECORD_FLOATS = 10;
export const SPLAT_RECORD_BYTES = SPLAT_RECORD_FLOATS * 4;

// The material vocabulary a splat kind may declare. Structural imagery does
// not belong in splats; that is the hybrid boundary the lane carries.
export const SPLAT_KINDS = Object.freeze([
  "dust",
  "beam",
  "water",
  "stars",
  "spark",
  "bokeh",
  "haze",
  "glint",
]);

export const LANES = Object.freeze(["authored", "reconstruction"]);

export function validateWorldPackage(manifest) {
  if (!manifest || typeof manifest !== "object") {
    return fail("not_an_object", "manifest");
  }
  if (manifest.schema !== WORLD_PACKAGE_SCHEMA) {
    return fail("wrong_schema", "schema");
  }
  if (!LANES.includes(manifest.lane)) {
    return fail("unknown_lane", "lane");
  }
  if (typeof manifest.title !== "string" || !manifest.title.trim()) {
    return fail("missing_title", "title");
  }
  if (typeof manifest.seed !== "string" || !manifest.seed.trim()) {
    return fail("missing_seed", "seed");
  }
  if (typeof manifest.disclosure !== "string" || manifest.disclosure.length < 10) {
    return fail("missing_disclosure", "disclosure");
  }
  const camera = manifest.camera;
  if (!camera || typeof camera !== "object") return fail("missing_camera", "camera");
  for (const key of ["maxX", "maxY", "maxDolly"]) {
    const v = Number(camera[key]);
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      return fail("camera_boundary_out_of_range", `camera.${key}`);
    }
  }
  if (!Array.isArray(manifest.layers) || manifest.layers.length === 0) {
    return fail("missing_layers", "layers");
  }
  for (const [i, layer] of manifest.layers.entries()) {
    if (!layer || typeof layer.name !== "string" || !layer.name.trim()) {
      return fail("layer_missing_name", `layers[${i}].name`);
    }
    const depth = Number(layer.depth);
    if (!Number.isFinite(depth) || depth < 0 || depth > 1) {
      return fail("layer_depth_out_of_range", `layers[${i}].depth`);
    }
  }
  const splats = manifest.splats;
  if (!splats || typeof splats !== "object") return fail("missing_splats", "splats");
  if (!Number.isInteger(splats.count) || splats.count < 0) {
    return fail("bad_splat_count", "splats.count");
  }
  if (!Array.isArray(splats.kinds) || splats.kinds.some((k) => !SPLAT_KINDS.includes(k))) {
    return fail("unknown_splat_kind", "splats.kinds");
  }
  if (!manifest.receipts || typeof manifest.receipts !== "object") {
    return fail("missing_receipts", "receipts");
  }
  for (const [name, sha] of Object.entries(manifest.receipts)) {
    if (!/^[0-9a-f]{64}$/.test(String(sha))) {
      return fail("bad_receipt_hash", `receipts.${name}`);
    }
  }
  return { ok: true };
}

// Parse a splat sidecar into a Float32Array view, refusing torn records.
export function parseSplatRecords(bytes, declaredCount = null) {
  if (!bytes || typeof bytes.byteLength !== "number") {
    throw new Error("splat block: not a byte buffer");
  }
  if (bytes.byteLength % SPLAT_RECORD_BYTES !== 0) {
    throw new Error(
      `splat block: ${bytes.byteLength} bytes is not a multiple of the ` +
      `${SPLAT_RECORD_BYTES}-byte record`,
    );
  }
  const count = bytes.byteLength / SPLAT_RECORD_BYTES;
  if (declaredCount !== null && count !== declaredCount) {
    throw new Error(`splat block: manifest declares ${declaredCount} records, found ${count}`);
  }
  const data = bytes instanceof Float32Array
    ? bytes
    : new Float32Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength / 4);
  return { data, count };
}

// Clamp a parsed splat block to a tier budget (render-plan.js supplies the
// budget). Records are kept from the front: builders order them by visual
// priority, so a low tier keeps the load-bearing material.
export function clampToBudget(parsed, budget) {
  const limit = Math.max(0, Math.floor(Number(budget) || 0));
  if (!limit || parsed.count <= limit) {
    return { data: parsed.data, count: parsed.count, dropped: 0 };
  }
  return {
    data: parsed.data.subarray(0, limit * SPLAT_RECORD_FLOATS),
    count: limit,
    dropped: parsed.count - limit,
  };
}

// The run receipt a renderer exports: what was drawn, under which boundary,
// with which controls. Deliberately flat and JSON-safe.
export function buildRunReceipt(manifest, state = {}) {
  return Object.freeze({
    schema: "zentropy.world-package-run/v1",
    package: manifest.title,
    lane: manifest.lane,
    seed: manifest.seed,
    disclosure: manifest.disclosure,
    camera_boundary: {
      maxX: Number(manifest.camera.maxX),
      maxY: Number(manifest.camera.maxY),
      maxDolly: Number(manifest.camera.maxDolly),
    },
    splats_drawn: Number(state.splatsDrawn ?? manifest.splats.count),
    splats_dropped_for_budget: Number(state.splatsDropped ?? 0),
    controls: state.controls && typeof state.controls === "object" ? { ...state.controls } : {},
    receipts: { ...manifest.receipts },
  });
}

function fail(code, field) {
  return { ok: false, failureCode: code, field };
}

export default {
  WORLD_PACKAGE_SCHEMA,
  SPLAT_RECORD_FLOATS,
  SPLAT_RECORD_BYTES,
  SPLAT_KINDS,
  LANES,
  validateWorldPackage,
  parseSplatRecords,
  clampToBudget,
  buildRunReceipt,
};
