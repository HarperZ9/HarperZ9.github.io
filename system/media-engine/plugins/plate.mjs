// system/media-engine/plugins/plate.mjs
// The Gallery's plate as an engine plugin: generative-field.js renderSpecimen drawn once per
// request, never animated. A seeded plate repeats exactly, so the plugin redraws only when the
// recipe or the canvas size changes, and every frame it reports is the same pixels for the same
// request. Plates whose layers read the aperture palette also redraw when the theme changes.
//
// Two modes:
//   params: { layers: string[], fx?: string[], fxAmount?: number }   seed: any string
//   params: { fromDataset: true }   the canvas's data-specimen, data-specimen-layers,
//     data-specimen-fx and data-specimen-fx-amount are the recipe, read at every draw. This is how
//     nav.js mounts every plate on every page, so a page script that reseeds a plate (the Gallery's
//     "draw again") stays the source of truth, as it was under mountSpecimens.

import { renderSpecimen, specimenLayerNames, loadSpecimenOps, specimenUsesAperture } from "../../generative-field.js?v=20260925-void-plates";

export { specimenLayerNames };

export const DEFAULT_LAYERS = Object.freeze(["caustic-veils"]);
// The default mountSpecimens used for a canvas with no layers named.
const SPECIMEN_DEFAULT = null;

const list = (v) => String(v || "").split(",").map((n) => n.trim()).filter(Boolean);

// The recipe for one draw: seed, layers, fx and amount, from params or from the canvas dataset.
export function plateRecipe(canvas, params, seed) {
  if (params && params.fromDataset) {
    const d = canvas.dataset || {};
    const layers = list(d.specimenLayers);
    return { seed: d.specimen || "specimen", layers: layers.length ? layers : SPECIMEN_DEFAULT, fx: list(d.specimenFx), fxAmount: Number(d.specimenFxAmount || 0.6) };
  }
  const p = { layers: DEFAULT_LAYERS, ...params };
  return { seed: String(seed), layers: p.layers, fx: p.fx || [], fxAmount: p.fxAmount !== undefined ? +p.fxAmount : 0.6 };
}

let themeGen = 0;
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("themechange", () => { themeGen += 1; });

export const plate = {
  id: "plate",
  version: "1.1.0",
  backends: ["canvas2d"],
  create({ canvas, params, seed, requestRedraw = () => {} }) {
    let p = { ...params }, s = String(seed);
    const key = () => {
      const r = plateRecipe(canvas, p, s);
      return JSON.stringify([r.seed, r.layers, r.fx, r.fxAmount, specimenUsesAperture(r.layers || []) ? themeGen : 0]);
    };
    // A plate a page script already drew counts as drawn: the first frame would repeat it.
    const pre = !!(canvas.dataset && canvas.dataset.specimenRendered === "true");
    let drawn = pre ? key() : "", size = pre ? canvas.width + "x" + canvas.height : "";
    return {
      backend: "canvas2d",
      static: true,
      frame() {
        const k = key();
        if (drawn === k && size === canvas.width + "x" + canvas.height) return;
        const r = plateRecipe(canvas, p, s);
        // Same order as mountSpecimens: draw at once so the plate is never blank, then develop it
        // with the treatment rack once the rack module arrives.
        const ok = r.layers ? renderSpecimen(canvas, r.seed, r.layers) : renderSpecimen(canvas, r.seed);
        if (ok && r.fx.length) {
          loadSpecimenOps().then(() => {
            if (key() !== k) return;   // the recipe moved on while the rack loaded
            if (r.layers) renderSpecimen(canvas, r.seed, r.layers, r.fx, r.fxAmount);
            else renderSpecimen(canvas, r.seed, undefined, r.fx, r.fxAmount);
            size = canvas.width + "x" + canvas.height;
          }, (e) => console.error("[plate] treatment rack failed to load:", e));
        }
        if (ok && canvas.dataset) canvas.dataset.specimenRendered = "true";
        drawn = k; size = canvas.width + "x" + canvas.height;
      },
      setParams(next) { p = { ...p, ...next }; if (next.seed != null) s = String(next.seed); requestRedraw(); },
      readPixels() {
        const c = canvas.getContext("2d");
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
  },
};
