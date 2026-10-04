// system/media-engine/plugins/fractal.mjs
// The Studio's 2D fractal source, render half, as an engine plugin: one view drawn by fractal-gl.js
// on a WebGL canvas, or by fractal.js on a 2D canvas. The host page keeps everything around the
// draw: the preset and palette controls, the camera, mounting the GL canvas, sizing the backing,
// the CPU path's coarse-then-full progression, and the fall back to the CPU when the GPU path
// throws. Static, and it draws only the frame the host asked for: setParams() arms one frame and
// drawing it disarms, so the engine's own still frames never repaint the shared Studio canvas.
//
// params: { view, path }   view is fractal.js's options (type, centre, scale, maxIter, palette,
//                          aa, ...); path is "gl" or "cpu".
// After a frame, lastError holds what the GPU path threw (null when it drew), so the host can
// fall back as it did before the plugin existed.

import { renderFractal } from "../../fractal.js?v=20260903a";
import { renderFractalGL } from "../../fractal-gl.js?v=20260903a";

export const fractal = {
  id: "fractal",
  version: "1.0.0",
  backends: ["webgl", "canvas2d"],
  create({ canvas, params = {} }) {
    let p = { ...params };
    let armed = false;
    const inst = {
      backend: p.path === "gl" ? "webgl" : "canvas2d",
      static: true,
      lastError: null,
      frame() {
        if (!armed || !p.view) return;
        armed = false;
        inst.lastError = null;
        if (p.path === "gl") {
          try { renderFractalGL(canvas, p.view); }
          catch (e) { inst.lastError = e; }
        } else {
          renderFractal(canvas, p.view);
        }
      },
      setParams(next) { p = { ...p, ...next }; armed = true; inst.backend = p.path === "gl" ? "webgl" : "canvas2d"; },
      dispose() {},
    };
    return inst;
  },
};
