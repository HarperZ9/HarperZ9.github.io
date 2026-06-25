// assemble.mjs: the single COMPLETE layered readout (0-D scalars → 1-D distributions → 2-D pyramid).
import { richFeatures } from "./features.mjs";
import { pyramid } from "./pyramid.mjs";
import { lumaHistogram, hueHistogram } from "./distributions.mjs";
export function assembleFullPerception(px, w, h, ch = 4, pre = {}) {
  const rich = richFeatures(px, w, h, ch);
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
  return {
    dimensions: { w, h, orientation: rich.orientation, aspect: rich.aspect },
    phash: pre.phash != null ? String(pre.phash) : null,
    contrast: num(pre.contrast), structure: num(pre.structure), balance: num(pre.balance),
    coverage: num(pre.coverage), edgeDensity: num(rich.edgeDensity),
    light: num(rich.lightRegions), dark: num(rich.darkRegions), meanLuma: num(rich.meanLuma),
    dominantColours: (rich.dominantSwatches || []).map((s) => ({ hex: s.hex, fraction: s.frac })),
    hueName: rich.hueName || "unknown",
    distributions: { luma: lumaHistogram(px, w, h, ch, 16), hue: hueHistogram(px, w, h, ch, 12) },
    motion: num(pre.motion), audio: pre.audio || null, source: pre.source || "unknown",
    multiScale: pyramid(px, w, h, ch, [4, 8, 16, 32, 64, 128]),
  };
}
