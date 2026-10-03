// system/media-engine/plugins/plate.mjs
// The Gallery's plate as an engine plugin: generative-field.js renderSpecimen drawn once per
// request, never animated. A seeded plate repeats exactly, so the plugin redraws only when the seed
// or the instruments change, and every frame it reports is the same pixels for the same request.
//
// params: { layers: string[] }   seed: any string

import { renderSpecimen, specimenLayerNames } from "../../generative-field.js?v=20260925-void-plates";

export { specimenLayerNames };

export const DEFAULT_LAYERS = Object.freeze(["caustic-veils"]);

export const plate = {
  id: "plate",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params, seed }) {
    let p = { layers: DEFAULT_LAYERS, ...params }, s = String(seed), drawn = "";
    const key = () => s + "|" + p.layers.join(",") + "|" + canvas.width + "x" + canvas.height;
    return {
      backend: "canvas2d",
      static: true,
      frame() {
        if (drawn === key()) return;
        renderSpecimen(canvas, s, p.layers);
        drawn = key();
      },
      setParams(next) { p = { ...p, ...next }; if (next.seed != null) s = String(next.seed); },
      readPixels() {
        const c = canvas.getContext("2d");
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
  },
};
