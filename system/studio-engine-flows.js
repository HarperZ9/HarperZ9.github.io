// studio-engine-flows.js: the creative suite's shared workflows across engine surfaces.
//
// Every surface gets the same action row, in the same order, so the keyboard path is the same on
// each one: Send to Retro, Weave in Loom, Export frame and receipt, then the surface's own page.
//   - Send to Retro / Weave in Loom copy the frame on the stage and hand it to that plugin as its
//     input (params.source). The receiving surface names where its input came from and the input's
//     SHA-256, so a chain of plugins stays traceable.
//   - Export frame and receipt saves a PNG of the stage and a JSON receipt beside it: the request
//     (plugin, version, params, seed, time, backend), its hash, and the hash of the pixels.

import { frameReceipt, digest } from "./media-engine/receipt.mjs";

let pending = null;   // { canvas, from, hash }

// Copy the stage and remember it for the next surface that accepts an input.
export async function stageHandoff(canvas, from) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const ctx = copy.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const px = ctx.getImageData(0, 0, copy.width, copy.height).data;
  pending = { canvas: copy, from, hash: await digest(new Uint8Array(px.buffer)) };
  return pending;
}

// The input waiting for a receiving surface, taken once.
export function takeHandoff() { const h = pending; pending = null; return h; }

function save(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// PNG of what is on the stage now, plus the receipt for exactly those pixels.
export async function exportWithReceipt(canvas, { plugin, version, params, seed, backend, input }) {
  const ctx = canvas.getContext("2d");
  const px = new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
  const request = { plugin, version, params: plainParams(params), seed: String(seed), backend, size: [canvas.width, canvas.height] };
  if (input) request.input = { from: input.from, sha256: input.hash };
  const receipt = await frameReceipt(request, px);
  const stem = "studio-" + plugin + "-" + receipt.pixelHash.slice(0, 12);
  const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (png) save(png, stem + ".png");
  save(new Blob([JSON.stringify(receipt, null, 2) + "\n"], { type: "application/json" }), stem + ".receipt.json");
  return receipt;
}

// Receipts carry data, not live objects: drop canvases and functions from the parameters.
function plainParams(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v == null || typeof v === "function" || (typeof v === "object" && "getContext" in v)) continue;
    out[k] = v;
  }
  return out;
}
