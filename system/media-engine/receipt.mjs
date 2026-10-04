// system/media-engine/receipt.mjs
// The one receipt layer for engine frames and for receipted media files.
//
// Frame receipts are superstack receipts (`superstack.receipt/1`, from the vendored contract in
// contracts.mjs): the request as the scene, its time in integer flicks, the SHA-256 of the RGBA
// bytes as content, a reconcile block with two verdicts (byte identity, MATCH or DRIFT, and
// tolerance, verified, refuted or unverifiable) when a reference drew the same request, the
// sentences the receipt does not prove, and a seal over the canonical body. verifyReceipt() in the
// contract checks any of them without re-rendering.
//
// Hashing of bytes goes through Web Crypto when the page has it and the contract's own SHA-256
// otherwise; both give the same digest. Requests for media documents are still canonicalised by
// system/media/ir.js (re-exported below as stableStringify).

import {
  RECEIPT_SCHEMA, FLICKS_PER_SECOND, SEED_RULE, SEED_RULES, RGB8_TOLERANCE,
  canonicalSha256, sha256, xmur3, seal, identity, reconcileRgb8, round6, verifyReceipt,
} from "./contracts.mjs";
import { stableStringify } from "../media/ir.js";

export { verifyReceipt };

// SHA-256 hex of bytes through Web Crypto only, or null where there is none (an insecure context).
// Callers that must report UNVERIFIABLE rather than compute a digest in script use this one.
export async function digestOrNull(bytes) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return null;
  const buf = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 hex of bytes, always: Web Crypto when present, the contract's implementation otherwise.
export async function digest(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer || bytes, bytes.byteOffset || 0, bytes.byteLength);
  try { const hex = await digestOrNull(u8); if (hex) return hex; } catch (_) {
    // Web Crypto refused (for example an insecure context); the contract's SHA-256 gives the same digest.
  }
  return sha256(u8);
}

// Compare bytes against an expected SHA-256 and name the verdict the site uses everywhere.
export async function verifyBytes(bytes, expected) {
  const hex = await digestOrNull(bytes);
  if (hex == null || !expected) return { verdict: "UNVERIFIABLE", hash: hex };
  return { verdict: hex === expected ? "MATCH" : "DRIFT", hash: hex };
}

// Seconds as the contract's integer clock.
export const toFlicks = (seconds) => Math.round((Number(seconds) || 0) * FLICKS_PER_SECOND);

// The site's frame bound beside the contract's: RMSE over RGB on a 0..1 scale (the scale
// raw-native's certificates use) at most 2/255, and the contract's mean absolute error of at most
// one level. Tolerance is verified only when both hold.
export const FRAME_TOLERANCE = Object.freeze({ ...RGB8_TOLERANCE, rmse_max: 2 / 255 });

const rgbOf = (rgba) => {
  const out = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { out[j] = rgba[i]; out[j + 1] = rgba[i + 1]; out[j + 2] = rgba[i + 2]; }
  return out;
};

// Reconcile a frame against a reference render of the same request. Returns the contract's block
// without its reference field: identity over the RGBA bytes, and tolerance over RGB with the
// contract's metrics plus RMSE and maximum error on a 0..1 scale. Different sizes, or a missing
// reference, read unverifiable with the reason.
export async function reconcileFrame(rgba, refRgba, { tolerance = FRAME_TOLERANCE.rmse_max } = {}) {
  const bounds = { ...RGB8_TOLERANCE, rmse_max: tolerance };
  if (!rgba || !refRgba || rgba.length !== refRgba.length || !rgba.length || rgba.length % 4) {
    const why = !rgba ? "the frame has no pixels" : !refRgba ? "the reference returned no pixels" : "size differs from the reference";
    return { identity: "DRIFT", tolerance: { verdict: "unverifiable", metrics: {}, bounds, reason: why }, refHash: refRgba ? await digest(refRgba) : "" };
  }
  const [candHash, refHash] = await Promise.all([digest(rgba), digest(refRgba)]);
  const block = reconcileRgb8(rgbOf(refRgba), rgbOf(rgba), RGB8_TOLERANCE);
  let sq = 0, max = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) { const d = Math.abs(rgba[i + c] - refRgba[i + c]) / 255; sq += d * d; if (d > max) max = d; }
  }
  const rmse = Math.sqrt(sq / ((rgba.length / 4) * 3));
  const metrics = { ...block.tolerance.metrics, rmse: round6(rmse), max_error: round6(max) };
  const verdict = block.tolerance.verdict === "verified" && rmse <= tolerance ? "verified" : "refuted";
  return { identity: identity(refHash, candHash), tolerance: { verdict, metrics, bounds }, refHash };
}

const FRAME_LIMITS = [
  "The hash covers these RGBA bytes from this backend on this device; another GPU, driver or browser may draw different bytes for the same request.",
  "A frame hash does not show that the picture is right, or how it looks on another display.",
];

// frameReceipt: what was asked for (the request is the scene: plugin, version, params, seed,
// backend, time in flicks) and what came out (SHA-256 of the RGBA bytes). Re-rendering the same
// request on the same backend and device class must give the same content hash; across GPUs it
// may not, and the receipt names the backend so a mismatch is attributable rather than silent.
//
// reference: null when nobody asked for one. Otherwise { backend, rgba, kind } after a reference
// render, or { backend, reason, kind } when none could run (backend "none" when the scene kind has
// no reference at all). seedRule names the contract rule the plugin's seed goes through; without
// one the seed string stays in the scene and the receipt's seed fields say nothing.
export async function frameReceipt(request, rgba, { width = null, height = null, reference = null, seedRule = null, tolerance, doesNotProve = [] } = {}) {
  const { t = 0, ...rest } = request;
  const scene = { kind: "media-engine.request/1", ...rest, t_flicks: toFlicks(t) };
  if (scene.seed != null) scene.seed = String(scene.seed);
  const rule = seedRule && SEED_RULES.includes(seedRule) ? seedRule : null;
  const seed = rule && scene.seed != null ? scene.seed : null;
  const pixels = rgba ? new Uint8Array(rgba.buffer || rgba, rgba.byteOffset || 0, rgba.byteLength ?? rgba.length) : new Uint8Array(0);
  const content = await digest(pixels);
  const limits = [...FRAME_LIMITS, ...doesNotProve];
  if (!rgba) limits.push("This plugin exposes no pixels, so content_sha256 is the hash of zero bytes.");
  if (!seed && scene.seed != null) limits.push("The plugin's seed path is not a contract seed rule, so seed_u32 is not stated; the seed string is in the scene.");
  let rc = null;
  if (reference) {
    const kind = reference.kind || null;
    if (reference.rgba) {
      const r = await reconcileFrame(pixels, reference.rgba, tolerance ? { tolerance } : {});
      rc = { reference: { backend: reference.backend, content_sha256: r.refHash, scene_kind: kind }, identity: r.identity, tolerance: r.tolerance };
    } else {
      rc = { reference: { backend: reference.backend || "none", content_sha256: "", scene_kind: kind }, identity: "DRIFT",
        tolerance: { verdict: "unverifiable", metrics: {}, bounds: { ...FRAME_TOLERANCE }, reason: reference.reason || "no reference render" } };
      limits.push("No reference drew this request, so the identity verdict compares against no bytes and the tolerance verdict is unverifiable.");
    }
  } else {
    limits.push("No reference renderer drew this request, so nothing here checks the frame against an independent path.");
  }
  return seal({
    schema: RECEIPT_SCHEMA,
    producer: { name: "harperz9-media-engine/" + (rest.plugin || "frame"), version: String(rest.version || "0") },
    backend: String(rest.backend || "unknown"),
    scene_sha256: canonicalSha256(scene),
    scene,
    seed, seed_rule: rule || SEED_RULE, seed_u32: seed !== null && (rule || SEED_RULE) === SEED_RULE ? xmur3(seed) : null,
    time: { base: "flicks", per_second: FLICKS_PER_SECOND, t: scene.t_flicks },
    media: { kind: "image", width, height, format: "rgba8", transfer: "srgb-u8", bytes: pixels.length },
    content_sha256: content,
    outputs: {},
    reconcile: rc,
    does_not_prove: limits,
  });
}

// The frame hash and the plugin a receipt covers, for file names and readouts.
export const receiptPixels = (r) => (r && r.content_sha256) || null;
export const receiptPlugin = (r) => (r && r.scene && r.scene.plugin) || "frame";

export { stableStringify };
