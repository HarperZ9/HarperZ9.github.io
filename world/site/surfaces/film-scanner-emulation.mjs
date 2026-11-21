// film-scanner-emulation.mjs: decoupled physically based film emulsion + optical
// scanner/enlarger transfer kernel for The Playground and native/ pipelines.
// Separates film chemistry (H&D sensitometric D-log-E curve, grain rms, halation)
// from readout optics (Frontier CCD, Noritsu LED, PMT Drum Scan, Optical Enlarger).

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export const FILM_STOCKS = Object.freeze({
  'kodak-gold-200': Object.freeze({
    label: 'Kodak Gold 200',
    iso: 200,
    gamma: Object.freeze([0.68, 0.65, 0.62]),
    dMin: Object.freeze([0.12, 0.14, 0.18]),
    dMax: Object.freeze([2.45, 2.55, 2.65]),
    grainRms: 0.022,
    halationRed: 0.14,
    bw: false,
  }),
  'kodak-portra-400': Object.freeze({
    label: 'Kodak Portra 400',
    iso: 400,
    gamma: Object.freeze([0.58, 0.59, 0.58]),
    dMin: Object.freeze([0.10, 0.11, 0.13]),
    dMax: Object.freeze([2.35, 2.40, 2.45]),
    grainRms: 0.018,
    halationRed: 0.09,
    bw: false,
  }),
  'fuji-velvia-50': Object.freeze({
    label: 'Fuji Velvia 50',
    iso: 50,
    gamma: Object.freeze([1.45, 1.48, 1.42]),
    dMin: Object.freeze([0.05, 0.05, 0.06]),
    dMax: Object.freeze([3.40, 3.45, 3.35]),
    grainRms: 0.009,
    halationRed: 0.04,
    bw: false,
  }),
  'ilford-delta-100': Object.freeze({
    label: 'Ilford Delta 100',
    iso: 100,
    gamma: Object.freeze([0.74, 0.74, 0.74]),
    dMin: Object.freeze([0.07, 0.07, 0.07]),
    dMax: Object.freeze([2.60, 2.60, 2.60]),
    grainRms: 0.014,
    halationRed: 0.02,
    bw: true,
  }),
  'kodak-trix-400': Object.freeze({
    label: 'Kodak Tri-X 400',
    iso: 400,
    gamma: Object.freeze([0.82, 0.82, 0.82]),
    dMin: Object.freeze([0.09, 0.09, 0.09]),
    dMax: Object.freeze([2.75, 2.75, 2.75]),
    grainRms: 0.032,
    halationRed: 0.03,
    bw: true,
  }),
});

export const SCANNER_OPTICS = Object.freeze({
  'frontier-sp3000': Object.freeze({
    label: 'Fujifilm Frontier SP-3000 (CCD)',
    toeSoftness: 0.16,
    shoulderSoftness: 0.22,
    colorMatrix: Object.freeze([
      [1.04, -0.03, -0.01],
      [-0.02, 1.03, -0.01],
      [0.01, -0.03, 1.02],
    ]),
    mtfSharpness: 0.88,
  }),
  'noritsu-hs1800': Object.freeze({
    label: 'Noritsu HS-1800 (LED)',
    toeSoftness: 0.12,
    shoulderSoftness: 0.18,
    colorMatrix: Object.freeze([
      [1.01, -0.01, 0.0],
      [-0.01, 1.02, -0.01],
      [0.0, -0.01, 1.01],
    ]),
    mtfSharpness: 0.92,
  }),
  'pmt-drum-scan': Object.freeze({
    label: 'PMT Optical Drum Scanner',
    toeSoftness: 0.06,
    shoulderSoftness: 0.08,
    colorMatrix: Object.freeze([
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ]),
    mtfSharpness: 0.99,
  }),
  'optical-enlarger': Object.freeze({
    label: 'Condenser Optical Enlarger',
    toeSoftness: 0.20,
    shoulderSoftness: 0.28,
    colorMatrix: Object.freeze([
      [1.02, -0.01, -0.01],
      [-0.01, 1.01, 0.0],
      [-0.01, 0.0, 1.01],
    ]),
    mtfSharpness: 0.84,
  }),
});

/**
 * Hurter-Driffield (H&D) logistic sensitometric curve mapping linear exposure
 * E in [0, 1] to optical density D in [dMin, dMax] (strictly monotonic).
 */
export function hdDensity(exposure, gamma, dMin, dMax) {
  const e = Math.max(1e-5, Math.min(1.0, Number(exposure)));
  const logE = Math.log10(e) + 1.0; // centered around E = 0.1
  const s = 1.0 / (1.0 + Math.exp(-gamma * 3.2 * (logE - 0.5)));
  return dMin + (dMax - dMin) * s;
}

/**
 * Transform a linear RGB pixel through decoupled film stock chemistry and
 * optical scanner/enlarger readout.
 */
export function emulateFilmAndScanner(rgb, stockId = 'kodak-portra-400', scannerId = 'noritsu-hs1800', exposureStops = 0) {
  const stock = FILM_STOCKS[stockId];
  const scanner = SCANNER_OPTICS[scannerId];
  if (!stock || !scanner) throw new Error(`unknown stock (${stockId}) or scanner (${scannerId})`);

  const gain = Math.pow(2, Number(exposureStops));
  let lin = [clamp01(rgb[0] * gain), clamp01(rgb[1] * gain), clamp01(rgb[2] * gain)];
  if (stock.bw) {
    const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    lin = [y, y, y];
  }

  // Stage 1: Emulsion H&D density normalized to [0, 1] print transmittance
  const norm = [0, 1, 2].map((c) => {
    const d = hdDensity(lin[c], stock.gamma[c], stock.dMin[c], stock.dMax[c]);
    const t = clamp01((d - stock.dMin[c]) / (stock.dMax[c] - stock.dMin[c]));
    // Soft toe/shoulder roll-off from scanner optical path
    return clamp01(t * (1 - scanner.shoulderSoftness * 0.15) + scanner.toeSoftness * 0.04 * (1 - t));
  });

  // Stage 2: Red-layer halation bleed on bright highlights (color stocks)
  if (!stock.bw && norm[0] > 0.75) {
    norm[0] = clamp01(norm[0] + stock.halationRed * (norm[0] - 0.75));
  }

  // Stage 3: Scanner spectral readout matrix (row sums == 1 preserves neutral grey)
  const M = scanner.colorMatrix;
  const out = [0, 1, 2].map((r) => clamp01(M[r][0] * norm[0] + M[r][1] * norm[1] + M[r][2] * norm[2]));

  return {
    stock: stockId,
    scanner: scannerId,
    rgb: out.map((v) => Number(v.toFixed(6))),
    grainRms: stock.grainRms,
    mtfSharpness: scanner.mtfSharpness,
  };
}
