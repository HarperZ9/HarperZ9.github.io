// studio-perception-worker.mjs: the Studio's live perception, off the main thread. The page reads a
// bounded frame (at most 512 px on the long edge) and transfers the bytes here; this runs the same
// pure functions the main thread runs in measure(): the dHash and advisory features from eye.js,
// sense-core's richFeatures, and the 32 x 32 mosaic. The client checks the first result against a
// main-thread run on the same bytes and retires the worker on any difference.
import { perceptualHash, features } from "../shared-frame/eye.js";
import { richFeatures, boxAverage } from "./lib/sense-core/features.mjs";

self.onmessage = ({ data }) => {
  const t0 = performance.now();
  try {
    const px = new Uint8ClampedArray(data.buffer), { w, h, n } = data;
    const phash = perceptualHash(px, w, h, 4);
    const f = features(px, w, h, 4);
    const rich = richFeatures(px, w, h, 4);
    const mosaic = boxAverage(px, w, h, 4, n).grid;
    self.postMessage({ id: data.id, phash, f, rich, mosaic, ms: performance.now() - t0 });
  } catch (e) {
    self.postMessage({ id: data.id, error: String((e && e.message) || e) });
  }
};
