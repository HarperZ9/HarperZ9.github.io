// assemble.mjs: the single COMPLETE layered readout (0-D scalars -> 1-D distributions -> 2-D pyramid).
//
// Tier-2 ADDITIVE: alongside every original field, this now folds in the science-grounded perception
// modules (colour-perceptual, audio-perceptual, vision-biomimetic) via perception-extras. The heavy
// math (OKLab k-means, Laplacian pyramid, spectral-residual FFT, SSIM/WPIR, YIN) lives in those pure
// helpers and runs ONLY here, on the send-time perception path (fullPerception() calls this), never in
// the interactive per-frame render loop (measure()), which keeps its own cheap richFeatures/pyramid.
//
// Every original key is preserved (dimensions, phash, the advisory scalars, dominantColours, hueName,
// distributions, motion, audio, source, multiScale). New keys sit beside them. No em-dashes (ASCII).
import { richFeatures } from "./features.mjs";
import { pyramid } from "./pyramid.mjs";
import { lumaHistogram, hueHistogram } from "./distributions.mjs";
import { colourPerception, audioPerception, visionPerception } from "./perception-extras.mjs";

export function assembleFullPerception(px, w, h, ch = 4, pre = {}) {
  const rich = richFeatures(px, w, h, ch);
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);

  // Tier-2 send-time readouts (heavy; here only). Colour reuses the rich swatches as the WPRE palette.
  const colour = colourPerception(px, w, h, rich.dominantSwatches || [], { volume: pre.colourVolume });
  const vision = visionPerception(px, w, h);
  // Audio is additive: keep the original scalar `pre.audio` (level/pitch/spectrumBands) verbatim, and
  // layer the perceptual fields when raw analyser buffers are present. Null (honest) when no source.
  const audioPerc = audioPerception(pre.audio);

  return {
    dimensions: {
      w, h, orientation: rich.orientation, aspect: rich.aspect,
      // spec C: canvas dims + an aspect-native cell grid on every payload.
      canvasWidthPx: w, canvasHeightPx: h, cells: vision.cells,
    },
    phash: pre.phash != null ? String(pre.phash) : null,
    contrast: num(pre.contrast), structure: num(pre.structure), balance: num(pre.balance),
    coverage: num(pre.coverage), edgeDensity: num(rich.edgeDensity),
    light: num(rich.lightRegions), dark: num(rich.darkRegions), meanLuma: num(rich.meanLuma),
    // ORIGINAL naive-sRGB dominant colours preserved (other code + tests read this).
    dominantColours: (rich.dominantSwatches || []).map((s) => ({ hex: s.hex, fraction: s.frac })),
    // NEW: hue-stable OKLCH dominant colours with spatial centroids + the colour-volume tag.
    dominantColoursOklab: colour.dominantColoursOklab,
    colourVolumeTag: colour.colourVolumeTag,
    hueName: rich.hueName || "unknown",
    distributions: { luma: lumaHistogram(px, w, h, ch, 16), hue: hueHistogram(px, w, h, ch, 12) },
    motion: num(pre.motion),
    // ORIGINAL audio scalar bundle preserved verbatim; perceptual axis added as audioPerceptual.
    audio: pre.audio ? scalarAudio(pre.audio) : null,
    audioPerceptual: audioPerc,
    source: pre.source || "unknown",
    // multiScale: the original box-average pyramid PLUS the biomimetic vision extension fields.
    multiScale: {
      ...pyramid(px, w, h, ch, [4, 8, 16, 32, 64, 128]),
      contrastLowFreq: vision.contrastLowFreq,
      contrastHighFreq: vision.contrastHighFreq,
      saliencyCells: vision.saliencyCells,
      redundantCells: vision.redundantCells,
      perCellCoords: vision.perCellCoords,
      gridRoles: vision.gridRoles,
      aspectNative: vision.aspectNative,
      workingResolution: vision.workingResolution,
    },
    // SELF-IMPROVEMENT: the three per-sense fidelity metrics in one place (null where not measurable).
    fidelity: {
      wpre: colour.wpre,
      pbe: audioPerc ? audioPerc.pbe.mean : null,
      wpir: vision.wpir,
    },
  };
}

// Keep only the JSON-friendly scalar audio fields on the preserved `audio` key (strip any raw typed
// arrays the caller passed for the perceptual path, so the original payload shape is unchanged).
function scalarAudio(a) {
  if (!a || typeof a !== "object") return a || null;
  const out = {};
  if (typeof a.level === "number") out.level = a.level;
  if (typeof a.pitch === "number") out.pitch = a.pitch;
  if (Array.isArray(a.spectrumBands)) out.spectrumBands = a.spectrumBands;
  return out;
}
