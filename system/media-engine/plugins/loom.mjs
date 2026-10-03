// system/media-engine/plugins/loom.mjs
// The Loom as an engine plugin: any frame in, woven cloth out. The input is a seeded Gallery plate
// by default, or any canvas passed as params.source (a Retro frame, a Studio render). The draft
// maths and the thread renderer are the Loom page's own (weave-engine.js, weave-render.js), so the
// cloth drawn here is the cloth loom.html would draw for the same frame and settings.
//
// params: { structure: "plain" | "twill22" | "satin5" | "overshot" | "jacquard", ends, layers, source? }

import { STRUCTURES, computeDraft, weftPaletteFor, draftToWIF } from "../../weave-engine.js?v=20260813-wif";
import { renderCloth } from "../../weave-render.js?v=20260902-thread";
import { renderSpecimen } from "../../generative-field.js?v=20260925-void-plates";

export const STRUCTURE_IDS = Object.freeze(Object.keys(STRUCTURES));
const WARP = "#e8e2d4";

// Sample a frame onto the ends x picks grid, contrast-stretched (loom-studio.js sample()).
export function sampleFrame(src, ends) {
  const picks = Math.max(24, Math.round(ends * (src.height / src.width)));
  const g = document.createElement("canvas"); g.width = ends; g.height = picks;
  const ctx = g.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, ends, picks);
  const px = ctx.getImageData(0, 0, ends, picks).data;
  const luma = new Float32Array(ends * picks), rowRGB = [];
  for (let p = 0; p < picks; p++) {
    let r = 0, gr = 0, b = 0;
    for (let e = 0; e < ends; e++) {
      const o = (p * ends + e) * 4;
      luma[p * ends + e] = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
      r += px[o]; gr += px[o + 1]; b += px[o + 2];
    }
    rowRGB.push([r / ends, gr / ends, b / ends]);
  }
  const sorted = Float32Array.from(luma).sort();
  const lo = sorted[(sorted.length * 0.02) | 0], hi = sorted[(sorted.length * 0.98) | 0];
  const span = Math.max(0.05, hi - lo);
  for (let i = 0; i < luma.length; i++) luma[i] = Math.max(0, Math.min(1, (luma[i] - lo) / span));
  return { ends, picks, luma, rowRGB };
}

export const loom = {
  id: "loom",
  version: "1.0.0",
  backends: ["canvas2d"],
  create({ canvas, params, seed }) {
    let p = { structure: "jacquard", ends: 96, layers: ["caustic-veils"], ...params }, s = String(seed);
    let drawn = "", draft = null, colors = null;
    const plateCanvas = document.createElement("canvas");
    const key = () => [s, p.structure, p.ends, p.layers.join(","), p.source ? "src" : "plate", canvas.clientWidth, canvas.clientHeight].join("|");
    return {
      backend: "canvas2d",
      static: true,
      frame() {
        if (drawn === key()) return;
        let src = p.source;
        if (!src) { renderSpecimen(plateCanvas, s, p.layers, null, 0.6, { size: [320, 200] }); src = plateCanvas; }
        const { ends, picks, luma, rowRGB } = sampleFrame(src, p.ends);
        draft = computeDraft(luma, ends, picks, p.structure, { toneDrive: 0.6 });
        const pal = weftPaletteFor(draft, (k) => rowRGB[k], "image");
        colors = { warpHex: WARP, weftHexes: pal.hexes, weftHexAt: (k) => pal.hexes[pal.indexAt(k)], weftIndexAt: pal.indexAt };
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        renderCloth(canvas, draft, colors, { light: 0.65, maxWidth: Math.max(320, canvas.clientWidth * dpr), maxHeight: Math.max(240, canvas.clientHeight * dpr) });
        drawn = key();
      },
      setParams(next) { p = { ...p, ...next }; if (next.seed != null) s = String(next.seed); },
      // The weaver's file for the cloth on screen (WIF 1.1), so the Studio can hand it out.
      wif() { return draft ? draftToWIF(draft, { warpHex: WARP, weftHexes: colors.weftHexes, weftIndexAt: colors.weftIndexAt }) : null; },
      readPixels() {
        const c = canvas.getContext("2d");
        return new Uint8Array(c.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
      },
      dispose() {},
    };
  },
};
