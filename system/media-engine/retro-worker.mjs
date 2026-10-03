// system/media-engine/retro-worker.mjs
// The Retro front half off the main thread. The page sends one ImageBitmap snapshot of the source
// per frame; this worker downscales it on an OffscreenCanvas with the same smoothing renderRetro
// uses, runs quantizeGrid (the same function renderRetro calls), and sends the grid's RGBA bytes
// back as a transfer. The tube stage stays with the page, which owns the WebGL2 context.

import { quantizeGrid, gridSize } from "../retro-engine.js?v=20261003-worker";

let cv = null, ctx = null;

self.onmessage = ({ data }) => {
  const { id, bitmap, opts } = data;
  const t0 = performance.now();
  try {
    const [tw, th] = gridSize(bitmap.width, bitmap.height, opts.targetWidth);
    // No willReadFrequently here: on the machine this was measured on, an OffscreenCanvas with that
    // hint downscaled up to 2 levels away from the page's canvas, and without it the bytes match.
    // The page checks the first frame against its own front half and stops using the worker if
    // they ever differ (plugins/retro.mjs).
    if (!cv) { cv = new OffscreenCanvas(tw, th); ctx = cv.getContext("2d"); }
    if (cv.width !== tw) cv.width = tw;
    if (cv.height !== th) cv.height = th;
    ctx.clearRect(0, 0, tw, th);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, tw, th);
    bitmap.close();
    const img = ctx.getImageData(0, 0, tw, th);
    const { pal, entries } = quantizeGrid(img.data, tw, th, opts);
    // ms: the worker's own time for this frame, so the page can report the cost it moved, not hide it.
    self.postMessage({ id, tw, th, bytes: img.data.buffer, colors: pal.length, entries, ms: performance.now() - t0 }, [img.data.buffer]);
  } catch (e) {
    if (bitmap && bitmap.close) bitmap.close();
    self.postMessage({ id, error: String(e && e.message || e) });
  }
};
