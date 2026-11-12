// Known signals for the round-two measures: repetition, entries, presence, the low end, roughness between layers, and
// tempo on a fast syncopated break.
//   node --test system/ear/shape.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { listen, balance, TARGETS, shape, low, rough, time } from './index.js';
import { fft } from '../../world/sound/sound/dsp.js';

const SR = 48000, TAU = 2 * Math.PI, near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, want ${b} +/- ${tol}`);
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const tone = (x, f, t0, dur, amp = 0.2) => { const a = Math.round(t0 * SR), n = Math.round(dur * SR); for (let i = 0; i < n && a + i < x.length; i++) x[a + i] += amp * Math.sin(TAU * f * i / SR) * Math.min(1, i / 200, (n - i) / 2000); return x; };
const burst = (x, t0, dur, amp, r, lowCut = 0) => { const a = Math.round(t0 * SR), n = Math.round(dur * SR); let lp = 0; for (let i = 0; i < n && a + i < x.length; i++) { const w = r() * 2 - 1; lp += 0.05 * (w - lp); x[a + i] += amp * (lowCut ? w - lp : w) * Math.exp(-i / (n / 5)); } return x; };
// an eight-bar phrase at 120 BPM: a seeded melody of eighth notes
function phrase(x, t0, seed) { const r = rng(seed); for (let k = 0; k < 64; k++) if (r() < 0.7) tone(x, 220 * Math.pow(2, Math.floor(r() * 15) / 12), t0 + k * 0.25, 0.22); return x; }
const bars = (n) => Array.from({ length: n }, (_, i) => ({ bar: i, t0: i * 2, t1: (i + 1) * 2 }));

test('repetition: a phrase played four times reads as one performance; four different phrases do not', () => {
  const loop = new Float32Array(64 * SR), varied = new Float32Array(64 * SR);
  for (let k = 0; k < 4; k++) { phrase(loop, k * 16, 5); phrase(varied, k * 16, 5 + k * 17); }
  const a = shape.repetition([loop], SR, bars(32)), b = shape.repetition([varied], SR, bars(32));
  assert.equal(a.phrases, 4); assert.ok(a.adjacentMean > 0.98 && a.sameShare === 1, `loop: ${a.adjacentMean}, ${a.sameShare}`);
  assert.ok(b.max < 0.6 && b.sameShare === 0, `varied: highest ${b.max}`);
});

test('entries: a 12 dB step reads 12 dB and a slow ramp reads little; layers that start together are counted', () => {
  const step = new Float32Array(40 * SR), ramp = new Float32Array(40 * SR);
  for (let i = 0; i < step.length; i++) { const s = Math.sin(TAU * 440 * i / SR), t = i / SR; step[i] = s * (t < 20 ? 0.05 : 0.05 * Math.pow(10, 12 / 20)); ramp[i] = s * 0.05 * Math.pow(10, (12 * Math.min(1, Math.max(0, (t - 5) / 30))) / 20); }
  near(shape.entries([step], SR).maxRiseDb, 12, 0.5, 'step'); assert.ok(shape.entries([ramp], SR).maxRiseDb < 2, 'ramp');
  const layer = (f, t0) => [tone(new Float32Array(40 * SR), f, t0, 40 - t0)];
  const together = shape.layerEntries({ keys: layer(440, 1), bass: layer(110, 12), drums: layer(2000, 12.5), lead: layer(880, 13) }, SR), staged = shape.layerEntries({ keys: layer(440, 1), bass: layer(110, 12), drums: layer(2000, 18), lead: layer(880, 26) }, SR);
  assert.deepEqual(together.together.sort(), ['bass', 'drums', 'lead']); near(together.at, 12, 0.3, 'time of the joint entry'); assert.ok(together.togetherShare > 0.6);
  assert.equal(staged.togetherCount, 1); near(staged.first.find((f) => f.name === 'drums').t, 18, 0.45, 'first sound of a layer');
});

test('presence: noise shaped to the target curve reads 0, and the same noise 6 dB down above 1.4 kHz reads 6 dB under', () => {
  const n = 1 << 20, r = rng(11), make = (cut) => { const re = Float64Array.from({ length: n }, () => r() * 2 - 1), im = new Float64Array(n); fft(re, im);
    const T = TARGETS.balance, gain = (f) => { let g = -60; for (let i = 0; i < T.centers.length; i++) if (f >= T.centers[i] / Math.SQRT2 && f < T.centers[i] * Math.SQRT2) g = T.db[i] - 10 * Math.log10(T.centers[i]); return Math.pow(10, (g + (f > 1414 ? cut : 0)) / 20); };   // per-octave level over bandwidth gives density
    for (let k = 1; k < n / 2; k++) { const g = gain(k * SR / n); re[k] *= g; im[k] *= g; re[n - k] *= g; im[n - k] *= g; } re[0] = im[0] = 0; fft(re, im, true); let pk = 0; for (const v of re) pk = Math.max(pk, Math.abs(v)); return Float32Array.from(re, (v) => 0.5 * v / pk); };
  const flat = balance([make(0)], SR), dull = balance([make(-6)], SR);
  near(flat.presenceDb, 0, 0.8, 'on target'); for (const d of flat.deviation) assert.ok(Math.abs(d) < 1.5, `band deviation ${d}`);
  near(dull.presenceDb - flat.presenceDb, -6 + 6 * 0.0, 2.2, 'six dB down at the top');   // the bands below lose share too, so the reading is a little under 6
  assert.ok(dull.presenceDb < -3.5);
});

test('low end: bass out of phase between the channels is caught even when the whole mix sums well', () => {
  const n = 6 * SR, L = new Float32Array(n), R = new Float32Array(n), R2 = new Float32Array(n);
  for (let i = 0; i < n; i++) { const lo = 0.1 * Math.sin(TAU * 60 * i / SR), hi = 0.3 * Math.sin(TAU * 1000 * i / SR); L[i] = lo + hi; R[i] = -lo + hi; R2[i] = lo + hi; }
  const bad = low.lowMono([L, R], SR), good = low.lowMono([L, R2], SR);
  assert.ok(bad.lowMonoLossDb < -20, `inverted low end: ${bad.lowMonoLossDb} dB`); near(bad.lowCorrelation, -1, 0.05, 'low correlation'); near(good.lowMonoLossDb, 0, 0.05, 'in phase');
  const whole = listen({ channels: [L, R], sr: SR }).flags.map((f) => f.id); assert.ok(whole.includes('low-mono') && !whole.includes('mono'), `flags ${whole}`);
});

test('low end: two bass layers in the same band clash, and an octave apart they do not', () => {
  const s = (f) => [tone(new Float32Array(6 * SR), f, 0, 6)];
  near(low.lowClash(s(50), s(56), SR).clashShare, 1, 0.01, 'same band'); near(low.lowClash(s(50), s(110), SR).clashShare, 0, 0.01, 'an octave apart');
});

test('roughness between layers: a bass a semitone off its chord reads rougher than the right bass', () => {
  const chord = [new Float32Array(4 * SR)]; for (const m of [48, 52, 55, 59]) for (let h = 1; h <= 4; h++) tone(chord[0], 440 * Math.pow(2, (m - 69) / 12) * h, 0, 4, 0.1 / h);
  const bass = (m) => { const x = new Float32Array(4 * SR); for (let h = 1; h <= 6; h++) tone(x, 440 * Math.pow(2, (m - 69) / 12) * h, 0, 4, 0.2 / h); return [x]; };
  const right = rough.crossRoughness([chord, bass(36)], SR).mean, wrong = rough.crossRoughness([chord, bass(37)], SR).mean;
  assert.ok(wrong > 1.3 * right, `wrong ${wrong} against right ${right}`);
});

test('tempo on a fast syncopated break: 168 BPM is read with the score, and as 168 or its half without it', () => {
  const bpm = 168, beat = 60 / bpm, step = beat / 4, x = new Float32Array(Math.round((16 * 4 * beat + 1) * SR)), r = rng(3);
  const kick = (t, a) => tone(x, 55, t, 0.12, a), snare = (t, a) => burst(x, t, 0.09, a, r), hat = (t, a) => burst(x, t, 0.03, a, r, 1);
  for (let b = 0; b < 16; b++) { const o = 0.2 + b * 16 * step, alt = b % 2;   // a two-bar break: kicks off the beat, ghost snares, a roll into every fourth bar
    kick(o, 0.5); kick(o + (alt ? 6 : 10) * step, 0.4); if (alt) kick(o + 11 * step, 0.3); snare(o + 4 * step, 0.4); snare(o + 12 * step, 0.4);
    for (const g of alt ? [7, 9, 15] : [2, 7]) snare(o + g * step, 0.1); for (let k = 0; k < 16; k += 2) hat(o + k * step, k % 4 ? 0.1 : 0.16);
    if (b % 4 === 3) for (let k = 13; k < 16; k += 0.5) snare(o + k * step, 0.08 + 0.02 * (k - 13)); }
  const hinted = time.timing([x], SR, { bpm }), free = time.timing([x], SR);
  near(hinted.bpm, bpm, bpm * 0.005, 'tempo with the score'); assert.ok(hinted.driftMaxPct < 0.5 && hinted.regularityMs < 6, `drift ${hinted.driftMaxPct} %, spread ${hinted.regularityMs} ms`);
  assert.ok(Math.abs(free.bpmUnhinted / bpm - 1) < 0.005 || Math.abs(free.bpmUnhinted / (bpm / 2) - 1) < 0.005, `unhinted reading ${free.bpmUnhinted}`);
  near(hinted.swing ?? 0.5, 0.5, 0.03, 'straight sixteenths');
});
