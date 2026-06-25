// audio-perceptual.mjs - the psychoacoustic core of Telos Studio's perception channel.
//
// Pure, zero-dependency, browser-free ESM. No Web Audio, no DOM, no Math.random, no Date.now.
// Node imports and tests every formula directly; the browser later hands these functions real
// FFT magnitudes and PCM samples. Each function is a single canonical psychoacoustic transform,
// kept small, so a node test can recompute the number the model is given.
//
// This is the SCIENCE-GROUNDED audio axis from SPEC-telos-sensory-engine.md section C
// (AUDIO + PSYCHOACOUSTIC REFINEMENT): ERB-rate bands as the primary spectral readout
// (Glasberg-Moore 1990), ISO 226:2003 equal-loudness loudness in phons and sones,
// IEC 61672 A-weighting, YIN pitch (de Cheveigne and Kawahara 2002) that resolves the
// missing fundamental, mel filterbank + MFCC (Davis-Mermelstein 1980, HTK mel), spectral
// shape descriptors, a 12-bin chroma vector, and the PBE per-band fidelity metric.
//
// Conventions used throughout:
// - fftMag is a real magnitude spectrum: index 0 is DC, index k is bin k of an fftSize-point
//   FFT, so the bin centre frequency is k * sampleRate / fftSize. Length is typically
//   fftSize/2 + 1 (the non-redundant half including Nyquist), but any prefix works.
// - power is magnitude squared; we accumulate power, not magnitude, when summing energy.
// - All dB are 20*log10 for amplitude ratios, 10*log10 for power ratios.

const EPS = 1e-12;

// ---------------------------------------------------------------------------
// (1) ERB-rate scale and ERB bands (Glasberg and Moore 1990).
// ---------------------------------------------------------------------------
// The ERB-rate (a.k.a. "Cam") number maps frequency onto a scale where equal steps are equal
// distances along the basilar membrane. Glasberg and Moore 1990, "Derivation of auditory filter
// shapes from notched-noise data", Hearing Research 47: 103-138, equation:
//   ERBS(f) = 21.4 * log10(1 + 0.00437 * f),  f in Hz.
// This is finer than mel or Bark at low frequency, which is why the spec makes it the primary axis.

export function hzToErbRate(f) {
  return 21.4 * Math.log10(1 + 0.00437 * f);
}

// Inverse of hzToErbRate. Solve 21.4*log10(1+0.00437*f) = e for f:
//   f = (10^(e/21.4) - 1) / 0.00437.
export function erbRateToHz(e) {
  return (Math.pow(10, e / 21.4) - 1) / 0.00437;
}

// Accumulate FFT power into nBands bands spaced equally on the ERB-rate scale between a low edge
// and Nyquist. Each band integrates the power of every FFT bin whose centre falls inside it.
// Because the band EDGES are equal steps in ERB-rate, low-frequency bands are NARROW in Hz and
// high-frequency bands are WIDE in Hz - the basilar-membrane mapping the spec wants.
//
// Returns { bands, edgesHz, centersHz, widthsHz }:
//   bands     - per-band summed power (linear),
//   edgesHz   - nBands+1 band edges in Hz,
//   centersHz - per-band centre frequency in Hz (ERB-rate midpoint mapped back to Hz),
//   widthsHz  - per-band width in Hz (edge[i+1]-edge[i]).
// Total power is conserved: sum(bands) equals the summed power of every bin placed into a band.
export function erbBands(fftMag, sampleRate, fftSize, nBands = 36) {
  const nyquist = sampleRate / 2;
  const fLo = 20; // below 20 Hz is sub-audible; start the first edge there
  const eLo = hzToErbRate(fLo);
  const eHi = hzToErbRate(nyquist);
  const edgesHz = new Array(nBands + 1);
  const centersHz = new Array(nBands);
  const widthsHz = new Array(nBands);
  for (let i = 0; i <= nBands; i++) {
    edgesHz[i] = erbRateToHz(eLo + (eHi - eLo) * (i / nBands));
  }
  for (let i = 0; i < nBands; i++) {
    centersHz[i] = erbRateToHz(eLo + (eHi - eLo) * ((i + 0.5) / nBands));
    widthsHz[i] = edgesHz[i + 1] - edgesHz[i];
  }
  const bands = new Array(nBands).fill(0);
  const binHz = sampleRate / fftSize;
  for (let k = 0; k < fftMag.length; k++) {
    const f = k * binHz;
    if (f < edgesHz[0] || f > edgesHz[nBands]) continue;
    // Locate the band whose [edge, nextEdge) contains f. Linear scan is fine for nBands ~36.
    let b = 0;
    while (b < nBands - 1 && f >= edgesHz[b + 1]) b++;
    const m = fftMag[k];
    bands[b] += m * m; // accumulate POWER
  }
  return { bands, edgesHz, centersHz, widthsHz };
}

// ---------------------------------------------------------------------------
// (2) Mel filterbank + MFCC (Davis and Mermelstein 1980; HTK mel convention).
// ---------------------------------------------------------------------------
// HTK mel scale (the one used by Slaney/HTK and most ASR toolkits):
//   mel(f) = 2595 * log10(1 + f / 700).
// Mel is kept ONLY for the MFCC path per the spec; ERB is the primary perceptual axis.

export function hzToMel(f) {
  return 2595 * Math.log10(1 + f / 700);
}

export function melToHz(m) {
  return 700 * (Math.pow(10, m / 2595) - 1);
}

// Build nFilters triangular mel filters spanning [0, Nyquist]. Each filter rises linearly from
// its lower edge to its centre and falls to its upper edge; adjacent filter centres are the
// neighbours' edges (the standard overlapping triangular bank). Returns:
//   { filters, centersHz, fftSize, sampleRate }
// where filters[j] is a Float64Array of length (fftSize/2 + 1) of per-bin triangular weights.
export function melFilterbank(sampleRate, fftSize, nFilters = 26) {
  const nBins = Math.floor(fftSize / 2) + 1;
  const nyquist = sampleRate / 2;
  const melLo = hzToMel(0);
  const melHi = hzToMel(nyquist);
  // nFilters+2 points: lower edge, nFilters centres, upper edge.
  const points = new Array(nFilters + 2);
  for (let i = 0; i < points.length; i++) {
    points[i] = melToHz(melLo + (melHi - melLo) * (i / (nFilters + 1)));
  }
  const binHz = sampleRate / fftSize;
  const filters = [];
  const centersHz = [];
  for (let j = 1; j <= nFilters; j++) {
    const fLeft = points[j - 1];
    const fCenter = points[j];
    const fRight = points[j + 1];
    centersHz.push(fCenter);
    const w = new Float64Array(nBins);
    for (let k = 0; k < nBins; k++) {
      const f = k * binHz;
      if (f >= fLeft && f <= fCenter) {
        w[k] = (f - fLeft) / (fCenter - fLeft || EPS);
      } else if (f > fCenter && f <= fRight) {
        w[k] = (fRight - f) / (fRight - fCenter || EPS);
      }
    }
    filters.push(w);
  }
  return { filters, centersHz, fftSize, sampleRate };
}

// MFCC: apply the mel filterbank to FFT power, take the log of each filter energy, then a
// DCT-II to decorrelate, keeping the first nCoeffs coefficients (Davis and Mermelstein 1980).
// fftMag is a magnitude spectrum; we square it to power before filtering.
export function mfcc(fftMag, fb, nCoeffs = 13) {
  const { filters } = fb;
  const nFilters = filters.length;
  const logEnergies = new Float64Array(nFilters);
  for (let j = 0; j < nFilters; j++) {
    const w = filters[j];
    let e = 0;
    const lim = Math.min(w.length, fftMag.length);
    for (let k = 0; k < lim; k++) {
      const m = fftMag[k];
      e += w[k] * (m * m); // power
    }
    logEnergies[j] = Math.log(e + EPS);
  }
  // DCT-II (orthonormal-free form; standard MFCC convention).
  const out = new Float64Array(nCoeffs);
  for (let n = 0; n < nCoeffs; n++) {
    let sum = 0;
    for (let j = 0; j < nFilters; j++) {
      sum += logEnergies[j] * Math.cos((Math.PI * n * (j + 0.5)) / nFilters);
    }
    out[n] = sum;
  }
  return out;
}

// ---------------------------------------------------------------------------
// (3) ISO 226:2003 equal-loudness: SPL (dB) -> loudness level (phon) -> sone.
// ---------------------------------------------------------------------------
// The 29 reference frequencies and the af / Lu / Tf coefficient tables are reproduced verbatim
// from ISO 226:2003 (the same tables published in the IoSR-Surrey MATLAB Toolbox iso226.m).
//   af = exponent of loudness perception, Lu = magnitude of the linear transfer function
//   (normalized at 1 kHz), Tf = threshold of hearing.
const ISO226_F = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500,
];
const ISO226_AF = [
  0.532, 0.506, 0.480, 0.455, 0.432, 0.409, 0.387, 0.367, 0.349, 0.330, 0.315,
  0.301, 0.288, 0.276, 0.267, 0.259, 0.253, 0.250, 0.246, 0.244, 0.243, 0.243,
  0.243, 0.242, 0.242, 0.245, 0.254, 0.271, 0.301,
];
const ISO226_LU = [
  -31.6, -27.2, -23.0, -19.1, -15.9, -13.0, -10.3, -8.1, -6.2, -4.5, -3.1, -2.0,
  -1.1, -0.4, 0.0, 0.3, 0.5, 0.0, -2.7, -4.1, -1.0, 1.7, 2.5, 1.2, -2.1, -7.1,
  -11.2, -10.7, -3.1,
];
const ISO226_TF = [
  78.5, 68.7, 59.5, 51.1, 44.0, 37.5, 31.5, 26.5, 22.1, 17.9, 14.4, 11.4, 8.6,
  6.2, 4.4, 3.0, 2.2, 2.4, 3.5, 1.7, -1.3, -4.2, -6.0, -5.4, -1.5, 6.0, 12.6,
  13.9, 12.3,
];

// Linearly interpolate the af / Lu / Tf coefficients at an arbitrary frequency (in the table
// range; clamped at the ends). Interpolation is done in log-frequency, matching how the table
// frequencies are spaced.
function iso226Coeffs(freq) {
  const f = ISO226_F;
  if (freq <= f[0]) return { af: ISO226_AF[0], lu: ISO226_LU[0], tf: ISO226_TF[0] };
  const last = f.length - 1;
  if (freq >= f[last]) return { af: ISO226_AF[last], lu: ISO226_LU[last], tf: ISO226_TF[last] };
  let i = 0;
  while (i < last && freq > f[i + 1]) i++;
  const t = (Math.log10(freq) - Math.log10(f[i])) / (Math.log10(f[i + 1]) - Math.log10(f[i]));
  const lerp = (a, b) => a + (b - a) * t;
  return {
    af: lerp(ISO226_AF[i], ISO226_AF[i + 1]),
    lu: lerp(ISO226_LU[i], ISO226_LU[i + 1]),
    tf: lerp(ISO226_TF[i], ISO226_TF[i + 1]),
  };
}

// SPL (dB) at a frequency -> loudness level in phons. This is the ISO 226:2003 INVERSE direction
// (the standard's forward direction gives SPL from phon). Per ISO 226:2003 section 4.1:
//   Bf = (0.4 * 10^((Lp + Lu)/10 - 9))^af - (0.4 * 10^((Tf + Lu)/10 - 9))^af + 0.005135
//   Ln = 40 * log10(Bf) + 94      [phon]
// This is the algebraic inverse of the forward equation
//   Af = 4.47e-3 * (10^(0.025*Ln) - 1.15) + (0.4 * 10^((Tf + Lu)/10 - 9))^af
//   Lp = (10/af) * log10(Af) - Lu + 94
// (forward equation reproduced verbatim from ISO 226:2003 / IoSR iso226.m). The round-trip is
// asserted in the test suite, which validates the additive constant 0.005135 against the
// independently-sourced forward equation. At 1000 Hz, Lu and Tf make Ln ~ Lp (the reference).
export function iso226Phon(spl_db, freq) {
  const { af, lu, tf } = iso226Coeffs(freq);
  const bf =
    Math.pow(0.4 * Math.pow(10, (spl_db + lu) / 10 - 9), af) -
    Math.pow(0.4 * Math.pow(10, (tf + lu) / 10 - 9), af) +
    0.005135;
  if (bf <= 0) return 0; // below the threshold of hearing: no loudness
  return 40 * Math.log10(bf) + 94;
}

// The forward ISO 226 direction (phon -> SPL at a frequency). Exposed so the inverse can be
// round-trip verified, and useful for drawing equal-loudness contours.
export function iso226Spl(phon, freq) {
  const { af, lu, tf } = iso226Coeffs(freq);
  const aF =
    4.47e-3 * (Math.pow(10, 0.025 * phon) - 1.15) +
    Math.pow(0.4 * Math.pow(10, (tf + lu) / 10 - 9), af);
  return (10 / af) * Math.log10(aF) - lu + 94;
}

// Loudness level in phons -> loudness in sones (Stevens / ISO 532 relation):
//   1 sone = 40 phon; above 40 phon, loudness doubles per 10 phon: sone = 2^((phon - 40)/10).
// Below 40 phon the relation steepens; the standard low-level form is
//   sone = (phon / 40)^2.642   for phon < 40   (so it stays continuous and -> 0 at 0 phon).
export function phonToSone(phon) {
  if (phon >= 40) return Math.pow(2, (phon - 40) / 10);
  if (phon <= 0) return 0;
  return Math.pow(phon / 40, 2.642);
}

// ---------------------------------------------------------------------------
// (4) A-weighting (IEC 61672-1, analog poles 20.6, 107.7, 737.9, 12194 Hz).
// ---------------------------------------------------------------------------
// Magnitude response (frequency-domain form of the analog filter):
//   Ra(f) = (12194^2 * f^4) /
//           ((f^2 + 20.6^2) * (f^2 + 12194^2) * sqrt((f^2 + 107.7^2) * (f^2 + 737.9^2)))
//   A(f)  = 20*log10(Ra(f)) + 2.00   [dB]
// The +2.00 dB normalizes the curve to 0 dB at 1 kHz (the bare ratio is about -2 dB there).
const AW_F1 = 20.598997;   // 20.6 Hz pole
const AW_F2 = 107.65265;   // 107.7 Hz pole
const AW_F3 = 737.86223;   // 737.9 Hz pole
const AW_F4 = 12194.217;   // 12194 Hz pole
const AW_NORM = 2.00;      // dB offset so A(1000) ~ 0

export function aWeightDb(freq) {
  const f2 = freq * freq;
  const num = AW_F4 * AW_F4 * f2 * f2;
  const den =
    (f2 + AW_F1 * AW_F1) *
    Math.sqrt((f2 + AW_F2 * AW_F2) * (f2 + AW_F3 * AW_F3)) *
    (f2 + AW_F4 * AW_F4);
  const ra = num / den;
  return 20 * Math.log10(ra) + AW_NORM;
}

// ---------------------------------------------------------------------------
// (5) Spectral shape: centroid, rolloff, spread.
// ---------------------------------------------------------------------------
// freqs is the per-bin centre frequency array (same length as fftMag). Callers can build it with
// fftBinFreqs(sampleRate, fftSize).

// Convenience: per-bin centre frequencies for an fftSize-point FFT, length nBins.
export function fftBinFreqs(sampleRate, fftSize, nBins) {
  const n = nBins || Math.floor(fftSize / 2) + 1;
  const binHz = sampleRate / fftSize;
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) out[k] = k * binHz;
  return out;
}

// Spectral centroid: the magnitude-weighted mean frequency ("brightness"). Sum(f*m)/Sum(m).
export function spectralCentroid(fftMag, freqs) {
  let num = 0, den = 0;
  const n = Math.min(fftMag.length, freqs.length);
  for (let k = 0; k < n; k++) {
    const m = fftMag[k];
    num += freqs[k] * m;
    den += m;
  }
  return den > EPS ? num / den : 0;
}

// Spectral rolloff: the frequency below which `rollPercent` (default 0.85) of the TOTAL
// magnitude lies. A timbre proxy. Returns the bin centre frequency at the crossover.
export function spectralRolloff(fftMag, freqs, rollPercent = 0.85) {
  const n = Math.min(fftMag.length, freqs.length);
  let total = 0;
  for (let k = 0; k < n; k++) total += fftMag[k];
  if (total <= EPS) return 0;
  const target = rollPercent * total;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    acc += fftMag[k];
    if (acc >= target) return freqs[k];
  }
  return freqs[n - 1] || 0;
}

// Spectral spread: the magnitude-weighted standard deviation of frequency about the centroid
// (the second spectral moment). A wide, noisy spectrum spreads; a pure tone does not.
export function spectralSpread(fftMag, freqs, centroid) {
  const c = centroid === undefined ? spectralCentroid(fftMag, freqs) : centroid;
  let num = 0, den = 0;
  const n = Math.min(fftMag.length, freqs.length);
  for (let k = 0; k < n; k++) {
    const m = fftMag[k];
    const d = freqs[k] - c;
    num += d * d * m;
    den += m;
  }
  return den > EPS ? Math.sqrt(num / den) : 0;
}

// ---------------------------------------------------------------------------
// (6) YIN pitch (de Cheveigne and Kawahara 2002), resolving the missing fundamental.
// ---------------------------------------------------------------------------
// Steps from the paper:
//   (2) difference function:        d(tau) = sum_{j} (x[j] - x[j+tau])^2
//   (3) cumulative mean normalized: d'(0)=1; d'(tau) = d(tau) / ((1/tau) sum_{j=1..tau} d(j))
//   (4) absolute threshold:         the first tau where d'(tau) < threshold AND is a local min;
//                                    if none, take the global minimum of d'
//   (5) parabolic interpolation:    refine tau around that minimum
//   (6) F0 = sampleRate / tau_refined
// YIN operates on the TIME-DOMAIN difference function, so a complex tone with no energy at the
// fundamental (the missing fundamental) still has its period in d(tau): the residue pitch
// emerges where peak-picking a spectrum would only see the partials. That is the test below.
export function yinPitch(timeSamples, sampleRate, opts = {}) {
  const threshold = opts.threshold === undefined ? 0.1 : opts.threshold;
  const n = timeSamples.length;
  const maxTau = Math.floor(n / 2);
  if (maxTau < 2) return { f0: 0, probability: 0, tau: 0 };

  // (2) difference function d(tau).
  const d = new Float64Array(maxTau);
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let j = 0; j < maxTau; j++) {
      const diff = timeSamples[j] - timeSamples[j + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // (3) cumulative mean normalized difference d'(tau).
  const dp = new Float64Array(maxTau);
  dp[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    runningSum += d[tau];
    dp[tau] = runningSum > EPS ? d[tau] * tau / runningSum : 1;
  }

  // (4) absolute threshold: first tau dipping below threshold, then walk to its local minimum.
  let tauEstimate = -1;
  for (let tau = 2; tau < maxTau; tau++) {
    if (dp[tau] < threshold) {
      while (tau + 1 < maxTau && dp[tau + 1] < dp[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  // If nothing crossed the threshold, fall back to the global minimum of d' (still a pitch guess).
  if (tauEstimate === -1) {
    let best = 1, bestVal = dp[1];
    for (let tau = 2; tau < maxTau; tau++) {
      if (dp[tau] < bestVal) { bestVal = dp[tau]; best = tau; }
    }
    tauEstimate = best;
  }

  // (5) parabolic interpolation around tauEstimate using its two neighbours.
  let betterTau = tauEstimate;
  if (tauEstimate > 0 && tauEstimate < maxTau - 1) {
    const s0 = dp[tauEstimate - 1];
    const s1 = dp[tauEstimate];
    const s2 = dp[tauEstimate + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > EPS) {
      betterTau = tauEstimate + (s2 - s0) / denom;
    }
  }

  // (6) F0.
  const f0 = betterTau > 0 ? sampleRate / betterTau : 0;
  return { f0, probability: 1 - dp[tauEstimate], tau: betterTau };
}

// ---------------------------------------------------------------------------
// (7) Chroma: 12-bin pitch-class energy.
// ---------------------------------------------------------------------------
// Fold every bin's energy onto the 12 pitch classes (C, C#, ... B) using the equal-tempered
// mapping pitchClass = round(12*log2(f/C0)) mod 12, with C0 ~ 16.3516 Hz (MIDI 0). The result is
// the invariant tonal representation models lack. Returns a length-12 array, peak-normalized.
const C0_HZ = 16.351597831287414; // frequency of MIDI note 0 (C-1); A4 = 440 Hz tuning
export function chroma12(fftMag, freqs) {
  const chroma = new Array(12).fill(0);
  const n = Math.min(fftMag.length, freqs.length);
  for (let k = 0; k < n; k++) {
    const f = freqs[k];
    if (f <= 0) continue;
    const midi = 12 * Math.log2(f / C0_HZ);
    if (!Number.isFinite(midi)) continue;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    const m = fftMag[k];
    chroma[pc] += m * m; // accumulate power per pitch class
  }
  const max = Math.max(...chroma);
  if (max > EPS) for (let i = 0; i < 12; i++) chroma[i] /= max;
  return chroma;
}

// ---------------------------------------------------------------------------
// (8) PBE - Perceptual Band Error (the audio self-improvement metric).
// ---------------------------------------------------------------------------
// Per-band relative error between Telos's loudness readout (telosBands) and a reference
// (refBands), reported as { mean, std, perBand, worstBand }. The worst band is the weakest axis
// the self-improvement loop targets next. relErr_i = |T_i - G_i| / (G_i + eps).
export function pbe(telosBands, refBands) {
  const n = Math.min(telosBands.length, refBands.length);
  if (n === 0) return { mean: 0, std: 0, perBand: [], worstBand: -1 };
  const perBand = new Array(n);
  let sum = 0, worst = 0, worstIdx = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.abs(telosBands[i] - refBands[i]) / (Math.abs(refBands[i]) + EPS);
    perBand[i] = e;
    sum += e;
    if (e > worst) { worst = e; worstIdx = i; }
  }
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = perBand[i] - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / n);
  return { mean, std, perBand, worstBand: worstIdx };
}
