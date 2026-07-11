// Contract for the seed-authored audio instrument: deterministic per seed,
// bounded and non-silent PCM, distinct seeds sound different, and a valid WAV.
import test from "node:test";
import assert from "node:assert/strict";
import { audioSeed, seedComposition, renderAudioBuffer, audioToWav } from "./audio.js";

test("audioSeed is FNV-1a and folds null to the default", () => {
  assert.equal(audioSeed("audio"), audioSeed(null));
  assert.equal(typeof audioSeed("aurora"), "number");
});

test("seedComposition is deterministic, string/number equivalent, and bounded", () => {
  const a = seedComposition("aurora");
  assert.deepEqual(a, seedComposition("aurora"));
  assert.deepEqual(a, seedComposition(audioSeed("aurora")));
  for (const seed of ["aurora", "cinder", "obsidian", "", "42"]) {
    const c = seedComposition(seed);
    assert.ok(c.root >= 45 && c.root <= 60, `root ${c.root}`);
    assert.ok(c.bpm >= 68 && c.bpm <= 128, `bpm ${c.bpm}`);
    assert.equal(c.seq.length, 16);
    assert.ok(c.noteCount >= 1, "should have at least one note");
    assert.equal(c.tag.length, 8);
    // timbre normalized
    const sum = c.partials.reduce((x, y) => x + y, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, "partials sum to 1");
  }
});

test("renderAudioBuffer is deterministic and bounded in [-1, 1]", () => {
  const a = renderAudioBuffer("aurora", { sampleRate: 22050 });
  const b = renderAudioBuffer("aurora", { sampleRate: 22050 });
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i += 997) assert.equal(a[i], b[i]);
  let peak = 0, energy = 0;
  for (let i = 0; i < a.length; i += 1) {
    assert.ok(Number.isFinite(a[i]), `finite at ${i}`);
    assert.ok(a[i] >= -1.0001 && a[i] <= 1.0001, `in range at ${i}: ${a[i]}`);
    peak = Math.max(peak, Math.abs(a[i]));
    energy += a[i] * a[i];
  }
  assert.ok(peak > 0.5, `normalized peak near full scale, got ${peak}`);
  assert.ok(energy > 1, "not silent");
});

test("different seeds render different audio", () => {
  const a = renderAudioBuffer("aurora", { sampleRate: 22050 });
  const b = renderAudioBuffer("cinder", { sampleRate: 22050 });
  let diff = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 200) if (Math.abs(a[i] - b[i]) > 1e-4) diff += 1;
  assert.ok(diff > 10, `expected audibly different audio, ${diff} differing samples`);
});

test("audioToWav writes a valid 16-bit PCM WAV header", () => {
  const samples = renderAudioBuffer("aurora", { sampleRate: 22050 });
  const wav = audioToWav(samples, 22050);
  const dv = new DataView(wav.buffer);
  const str = (o, n) => String.fromCharCode(...wav.slice(o, o + n));
  assert.equal(str(0, 4), "RIFF");
  assert.equal(str(8, 4), "WAVE");
  assert.equal(str(12, 4), "fmt ");
  assert.equal(dv.getUint16(20, true), 1, "PCM format");
  assert.equal(dv.getUint16(22, true), 1, "mono");
  assert.equal(dv.getUint32(24, true), 22050, "sample rate");
  assert.equal(dv.getUint16(34, true), 16, "16-bit");
  assert.equal(str(36, 4), "data");
  assert.equal(dv.getUint32(40, true), samples.length * 2, "data chunk size");
  assert.equal(wav.length, 44 + samples.length * 2);
});
