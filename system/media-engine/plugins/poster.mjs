// system/media-engine/plugins/poster.mjs
// The Studio's Poster source, render half, as an engine plugin: poster.js's renderPoster draws the
// art layer, the optional retro and glitch treatments, the veil and the type blocks. The workshop
// (poster-panel.js) keeps its controls, the debounce, the critique and the perception call, and
// asks this plugin for each frame. Static, and it draws only the frame the host asked for:
// setParams() arms one frame and drawing it disarms, so the engine's own still frames (on mount,
// a theme or visibility change) never resize or repaint the shared Studio canvas, which another
// source may own by then.
//
// params: { state, deps }   state is the workshop's poster state (read live, not copied); deps
//                           are renderPoster's injected functions (renderSpecimen, drawImage,
//                           renderRetro, applyOps).

import { renderPoster } from "../../poster.js";

export const poster = {
  id: "poster",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params = {} }) {
    let p = { ...params };
    let armed = false;
    const inst = {
      backend: "canvas2d",
      static: true,
      // What renderPoster returned for the last frame drawn: { ok, boxes, ... }.
      lastResult: null,
      frame() {
        if (!armed || !p.state) return;
        armed = false;
        inst.lastResult = renderPoster(canvas, p.state, p.deps || {});
      },
      setParams(next) { p = { ...p, ...next }; armed = true; },
      readPixels() {
        const c = canvas.getContext("2d", { willReadFrequently: true });
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
    return inst;
  },
};
