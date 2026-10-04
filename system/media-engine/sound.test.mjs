// node --test system/media-engine/sound.test.mjs
// The sound layer: every producer renders the same PCM every time, meets its loudness class, and
// carries a receipt the contract verifies. The pinned hashes are the reference PCM.
import test from "node:test";
import assert from "node:assert/strict";
import {
  seedScene, musicScene, scanScene, figureScene, renderReference, soundReceipt, wavOf, reducedSound,
  SOUND_RATE, setSoundPreference,
} from "./sound.mjs";
import { sha256, verifyReceipt, wavS16, validateScene, FLICKS_PER_SECOND } from "./contracts.mjs";

const grid = new Float32Array(36 * 88);
for (let i = 0; i < grid.length; i++) grid[i] = ((i * 7919) % 101) / 100;
const freqs = Array.from({ length: 36 }, (_, r) => 110 * Math.pow(32, (35 - r) / 35));
const pts = [];
for (let i = 0; i < 200; i++) { const a = (i / 200) * 2 * Math.PI; pts.push(Math.cos(a) * 0.8, Math.sin(3 * a) * 0.6); }

const SCENES = {
  "seed aurora": seedScene("aurora"),
  music: musicScene(),
  scan: scanScene({ grid, rows: 36, cols: 88 }, freqs, 10),
  figure: figureScene(pts, 110),
};
const PINS = {
  "seed aurora": "e45923f9cb240b8fc861286a130b2c45ff28fd6336742eee89f6883e6a719927",
  music: "9e22915a2ceb9e4f529a54c56e0544e914c5525904649b8969eb958137e3559c",
  scan: "542e0db624e8e1b79154d6272c89851eeea203e3428f73f0876daf7f7bbbf565",
  figure: "6ebfed30bc2d8a434717b4bc350aea87dcc01b1c9eb1978c2426d8a51e017423",
};

test("every scene is a valid superstack.sound/1 scene at 48 kHz", () => {
  for (const [name, s] of Object.entries(SCENES)) {
    assert.deepEqual(validateScene(s), [], name);
    assert.equal(s.rate, SOUND_RATE);
  }
});

test("each reference is the same PCM every time, and the pinned bytes", () => {
  for (const [name, s] of Object.entries(SCENES)) {
    const a = renderReference(s), b = renderReference(JSON.parse(JSON.stringify(s)));
    assert.equal(sha256(a.pcm), sha256(b.pcm), name);
    assert.equal(sha256(a.pcm), PINS[name], name);
    assert.equal(a.pcm.byteLength, s.duration_samples * s.channels * 2, name);
  }
});

test("loudness meets the class target: music -14 LUFS within 1 LU, interactive at most -18", () => {
  for (const [name, s] of Object.entries(SCENES)) {
    const { loudness } = renderReference(s);
    assert.equal(loudness.loudness_verdict, "verified", name + " " + JSON.stringify(loudness));
    if (s.loudness_class === "music") assert.ok(Math.abs(loudness.integrated_lufs + 14) <= 1, name);
    else assert.ok(loudness.integrated_lufs <= -18, name);
  }
});

test("receipts verify, name no autoplay and reduced sound, and time is whole flicks", () => {
  for (const [name, s] of Object.entries(SCENES)) {
    const r = soundReceipt(renderReference(s));
    assert.deepEqual(verifyReceipt(r), [], name);
    assert.equal(r.media.access.autoplay, false);
    assert.equal(r.media.access.reduced_sound, "silent");
    assert.equal(r.media.duration_flicks, r.media.frames * (FLICKS_PER_SECOND / SOUND_RATE));
    assert.ok(Number.isInteger(r.media.duration_flicks));
    assert.ok(r.does_not_prove.length >= 3);
    const forged = { ...r, content_sha256: "0".repeat(64) };
    assert.deepEqual(verifyReceipt(forged), ["seal"]);
  }
  assert.equal(soundReceipt(renderReference(SCENES["seed aurora"])).seed_rule, "splitmix-fnv/1");
});

test("a different seed is a different sound, and the WAV export is the reference's bytes", () => {
  const a = renderReference(seedScene("aurora")), b = renderReference(seedScene("cinder"));
  assert.notEqual(sha256(a.pcm), sha256(b.pcm));
  const wav = wavOf(a);
  assert.deepEqual(wav, wavS16(a.pcm, 48000, 1));
  assert.deepEqual(wav.subarray(44), a.pcm);
});

test("reduced sound follows reduced motion and the site preference", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  globalThis.matchMedia = (q) => ({ matches: false, media: q });
  assert.equal(reducedSound(), false);
  setSoundPreference(false);
  assert.equal(reducedSound(), true);
  setSoundPreference(true);
  assert.equal(reducedSound(), false);
  globalThis.matchMedia = (q) => ({ matches: /reduced-motion: reduce/.test(q), media: q });
  assert.equal(reducedSound(), true);
  delete globalThis.matchMedia; delete globalThis.localStorage;
});
