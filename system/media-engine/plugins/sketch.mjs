// system/media-engine/plugins/sketch.mjs
// The Studio's Sketch source, render half, as an engine plugin: a freehand sketch (sketch.js)
// turned into a plot sheet in its mark register and drawn with plot-maps.js, guides under the
// drawing. The pen (pointer capture, live symmetry feedback) stays with the host page, which owns
// the sketch object and asks for a frame after each stroke. Static: it draws only on request.
//
// params: { sketch, register = "drawn", guide = "none" }   sketch is a createSketch() object.

import { renderPlotMap } from "../../plot-maps.js";

export const sketch = {
  id: "sketch",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params = {} }) {
    let p = { register: "drawn", guide: "none", ...params };
    const inst = {
      backend: "canvas2d",
      static: true,
      // The sheet and content rect of the last frame, for the host's readout and the perception
      // panel's content-rect contract.
      lastSheet: null,
      lastRect: null,
      frame() {
        if (!p.sketch) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        const sheet = p.sketch.toSheet({ register: p.register });
        // Guides render UNDER the drawing, support-toned, and stay out of the sheet itself.
        const guides = p.guide === "none" ? [] : p.sketch.guideLayers(p.guide);
        inst.lastRect = renderPlotMap(ctx, { layers: guides.concat(sheet.layers), meta: sheet.meta }, canvas.width, canvas.height, {});
        inst.lastSheet = sheet;
      },
      setParams(next) { p = { ...p, ...next }; },
      readPixels() {
        const c = canvas.getContext("2d", { willReadFrequently: true });
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
    return inst;
  },
};
