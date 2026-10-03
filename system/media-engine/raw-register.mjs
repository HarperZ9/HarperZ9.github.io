// system/media-engine/raw-register.mjs
// Fills the "raw" slot and the "wasm-raw" reference backend with raw-native's WebAssembly build.
// Importing this module only registers loaders: nothing is fetched until a page mounts "raw" or asks
// a receipt for a reference render.

import { registerPlugin } from "./page.mjs";
import { registerReferenceBackend } from "./core.mjs";

registerPlugin("raw", () => import("./plugins/raw.mjs").then((m) => m.raw));
// The reference for 3D rasterized frames. It always runs raw-native's CPU build (rawReference),
// the exact path; the GPU build is never its own reference.
registerReferenceBackend("wasm-raw", {
  exact: true,
  render: (request) => import("./plugins/raw.mjs").then((m) => m.rawReference.render(request)),
}, { kinds: ["raster3d"] });
