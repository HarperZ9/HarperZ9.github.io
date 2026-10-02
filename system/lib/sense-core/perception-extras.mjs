// perception-extras.mjs - the SEND-TIME wiring that folds the Tier-2 science modules
// (colour-perceptual, audio-perceptual, vision-biomimetic) into the model payload.
//
// Pure + zero-dependency. Every function here is called ONLY from assembleFullPerception, which runs
// on the perception/snapshot path (fullPerception() at send time), NEVER inside the interactive
// per-frame render loop. The heavy math (k-means, Laplacian pyramid, spectral-residual FFT, SSIM,
// YIN) is therefore paid once per model turn, not per animation frame.
//
// Performance discipline (the binding constraint): the vision readouts run on a DOWNSAMPLED working
// luma (VISION_WORK px on the long edge), and the per-cell readouts on a small VISION_CELLS x N grid,
// never the full backing resolution (up to 1600px). The colour k-means + WPRE use sampleStride to cap
// the pixel count. Each cap is named and commented so the cost is auditable.
//
// HONEST ABSENCE: audioPerception returns null when no real audio buffers are supplied; it never
// fabricates a spectrum. No em-dashes anywhere (ASCII only).

import {
  srgbByteToLab, dominantColoursOklab, colourVolumeTag, wpre,
} from "./colour-perceptual.mjs";
import {
  erbBands, fftBinFreqs, spectralCentroid, spectralRolloff,
  chroma12, yinPitch, iso226Phon, phonToSone,
} from "./audio-perceptual.mjs";
import {
  toLinearLuma, laplacianPyramid, spectralResidualSaliency,
  perCellSpatialCoords, redundancyFlags,
} from "./vision-biomimetic.mjs";

// ---- caps (named so the send-time cost is auditable) ---------------------------------------------
const COLOUR_SAMPLE_TARGET = 4096; // k-means + WPRE run on ~this many sampled pixels, not all of them.
const COLOUR_K = 4;                // dominant-colour cluster count (spec: report ~4 OKLCH centroids).
const VISION_WORK = 64;            // long-edge px of the downsampled luma the pyramid/SSIM/FFT run on.
const VISION_CELLS = 16;           // cols x rows for per-cell saliency/redundancy (16, not 128: cheap).

// A sampleStride that lands near `target` samples for an n-pixel frame (>= 1).
function strideFor(nPixels, target) {
  return Math.max(1, Math.floor(nPixels / Math.max(1, target)));
}

// ---- COLOUR ---------------------------------------------------------------------------------------
// OKLCH dominant colours (hue-stable k-means in OKLab) + colour-volume tag + the WPRE fidelity score.
// pixels: Uint8ClampedArray RGBA. The palette for WPRE is the richFeatures sRGB swatches converted to
// CIELAB (a real palette-vs-frame error in the space CIEDE2000 lives in), so WPRE scores the readout
// the model is actually shown. opts.volume: optional {gamut, transfer, peakNits} passthrough tag.
export function colourPerception(pixels, w, h, swatches = [], opts = {}) {
  const n = (pixels.length / 4) | 0;
  const stride = strideFor(n, COLOUR_SAMPLE_TARGET);
  const oklch = dominantColoursOklab(pixels, COLOUR_K, { width: w, height: h, sampleStride: stride });
  // Build the CIELAB palette from the sRGB dominant swatches (each carries r,g,b). Fall back to the
  // OKLCH areas being unusable -> empty palette -> WPRE returns 0 (honest: nothing to score against).
  const paletteLab = (Array.isArray(swatches) ? swatches : [])
    .filter(s => s && Number.isFinite(s.r) && Number.isFinite(s.g) && Number.isFinite(s.b))
    .map(s => srgbByteToLab(s.r, s.g, s.b));
  const wpreScore = paletteLab.length ? wpre(pixels, paletteLab, { sampleStride: stride }) : null;
  return {
    dominantColoursOklab: oklch.map(c => ({
      oklch: { L: round(c.oklch.L, 5), C: round(c.oklch.C, 5), h: round(c.oklch.h, 3) },
      areaFraction: round(c.areaFraction, 5),
      centroidX: c.centroidX == null ? null : round(c.centroidX, 4),
      centroidY: c.centroidY == null ? null : round(c.centroidY, 4),
    })),
    colourVolumeTag: colourVolumeTag(opts.volume || {}),
    sampleStride: stride,
    wpre: wpreScore == null ? null : round(wpreScore, 4),
  };
}

// ---- AUDIO ----------------------------------------------------------------------------------------
// Build a real magnitude spectrum + dB-SPL estimate from the analyser's getByteFrequencyData bytes.
// getByteFrequencyData maps each bin's dB (clamped to [minDb, maxDb]) linearly to a 0..255 byte:
//   byte = 255 * (dB - minDb) / (maxDb - minDb). We invert that to recover the per-bin dB, and take
// 10^(dB/20) as a linear magnitude proxy. This is the analyser's own scale, not a fabricated one.
function bytesToSpectrum(freqBytes, minDb, maxDb) {
  const lo = Number.isFinite(minDb) ? minDb : -100;
  const hi = Number.isFinite(maxDb) ? maxDb : -30;
  const span = (hi - lo) || 1;
  const db = new Float64Array(freqBytes.length);
  const mag = new Float64Array(freqBytes.length);
  for (let k = 0; k < freqBytes.length; k++) {
    const d = lo + (freqBytes[k] / 255) * span; // recovered dB for this bin
    db[k] = d;
    mag[k] = Math.pow(10, d / 20);              // linear magnitude proxy
  }
  return { db, mag };
}

// Center + normalize a getByteTimeDomainData buffer (0..255, 128 = silence) to floats in ~[-1,1] for
// YIN (which is amplitude-scale-invariant for f0, but a centered signal makes its probability honest).
function bytesToSamples(timeBytes) {
  const out = new Float64Array(timeBytes.length);
  for (let i = 0; i < timeBytes.length; i++) out[i] = (timeBytes[i] - 128) / 128;
  return out;
}

// The full psychoacoustic readout. Returns null when no real buffers are present (honest absence).
// audio.freqBytes / audio.timeBytes are the analyser's Uint8Array outputs; sampleRate + fftSize size
// the frequency axis; minDb/maxDb are the analyser's decibel range.
//
// Loudness (Track A step T1): the analyser reports dB relative to full scale (dBFS, -100..-30 by
// default), not sound pressure. ISO 226 needs dB SPL, and treating dBFS as SPL put every band below
// the hearing threshold (sone 0 for every sound). So phon and sone are computed only when the caller
// supplies `splOffsetDb`, a calibration from analyser dB to dB SPL; then SPL is the loudest bin's dB
// plus the offset, evaluated at that bin's frequency. Without an offset the `iso226` key is absent.
// The PBE band metric was deleted in the same step (it compared two different quantities).
export function audioPerception(audio) {
  if (!audio || !audio.freqBytes || !audio.freqBytes.length || !audio.sampleRate || !audio.fftSize) {
    return null; // no audio source -> these fields are absent, never faked.
  }
  const { freqBytes, timeBytes, sampleRate, fftSize, minDb, maxDb } = audio;
  const { db, mag } = bytesToSpectrum(freqBytes, minDb, maxDb);
  const freqs = fftBinFreqs(sampleRate, fftSize, mag.length);

  // ERB-rate bands (primary perceptual spectral axis, Glasberg-Moore).
  const erb = erbBands(mag, sampleRate, fftSize, 36);

  // YIN pitch on the time-domain samples (resolves the missing fundamental peak-picking misses).
  let yin = { f0: 0, probability: 0, tau: 0 };
  if (timeBytes && timeBytes.length >= 4) yin = yinPitch(bytesToSamples(timeBytes), sampleRate);

  // Spectral shape + tonal chroma over the linear-magnitude spectrum.
  const centroidHz = spectralCentroid(mag, freqs);
  const rolloffHz = spectralRolloff(mag, freqs, 0.85);
  const chroma = chroma12(mag, freqs);

  const out = {
    erbBands: erb.bands.map(v => round(v, 8)),
    erbCentersHz: erb.centersHz.map(v => round(v, 2)),
    yinPitch: { f0: round(yin.f0, 3), probability: round(yin.probability, 4) },
    spectralCentroidHz: round(centroidHz, 3),
    spectralRolloffHz: round(rolloffHz, 3),
    chroma12: chroma.map(v => round(v, 5)),
  };
  const off = audio.splOffsetDb;
  if (typeof off === "number" && Number.isFinite(off)) {
    const peak = loudestBin(freqBytes, db, freqs);
    if (peak) {
      const splDb = peak.db + off;
      const phon = iso226Phon(splDb, peak.hz);
      out.iso226 = {
        phon: round(phon, 3), sone: round(phonToSone(phon), 4), atHz: round(peak.hz, 2),
        splDb: round(splDb, 3), splOffsetDb: off, basis: "analyser-dB-plus-caller-offset",
      };
    } else {
      out.iso226 = null; // an offset was given but no bin rose above the analyser floor
    }
  }
  return out;
}

// The loudest FFT bin above DC: its recovered dB and centre frequency. Null when every bin sits at the
// analyser floor (byte 0), so there is nothing to call loud.
function loudestBin(freqBytes, db, freqs) {
  let k = -1, best = 0;
  for (let i = 1; i < freqBytes.length; i++) if (freqBytes[i] > best) { best = freqBytes[i]; k = i; }
  return k < 0 ? null : { db: db[k], hz: freqs[k] };
}

// ---- VISION ---------------------------------------------------------------------------------------
// Box-average RGBA -> a (tw x th) RGBA buffer (the downsample the heavy vision math runs on). Keeps the
// FFT/pyramid/SSIM off the full backing resolution. Pure; returns a Uint8ClampedArray RGBA.
function downsampleRGBA(px, w, h, tw, th) {
  const out = new Uint8ClampedArray(tw * th * 4);
  for (let gy = 0; gy < th; gy++) {
    const y0 = Math.floor(gy * h / th), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / th));
    for (let gx = 0; gx < tw; gx++) {
      const x0 = Math.floor(gx * w / tw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / tw));
      let r = 0, g = 0, b = 0, a = 0, c = 0;
      for (let yy = y0; yy < y1; yy++) {
        const base = yy * w;
        for (let xx = x0; xx < x1; xx++) {
          const i = (base + xx) * 4;
          r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3]; c++;
        }
      }
      c = c || 1;
      const o = (gy * tw + gx) * 4;
      out[o] = Math.round(r / c); out[o + 1] = Math.round(g / c);
      out[o + 2] = Math.round(b / c); out[o + 3] = Math.round(a / c);
    }
  }
  return out;
}

// Mean LINEAR luma per cell of a cols x rows grid over a linear-luma buffer (for low-freq contrast +
// center-surround saliency). Returns a flat row-major Float64Array of length cols*rows.
function cellMeanLuma(lin, w, h, cols, rows) {
  const out = new Float64Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(cy * h / rows), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(cx * w / cols), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cols));
      let s = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += lin[y * w + x]; c++; }
      out[cy * cols + cx] = c ? s / c : 0;
    }
  }
  return out;
}

// Mean OKLab-ish LAB per cell (for redundancy flags). Uses CIELAB via srgbByteToLab on the cell mean
// sRGB. Returns an array of [L,a,b] per cell, row-major.
function cellLabs(px, w, h, cols, rows) {
  const out = [];
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(cy * h / rows), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(cx * w / cols), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cols));
      let r = 0, g = 0, b = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; c++;
      }
      c = c || 1;
      out.push(srgbByteToLab(r / c, g / c, b / c));
    }
  }
  return out;
}

// Mean saliency per cell from a per-pixel saliency map (0..1). Row-major cols*rows.
function cellMeanMap(map, w, h, cols, rows) {
  const out = new Float64Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(cy * h / rows), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(cx * w / cols), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cols));
      let s = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += map[y * w + x]; c++; }
      out[cy * cols + cx] = c ? s / c : 0;
    }
  }
  return out;
}

// The biomimetic vision readout, on a downsampled working luma. Returns the additive multiScale
// extension fields. `cols`/`rows` is the aspect-native cell grid. (The WPIR score that used to ride
// here was deleted in Track A step T1: it compared the pyramid with its own exact reconstruction.)
export function visionPerception(px, w, h) {
  // Aspect-native cell grid: VISION_CELLS on the long edge, the short edge scaled to the frame ratio
  // (never padded to square). Clamp to >= 2 so neighbours exist for redundancy.
  let cols = VISION_CELLS, rows = VISION_CELLS;
  if (w >= h) rows = Math.max(2, Math.round(VISION_CELLS * h / w));
  else cols = Math.max(2, Math.round(VISION_CELLS * w / h));

  // Downsample to a working buffer (long edge VISION_WORK) so the FFT/pyramid/SSIM are cheap.
  let tw = VISION_WORK, th = VISION_WORK;
  if (w >= h) th = Math.max(2, Math.round(VISION_WORK * h / w));
  else tw = Math.max(2, Math.round(VISION_WORK * w / h));
  const work = downsampleRGBA(px, w, h, tw, th);
  const lin = toLinearLuma(work, tw, th);

  // Laplacian pyramid: its finest band energy is the high-frequency contrast readout below.
  const pyr = laplacianPyramid(lin, tw, th, 5);

  // Contrast split: low-freq from the coarse cell-mean variance, high-freq from the fine bandpass
  // energy (the finest Laplacian level). Maps the CSF axis scalar contrast misses.
  const cellLum = cellMeanLuma(lin, tw, th, cols, rows);
  const contrastLow = stddev(cellLum);
  const contrastHigh = Math.sqrt(pyr.energy.length ? pyr.energy[0] : 0); // finest bandpass RMS

  // Spectral-residual saliency (Hou-Zhang), reduced to per-cell means (computed at VISION_WORK, not
  // the full grid: the 128-cell payload stays a cheap box-average, saliency runs on the 64px work map).
  const sal = spectralResidualSaliency(lin, tw, th);
  const salCells = cellMeanMap(sal.map, tw, th, cols, rows);

  // Redundancy flags from per-cell CIELAB neighbours (model can skip duplicate cells). Computed on the
  // downsampled work buffer (not full-res) so the cost is independent of backing resolution.
  const labs = cellLabs(work, tw, th, cols, rows);
  const redundant = redundancyFlags(labs, cols, rows, 5);

  return {
    cells: { cols, rows },
    aspectNative: true,
    perCellCoords: perCellSpatialCoords(cols, rows),
    contrastLowFreq: round(contrastLow, 6),
    contrastHighFreq: round(contrastHigh, 6),
    saliencyCells: Array.from(salCells, v => round(v, 5)),
    redundantCells: redundant,
    gridRoles: { coarse: "global_context", fine: "local_detail" },
    workingResolution: { w: tw, h: th, note: "heavy vision math runs here, not at full backing res" },
  };
}

// Population standard deviation of a numeric array (the coarse-grid contrast measure).
function stddev(arr) {
  const n = arr.length; if (!n) return 0;
  let m = 0; for (let i = 0; i < n; i++) m += arr[i]; m /= n;
  let v = 0; for (let i = 0; i < n; i++) { const d = arr[i] - m; v += d * d; }
  return Math.sqrt(v / n);
}

// Round to `d` decimals, passing through null/non-finite as null (honest absence in the payload).
function round(v, d) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}
