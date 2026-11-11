// Known signals with known answers: the ear must read each one correctly before its reading of music means anything.
//   node --test system/ear/ear.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { listen, encodePng, spectrum, levels, pitch, time, rough, stereoField, mask } from './index.js';
import { fft } from '../../world/sound/sound/dsp.js';

const SR = 48000, TAU = 2 * Math.PI;
export const sine = (f, sec, amp = 0.5, sr = SR) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin(TAU * f * i / sr));
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export const white = (sec, amp = 0.2, seed = 1) => { const r = rng(seed); return Float32Array.from({ length: Math.round(sec * SR) }, () => amp * (r() * 2 - 1)); };
const add = (...xs) => { const out = new Float32Array(Math.max(...xs.map((x) => x.length))); for (const x of xs) for (let i = 0; i < x.length; i++) out[i] += x[i]; return out; };
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, want ${b} +/- ${tol}`);
// pink noise: white noise with its spectrum scaled by 1 / sqrt(f), which gives equal power in every octave
function pink(sec, seed = 3) { const n = 1 << Math.ceil(Math.log2(sec * SR)), re = Float64Array.from(white(n / SR, 1, seed)), im = new Float64Array(n); fft(re, im);
  for (let k = 1; k < n / 2; k++) { const g = 1 / Math.sqrt(k); re[k] *= g; im[k] *= g; re[n - k] *= g; im[n - k] *= g; } re[0] = im[0] = 0; fft(re, im, true);
  let pk = 0; for (const v of re) pk = Math.max(pk, Math.abs(v)); return Float32Array.from(re, (v) => 0.5 * v / pk); }
// a tone with four harmonics, like a plain instrument note
const note = (m, sec, amp = 0.2) => add(...[1, 2, 3, 4].map((h) => sine(spectrum.mtof(m) * h, sec, amp / (h * h))));
function clicks(bpm, bars, swing) { const beat = 60 / bpm, x = new Float32Array(Math.round((bars * 4 * beat + 0.5) * SR));
  const hit = (t, a) => { const at = Math.round(t * SR); for (let i = 0; i < 240; i++) x[at + i] += a * Math.sin(TAU * 1800 * i / SR) * Math.exp(-i / 40); };
  for (let b = 0; b < bars * 4; b++) { hit(0.1 + b * beat, 0.8); hit(0.1 + (b + swing) * beat, 0.4); } return x; }

test('a 997 Hz sine at -23 dBFS in both channels reads -23 LUFS, -23 dBTP, 3 dB crest, no clipping, no DC', () => {
  const x = sine(997, 6, Math.pow(10, -23 / 20)), L = levels.level([x, x], SR);
  near(L.integratedLufs, -23, 0.1, 'integrated loudness'); near(L.truePeakDb, -23, 0.1, 'true peak'); near(L.crestDb, 3.01, 0.05, 'crest');
  assert.equal(L.clippedSamples, 0); assert.ok(L.dcMax < 1e-4); near(L.lra, 0, 0.2, 'loudness range of a steady tone');
});

test('loudness range reads the 10 dB step between two halves', () => {
  const a = sine(997, 30, 0.05), b = sine(997, 30, 0.05 * Math.pow(10, 10 / 20)), x = new Float32Array(a.length + b.length); x.set(a); x.set(b, a.length);
  near(levels.level([x, x], SR).lra, 10, 0.6, 'loudness range');
});

test('a 440 Hz sine is found at 440 Hz, on pitch class A, in tune; 30 cents sharp reads 30 cents sharp', () => {
  const pf = pitch.partialFrames(sine(440, 2), SR), pk = pf.frames[3][0];
  near(1200 * Math.log2(pk.f / 440), 0, 2, 'frequency error in cents'); near(pk.a, 0.5, 0.02, 'amplitude');
  const row = pitch.chromaSpans(pf, [{ t0: 0, t1: 2 }])[0]; assert.ok(row.chroma[9] > 0.99, 'chroma on A'); near(row.cents, 0, 2, 'tuning');
  const sharp = pitch.tuning(sine(440 * Math.pow(2, 30 / 1200), 2), SR, [{ t0: 0.2, t1: 1.8, m: 69 }]); near(sharp.worst.cents, 30, 3, 'mistuned sine');
});

test('written chords are named by root and family, and fit themselves', () => {
  const cases = [['Dm9', 2, [0, 3, 7, 10, 2], 'minor', [38, 53, 57, 60, 64]], ['G13', 7, [0, 4, 7, 10, 2, 9], 'dominant', [43, 53, 59, 64, 69]], ['Cmaj9', 0, [0, 4, 7, 11, 2], 'major', [36, 52, 55, 59, 62]]];
  let t = 0; const parts = [], chords = [];
  for (const [sym, root, iv, , notes] of cases) { const seg = add(...notes.map((m) => note(m, 3))); parts.push(seg); chords.push({ t0: t, t1: t + 3, bar: chords.length, sym, root, pcs: iv.map((i) => (root + i) % 12) }); t += 3; }
  const x = new Float32Array(parts.reduce((s, p) => s + p.length, 0)); parts.reduce((o, p) => (x.set(p, o), o + p.length), 0);
  const h = pitch.harmony([x], SR, chords);
  h.rows.forEach((r, i) => { assert.ok(r.rootMatch, `${r.written}: root heard as ${r.rootHeard}`); assert.ok(r.fit > 0.85, `${r.written}: fit ${r.fit}`);
    const est = pitch.estimateChord(r.chroma, pitch.chromaSpans(pitch.partialFrames(x, SR), [chords[i]])[0].bass); assert.equal(est.root, cases[i][1], `${r.written} heard as ${est.name}`); assert.equal(est.family, cases[i][3]); });
  const wrong = pitch.harmony([x], SR, chords.map((c) => ({ ...c, root: (c.root + 1) % 12, pcs: c.pcs.map((p) => (p + 1) % 12) })));
  assert.ok(wrong.meanFit < 0.45 && wrong.rootMatchRate === 0, `the same audio against chords a semitone up must not fit (fit ${wrong.meanFit})`);
});

test('pink noise has a flat octave-band slope and white noise rises 3 dB per octave', () => {
  const slope = (x) => spectrum.slopePerOctave(spectrum.octaveBands(spectrum.averageSpectrum([x], SR)));
  near(slope(pink(20)), 0, 0.35, 'pink slope, dB per octave'); near(slope(white(20)), 3.01, 0.35, 'white slope, dB per octave');
});

test('click tracks: tempo, swing and regularity are read back', () => {
  for (const [bpm, swing] of [[72, 0.62], [96, 0.5], [64, 0.667]]) {
    const t = time.timing([clicks(bpm, 12, swing)], SR);
    near(t.bpm, bpm, bpm * 0.004, `tempo of the ${bpm} BPM track`); near(t.swing, swing, 0.015, `swing of the ${bpm} BPM track`);
    assert.ok(t.regularityMs < 2, `regularity ${t.regularityMs} ms`); assert.ok(t.driftMaxPct < 0.4, `drift ${t.driftMaxPct} %`);
    near(t.onsetsPerSecond, 2 * bpm / 60, 0.25, 'onset density');
  }
});

test('roughness follows the published curve: zero at unison, greatest near a quarter of a critical band, low for a fifth', () => {
  assert.equal(rough.pairRoughness(440, 440), 0);
  let best = 0, at = 0; for (let df = 1; df < 300; df++) { const d = rough.pairRoughness(440, 440 + df); if (d > best) { best = d; at = df; } }
  near(at, Math.log(5.75 / 3.5) / 2.25 / (0.24 / (0.021 * 440 + 19)), 1, 'spacing of greatest roughness at 440 Hz, Hz');   // where the curve's derivative is zero
  const dyad = (ratio) => rough.roughness([add(sine(440, 2, 0.3), sine(440 * ratio, 2, 0.3))], SR).mean;
  const semitone = dyad(Math.pow(2, 1 / 12)), fifth = dyad(1.5), unison = rough.roughness([sine(440, 2, 0.3)], SR).mean;
  assert.ok(semitone > 8 * fifth, `semitone ${semitone} against fifth ${fifth}`); assert.ok(unison < 0.002, `single tone ${unison}`);
  assert.ok(Math.abs(dyad(1.06) / rough.roughness([add(sine(440, 2, 0.03), sine(440 * 1.06, 2, 0.03))], SR).mean - 1) < 0.05, 'roughness does not change with level');
});

test('stereo: same signal, inverted signal and unrelated signals', () => {
  const a = white(4, 0.2, 5), b = white(4, 0.2, 9), inv = a.map((v) => -v);
  const same = stereoField.stereo([a, a], SR), flip = stereoField.stereo([a, inv], SR), apart = stereoField.stereo([a, b], SR);
  near(same.correlation, 1, 1e-6, 'identical channels'); near(same.monoLossDb, 0, 0.01, 'mono loss of identical channels');
  near(flip.correlation, -1, 1e-6, 'inverted channel'); assert.ok(flip.monoLossDb < -60, 'an inverted channel cancels in mono');
  near(apart.correlation, 0, 0.03, 'unrelated noise'); near(apart.monoLossDb, -3.01, 0.15, 'mono loss of unrelated noise');
});

test('a 40 ms hole in a tone is found where it was cut, and a whole tone has none', () => {
  const x = sine(300, 3, 0.3); assert.equal(stereoField.gaps([x], SR).dropouts.length, 0);
  const y = x.slice(); y.fill(0, Math.round(1.5 * SR), Math.round(1.54 * SR)); const g = stereoField.gaps([y], SR);
  assert.equal(g.dropouts.length, 1); near(g.dropouts[0].t, 1.5, 0.01, 'dropout time'); near(g.dropouts[0].ms, 40, 6, 'dropout length');
});

test('masking: a tone 20 dB over the noise in its band reads about +20, and the reverse reads negative', () => {
  const tone = sine(1000, 4, 0.2), noise = white(4, 0.2, 2), spec = spectrum.averageSpectrum([noise], SR), inBand = spectrum.bandPower(spec, 1000 / Math.SQRT2, 1000 * Math.SQRT2);
  const toneIn = spectrum.bandPower(spectrum.averageSpectrum([tone], SR), 1000 / Math.SQRT2, 1000 * Math.SQRT2), g = Math.sqrt(toneIn / 100 / inBand), quiet = noise.map((v) => v * g), m = mask.masking([tone], [quiet], SR), i = m.bands.indexOf(1000);
  near(m.over[i], 20, 1.5, 'tone over noise in the 1 kHz band'); near(m.leadOver, 20, 2, 'weighted by where the tone is');
  assert.ok(mask.masking([tone.map((v) => v * 0.01)], [noise], SR).leadOver < -10, 'a quiet tone under loud noise is masked');
});

test('the PNG writer produces a file a standard decoder reads back pixel for pixel', () => {
  const w = 5, h = 3, rgb = Uint8Array.from({ length: w * h * 3 }, (_, i) => (i * 37) % 256), png = encodePng(w, h, rgb), v = new DataView(png.buffer);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]); assert.equal(v.getUint32(16), w); assert.equal(v.getUint32(20), h);
  const len = v.getUint32(33), raw = inflateSync(png.subarray(41, 41 + len));
  for (let y = 0; y < h; y++) { assert.equal(raw[y * (w * 3 + 1)], 0); assert.deepEqual([...raw.subarray(y * (w * 3 + 1) + 1, (y + 1) * (w * 3 + 1))], [...rgb.subarray(y * w * 3, (y + 1) * w * 3)]); }
});

test('listen() on a clean steady tone raises only the flags a bare tone deserves', () => {
  const x = sine(997, 8, Math.pow(10, -14 / 20)), r = listen({ channels: [x, x], sr: SR }), ids = r.flags.map((f) => f.id);
  for (const id of ['loudness', 'true-peak', 'clipping', 'dc-offset', 'dropout', 'correlation', 'mono']) assert.ok(!ids.includes(id), `unexpected flag ${id}`);
  assert.ok(ids.includes('balance'), 'a single tone is far from the balance target, and the ear says so');
});
