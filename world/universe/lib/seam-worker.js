// seam-worker.js: renders a studio seam's held frames off the page thread.
// In: { key, from, to, payload, frames, w, h, seed }. Out: { key, i, bitmap } per frame, then { key, done }.
// The studio's motion lane holds a material's frames on its own cadence, so a seam is a short run of held
// frames, not a per-display-frame render.
import { transition } from "../../studio/lib/transition.mjs";
import { toRGBA } from "../../studio/lib/lanes/image.mjs";

self.onmessage = (e) => {
  const { key, from, to, payload, frames = 8, w = 240, h = 150, seed = 1 } = e.data;
  for (let i = 0; i < frames; i++) {
    try {
      const f = transition(from, to, payload, (i + 0.5) / frames);
      const rgba = toRGBA(f.image({ w, h, seed }), f.material);
      const c = new OffscreenCanvas(w, h);
      c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0);
      const bitmap = c.transferToImageBitmap();
      self.postMessage({ key, i, bitmap }, [bitmap]);
    } catch (err) {
      console.error("seam-worker: frame failed", key, i, err);
      self.postMessage({ key, i, error: String(err) });
    }
  }
  self.postMessage({ key, done: true });
};
