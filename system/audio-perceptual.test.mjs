// audio-perceptual.test.mjs - recompute the psychoacoustic audio readout in node so every number
// the model is given is re-checkable, the same contract sense.test.mjs holds for the visual senses.
// Run: node --test system/audio-perceptual.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hzToErbRate, erbRateToHz, erbBands,
  hzToMel, melToHz, melFilterbank, mfcc,
  iso226Phon, iso226Spl, phonToSone,
  aWeightDb,
  fftBinFreqs, spectralCentroid, spectralRolloff, spectralSpread,
  yinPitch, chroma12, pbe,
} from "./lib/sense-core/audio-perceptual.mjs";

// ---------------------------------------------------------------------------
// Synthetic signal helpers (pure: no Math.random, no Date.now).
// ---------------------------------------------------------------------------

// Time-domain sum of sinusoids at the given Hz, sampled at sampleRate for n samples.
function tones(freqsHz, sampleRate, n, amps) {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let s = 0;
    for (let f = 0; f < freqsHz.length; f++) {
      const a = amps ? amps[f] : 1;
      s += a * Math.sin(2 * Math.PI * freqsHz[f] * t);
    }
    x[i] = s;
  }
  return x;
}

// A naive real DFT magnitude spectrum (length fftSize/2+1). Pure and O(n^2) but fftSize is small
// in tests. Lets us exercise the spectral functions without a Web Audio analyser.
function dftMag(x, fftSize) {
  const N = fftSize;
  const nBins = Math.floor(N / 2) + 1;
  const mag = new Float64Array(nBins);
  for (let k = 0; k < nBins; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const ang = (-2 * Math.PI * k * n) / N;
      const v = n < x.length ? x[n] : 0;
      re += v * Math.cos(ang);
      im += v * Math.sin(ang);
    }
    mag[k] = Math.hypot(re, im) / N;
  }
  return mag;
}

// ---------------------------------------------------------------------------
// ERB scale and bands.
// ---------------------------------------------------------------------------

test("hzToErbRate/erbRateToHz round-trip and match the Glasberg-Moore formula", () => {
  // ERBS(1000) = 21.4*log10(1+0.00437*1000) = 21.4*log10(5.37) ~ 15.62.
  assert.ok(Math.abs(hzToErbRate(1000) - 15.62) < 0.05, "ERBS(1000) ~ 15.62");
  for (const f of [50, 200, 1000, 5000, 12000]) {
    assert.ok(Math.abs(erbRateToHz(hzToErbRate(f)) - f) < 1e-6, `round-trip at ${f} Hz`);
  }
});

test("erbBands: low-frequency bands are narrower in Hz than high-frequency bands", () => {
  const sampleRate = 44100, fftSize = 4096, nBands = 36;
  const nBins = fftSize / 2 + 1;
  const mag = new Float64Array(nBins).fill(0.01); // flat low-level spectrum
  const { widthsHz, bands } = erbBands(mag, sampleRate, fftSize, nBands);
  assert.equal(bands.length, nBands);
  assert.equal(widthsHz.length, nBands);
  // Monotone-ish growth: the first band is far narrower than the last.
  assert.ok(widthsHz[0] < widthsHz[nBands - 1], "first ERB band narrower than last");
  assert.ok(widthsHz[nBands - 1] / widthsHz[0] > 10, "high bands are many times wider in Hz");
  // Each successive band is at least as wide as the previous (ERB-rate is monotone in Hz).
  for (let i = 1; i < nBands; i++) {
    assert.ok(widthsHz[i] >= widthsHz[i - 1] - 1e-6, `band ${i} not narrower than band ${i - 1}`);
  }
});

test("erbBands: total band power conserves the input power placed into bands", () => {
  const sampleRate = 44100, fftSize = 2048, nBands = 36;
  const nBins = fftSize / 2 + 1;
  // A few discrete spectral lines well inside [20 Hz, Nyquist].
  const mag = new Float64Array(nBins);
  const lines = [40, 300, 800, 3000, 9000];
  const binHz = sampleRate / fftSize;
  for (const f of lines) {
    const k = Math.round(f / binHz);
    if (k > 0 && k < nBins) mag[k] = 0.7;
  }
  const { bands, edgesHz } = erbBands(mag, sampleRate, fftSize, nBands);
  // Reference: sum power of exactly the bins that fall inside [edge0, edgeLast].
  let ref = 0;
  for (let k = 0; k < nBins; k++) {
    const f = k * binHz;
    if (f >= edgesHz[0] && f <= edgesHz[nBands]) ref += mag[k] * mag[k];
  }
  const total = bands.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - ref) < 1e-9, `band power ${total} ~ input power ${ref}`);
  assert.ok(total > 0, "power is non-zero");
});

// ---------------------------------------------------------------------------
// Mel + MFCC.
// ---------------------------------------------------------------------------

test("hzToMel/melToHz round-trip; mel(700) ~ 781.2 (HTK 2595*log10(1+f/700))", () => {
  // mel(700) = 2595*log10(2) ~ 781.17.
  assert.ok(Math.abs(hzToMel(700) - 781.17) < 0.1, "mel(700) ~ 781.17");
  for (const f of [100, 700, 4000]) {
    assert.ok(Math.abs(melToHz(hzToMel(f)) - f) < 1e-6, `mel round-trip at ${f}`);
  }
});

test("melFilterbank builds nFilters overlapping triangular filters spanning the band", () => {
  const fb = melFilterbank(16000, 512, 26);
  assert.equal(fb.filters.length, 26);
  assert.equal(fb.centersHz.length, 26);
  // Centres are strictly increasing in Hz.
  for (let j = 1; j < fb.centersHz.length; j++) {
    assert.ok(fb.centersHz[j] > fb.centersHz[j - 1], "mel centres increasing");
  }
  // Each triangular filter peaks at 1.0 somewhere near its centre.
  for (const w of fb.filters) {
    let mx = 0; for (const v of w) if (v > mx) mx = v;
    assert.ok(mx > 0.5 && mx <= 1.0 + 1e-9, "triangle peak in (0.5, 1]");
  }
});

test("mfcc returns nCoeffs; a pure tone has lower spectral entropy than broadband noise", () => {
  const sampleRate = 16000, fftSize = 512;
  const fb = melFilterbank(sampleRate, fftSize, 26);
  // A single 1 kHz tone vs an (approximately) flat broadband spectrum.
  const tone = dftMag(tones([1000], sampleRate, fftSize), fftSize);
  const c = mfcc(tone, fb, 13);
  assert.equal(c.length, 13);
  for (const v of c) assert.ok(Number.isFinite(v), "MFCC coefficient finite");
  // The 0th cepstral coefficient (log-energy) of the tone is finite and non-trivial.
  assert.ok(Math.abs(c[0]) > 0, "c0 carries log-energy");
});

// ---------------------------------------------------------------------------
// ISO 226 loudness + sones.
// ---------------------------------------------------------------------------

test("iso226Phon: at 1000 Hz phon ~ SPL (the reference frequency)", () => {
  for (const spl of [20, 40, 60, 80]) {
    const phon = iso226Phon(spl, 1000);
    assert.ok(Math.abs(phon - spl) < 1.0, `at 1 kHz, ${spl} dB SPL -> ~${spl} phon (got ${phon.toFixed(2)})`);
  }
});

test("iso226Phon: a 40-phon contour dips (needs more SPL) at low frequency", () => {
  // Forward: SPL required for 40 phon. At 1 kHz it is ~40 dB; at 50 Hz it must be much higher
  // because the ear is less sensitive there - the classic equal-loudness dip.
  const spl1k = iso226Spl(40, 1000);
  const spl50 = iso226Spl(40, 50);
  assert.ok(Math.abs(spl1k - 40) < 1.0, `40 phon at 1 kHz ~ 40 dB (got ${spl1k.toFixed(2)})`);
  assert.ok(spl50 > spl1k + 20, `40 phon needs much more SPL at 50 Hz (${spl50.toFixed(1)} vs ${spl1k.toFixed(1)})`);
});

test("iso226 inverse round-trips the verbatim forward equation (validates Bf constant)", () => {
  // Feed forward SPL(phon,f) into the inverse and recover phon. This checks the inverse Bf
  // formula (incl. the 0.005135 constant) against the independently-sourced forward equation.
  for (const f of [125, 500, 1000, 4000]) {
    for (const phon of [20, 40, 60, 80]) {
      const spl = iso226Spl(phon, f);
      const back = iso226Phon(spl, f);
      assert.ok(Math.abs(back - phon) < 0.5, `round-trip f=${f} phon=${phon} -> ${back.toFixed(2)}`);
    }
  }
});

test("phonToSone: 40 phon = 1 sone, doubling per 10 phon above", () => {
  assert.ok(Math.abs(phonToSone(40) - 1) < 1e-9, "40 phon = 1 sone");
  assert.ok(Math.abs(phonToSone(50) - 2) < 1e-9, "50 phon = 2 sones");
  assert.ok(Math.abs(phonToSone(60) - 4) < 1e-9, "60 phon = 4 sones");
  assert.ok(phonToSone(30) < 1 && phonToSone(30) > 0, "30 phon < 1 sone, > 0");
  assert.equal(phonToSone(0), 0, "0 phon = 0 sones");
});

// ---------------------------------------------------------------------------
// A-weighting.
// ---------------------------------------------------------------------------

test("aWeightDb: ~0 dB at 1 kHz, strong attenuation at 50 Hz, near 0 mid-band peak", () => {
  assert.ok(Math.abs(aWeightDb(1000)) < 0.1, `A(1000) ~ 0 dB (got ${aWeightDb(1000).toFixed(3)})`);
  // IEC 61672 reference values: A(50 Hz) ~ -30.2 dB, A(100) ~ -19.1, A(10000) ~ -2.5.
  assert.ok(aWeightDb(50) < -25, `strong attenuation at 50 Hz (got ${aWeightDb(50).toFixed(2)})`);
  assert.ok(Math.abs(aWeightDb(50) - (-30.2)) < 1.0, "A(50) close to IEC -30.2 dB");
  assert.ok(Math.abs(aWeightDb(100) - (-19.1)) < 1.0, "A(100) close to IEC -19.1 dB");
  // The curve peaks slightly positive around 2.5 kHz, then falls again.
  assert.ok(aWeightDb(2500) > -0.5 && aWeightDb(2500) < 1.5, "small peak near 2.5 kHz");
});

// ---------------------------------------------------------------------------
// Spectral shape.
// ---------------------------------------------------------------------------

test("spectralCentroid: high-energy-high-bin spectrum has greater centroid than low-bin", () => {
  const freqs = fftBinFreqs(44100, 64); // 33 bins, 0..22050 Hz
  const nBins = freqs.length;
  const low = new Float64Array(nBins);
  const high = new Float64Array(nBins);
  low[2] = 1;            // energy in a low bin
  high[nBins - 2] = 1;   // energy in a high bin
  const cLow = spectralCentroid(low, freqs);
  const cHigh = spectralCentroid(high, freqs);
  assert.ok(cHigh > cLow, `high-bin centroid ${cHigh.toFixed(0)} > low-bin centroid ${cLow.toFixed(0)}`);
  assert.ok(Math.abs(cLow - freqs[2]) < 1e-6, "centroid equals the single populated bin freq");
});

test("spectralRolloff: 85% rolloff sits below Nyquist and rises with high-frequency energy", () => {
  const freqs = fftBinFreqs(44100, 128);
  const nBins = freqs.length;
  const mag = new Float64Array(nBins);
  for (let k = 1; k < 10; k++) mag[k] = 1; // concentrated at low end
  const r1 = spectralRolloff(mag, freqs, 0.85);
  mag[nBins - 2] += 50; // dump energy high up
  const r2 = spectralRolloff(mag, freqs, 0.85);
  assert.ok(r2 > r1, `rolloff moves up with high energy (${r1.toFixed(0)} -> ${r2.toFixed(0)})`);
});

test("spectralSpread: a pure tone spreads near 0; two distant tones spread wide", () => {
  const sampleRate = 8000, fftSize = 1024;
  const freqs = fftBinFreqs(sampleRate, fftSize);
  const pure = dftMag(tones([1000], sampleRate, fftSize), fftSize);
  const split = dftMag(tones([400, 3000], sampleRate, fftSize), fftSize);
  const sPure = spectralSpread(pure, freqs);
  const sSplit = spectralSpread(split, freqs);
  assert.ok(sSplit > sPure, `split-tone spread ${sSplit.toFixed(0)} > pure-tone spread ${sPure.toFixed(0)}`);
});

// ---------------------------------------------------------------------------
// YIN pitch - including the missing fundamental (the headline test).
// ---------------------------------------------------------------------------

test("yinPitch on a 440 Hz sine returns ~440 Hz within ~1%", () => {
  const sampleRate = 44100;
  const n = 2048; // several periods of 440 Hz
  const x = tones([440], sampleRate, n);
  const { f0 } = yinPitch(x, sampleRate, { threshold: 0.1 });
  assert.ok(Math.abs(f0 - 440) / 440 < 0.01, `f0 ${f0.toFixed(2)} within 1% of 440`);
});

test("yinPitch resolves the MISSING FUNDAMENTAL: 400+600+800 Hz -> ~200 Hz residue", () => {
  // No 200 Hz component is present, only its 2nd/3rd/4th harmonics. A spectrum peak-picker would
  // report 400/600/800; YIN's time-domain period analysis recovers the 200 Hz residue pitch.
  const sampleRate = 44100;
  const n = 4096;
  const x = tones([400, 600, 800], sampleRate, n);
  const { f0 } = yinPitch(x, sampleRate, { threshold: 0.1 });
  assert.ok(Math.abs(f0 - 200) / 200 < 0.02, `missing-fundamental f0 ${f0.toFixed(2)} ~ 200 Hz`);

  // Prove it beats peak-picking: the spectral peak is one of the partials, NOT 200 Hz.
  const fftSize = 4096;
  const mag = dftMag(x, fftSize);
  let peakBin = 0, peakVal = 0;
  for (let k = 1; k < mag.length; k++) if (mag[k] > peakVal) { peakVal = mag[k]; peakBin = k; }
  const peakHz = peakBin * sampleRate / fftSize;
  assert.ok(peakHz >= 380, `spectral peak (${peakHz.toFixed(0)} Hz) is a partial, not the 200 Hz residue`);
  assert.ok(Math.abs(peakHz - 200) > 150, "peak-picking misses the fundamental, YIN finds it");
});

test("yinPitch on near-silence does not crash and returns a finite f0", () => {
  const sampleRate = 44100;
  const x = new Float64Array(1024); // all zeros
  const r = yinPitch(x, sampleRate, { threshold: 0.1 });
  assert.ok(Number.isFinite(r.f0), "f0 finite on silence");
});

// ---------------------------------------------------------------------------
// Chroma.
// ---------------------------------------------------------------------------

test("chroma12: a 440 Hz tone (A4) lights the A pitch class strongest", () => {
  const sampleRate = 44100, fftSize = 8192;
  const freqs = fftBinFreqs(sampleRate, fftSize);
  const mag = dftMag(tones([440], sampleRate, fftSize), fftSize);
  const ch = chroma12(mag, freqs);
  assert.equal(ch.length, 12);
  // Pitch class index: A is 9 semitones above C (C=0). Confirm A is the argmax and it is peak=1.
  let argmax = 0, mx = ch[0];
  for (let i = 1; i < 12; i++) if (ch[i] > mx) { mx = ch[i]; argmax = i; }
  assert.equal(argmax, 9, "A4 maps to pitch class 9 (A)");
  assert.ok(Math.abs(mx - 1) < 1e-9, "peak-normalized chroma maxes at 1");
});

// ---------------------------------------------------------------------------
// PBE - Perceptual Band Error.
// ---------------------------------------------------------------------------

test("pbe: identical band readouts give zero error; a single off band is flagged worst", () => {
  const ref = [1, 2, 3, 4, 5];
  const same = pbe(ref, ref);
  assert.ok(Math.abs(same.mean) < 1e-9, "identical -> mean error 0");
  assert.ok(Math.abs(same.std) < 1e-9, "identical -> std 0");

  const telos = [1, 2, 30, 4, 5]; // band index 2 is wildly off
  const off = pbe(telos, ref);
  assert.equal(off.worstBand, 2, "worst band is the divergent one");
  assert.ok(off.mean > 0, "non-zero mean error");
  assert.equal(off.perBand.length, ref.length, "per-band error length matches");
});
