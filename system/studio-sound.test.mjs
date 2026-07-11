// Contract for the sound source's measurement DSP - the two pure functions that
// turn AnalyserNode byte buffers into the level and pitch the perception panel
// shows. The live rAF path can't be observed in a hidden preview tab, so this
// unit test is the guarantee that the analysis math itself is correct.
import test from "node:test";
import assert from "node:assert/strict";
import { rmsFromTime, dominantHz } from "./studio-sound.js";

// getByteTimeDomainData centers silence on 128; a byte b maps to (b-128)/128.
test("rmsFromTime reads silence as zero", () => {
  const buf = new Uint8Array(2048).fill(128);
  assert.equal(rmsFromTime(buf), 0);
});

test("rmsFromTime reads a full-scale rail as ~1", () => {
  const low = new Uint8Array(2048).fill(0); // v = -1 everywhere
  assert.equal(rmsFromTime(low), 1);
  const high = new Uint8Array(2048).fill(255); // v = 127/128
  assert.ok(Math.abs(rmsFromTime(high) - 127 / 128) < 1e-6, "255 rail near 1");
});

test("rmsFromTime of a sine ≈ amplitude / √2", () => {
  const N = 2048, A = 127, cycles = 8;
  const buf = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    buf[i] = 128 + Math.round(A * Math.sin((2 * Math.PI * cycles * i) / N));
  }
  const expected = A / 128 / Math.SQRT2; // ≈ 0.7017
  assert.ok(Math.abs(rmsFromTime(buf) - expected) < 0.02, `sine RMS ${rmsFromTime(buf)} vs ${expected}`);
});

// getByteFrequencyData: bin k of a length fftSize/2 buffer is at frequency
// k * sampleRate / fftSize. dominantHz returns the loudest bin's frequency.
test("dominantHz maps the loudest bin to its frequency", () => {
  const SR = 44100, FFT = 2048;
  const buf = new Uint8Array(FFT / 2).fill(5); // quiet floor
  buf[100] = 240; // a spike at bin 100
  const hz = dominantHz(buf, SR, FFT);
  assert.equal(hz, Math.round((100 * SR) / FFT)); // 2153 Hz
});

test("dominantHz ignores the DC bins (0 and 1)", () => {
  const SR = 44100, FFT = 2048;
  const buf = new Uint8Array(FFT / 2).fill(0);
  buf[0] = 255; // DC leakage, loudest of all
  buf[1] = 255;
  buf[400] = 90; // the real, quieter tone above the floor
  assert.equal(dominantHz(buf, SR, FFT), Math.round((400 * SR) / FFT));
});

test("dominantHz returns 0 below the noise floor", () => {
  const SR = 44100, FFT = 2048;
  assert.equal(dominantHz(new Uint8Array(FFT / 2).fill(0), SR, FFT), 0);
  assert.equal(dominantHz(new Uint8Array(FFT / 2).fill(20), SR, FFT), 0); // all < 24
});

test("dominantHz picks the largest of several peaks", () => {
  const SR = 44100, FFT = 2048;
  const buf = new Uint8Array(FFT / 2).fill(4);
  buf[50] = 120;
  buf[300] = 200; // loudest
  buf[700] = 80;
  assert.equal(dominantHz(buf, SR, FFT), Math.round((300 * SR) / FFT));
});
