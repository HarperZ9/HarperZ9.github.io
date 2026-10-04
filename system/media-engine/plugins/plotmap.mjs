// system/media-engine/plugins/plotmap.mjs
// The Studio's Plot maps source, render half, as an engine plugin: a built plot sheet (the field
// studies, the composer, a picture or plate composition, a voxel build, a sketch, or a blend)
// drawn with plot-maps.js in the Studio's still view. Building the sheet stays with the host page,
// which owns the material, study, register and blend controls and hands the plugin the result.
// Static: it draws only on request.
//
// params: { sheet, view }   sheet is a plot sheet { layers, meta }; view is the still-view state.

import { renderPlotMap } from "../../plot-maps.js";

export const plotmap = {
  id: "plotmap",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params = {} }) {
    let p = { ...params };
    const inst = {
      backend: "canvas2d",
      static: true,
      // The content rect of the last frame, for the perception panel's content-rect contract.
      lastRect: null,
      frame() {
        if (!p.sheet) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        inst.lastRect = renderPlotMap(ctx, p.sheet, canvas.width, canvas.height, {}, { view: p.view });
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
