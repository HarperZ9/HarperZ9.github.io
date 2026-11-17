// Live canvases say what their data does, from the numbers they draw, on a slow clock that never talks over the page.
// Run: node --test tests/live-descriptions.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDescription, describeSeries } from "../system/chart-describe.mjs";
import { describeSpectrum, describeSpectrogram, describeColumns, column } from "../system/chart-describe-sound.mjs";
import { liveDescription } from "../system/live-describe.mjs";
import { motionDescription, spectrumDescription, bandDescription } from "../system/studio-describe.mjs";
import { stft } from "../world/sound/sound/dsp.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const ok = (d) => assert.deepEqual(checkDescription(d.text, d.facts), [], d.text);
// a seeded generator, so the fuzz cases are the same on every run
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test("planted: the old static labels fail against the data they sat on", () => {
  const moving = Array.from({ length: 96 }, (_, i) => (i > 70 ? 0.3 : 0));
  assert.ok(checkDescription("Sparkline showing frame-to-frame perceptual motion over time", motionDescription(moving).facts).length > 0);
  const bars = Array.from({ length: 64 }, (_, i) => Math.exp(-i / 6));
  assert.ok(checkDescription("Spectrum of what is playing", spectrumDescription(bars, 43).facts).length > 0);
  const frames = chirp().frames;
  assert.ok(checkDescription("Spectrogram: frequency up, time to the right", describeSpectrogram(frames, { binHz: 22050 / 2048, hopS: 512 / 22050 }).facts).length > 0);
});

test("planted: a motion sentence that says rises over a history that only falls fails", () => {
  const falling = Array.from({ length: 96 }, (_, i) => Math.max(0, 0.5 - i / 150));
  const d = motionDescription(falling);
  ok(d);
  assert.match(d.text, /^Motion falls from 32 of 64 bits 95 frames ago/);
  assert.ok(checkDescription("Motion rises from 0 of 64 bits to 32 of 64 bits.", d.facts).some((e) => /never rises/.test(e)));
});

test("the motion sparkline: still, a burst, and 200 seeded histories all pass the checker", () => {
  assert.match(motionDescription(new Array(96).fill(0)).text, /^Motion stays level at about 0 of 64 bits from 95 frames ago to now\.$/);
  const burst = Array.from({ length: 96 }, (_, i) => (i >= 40 && i < 50 ? 0.4 : 0));
  assert.match(motionDescription(burst).text, /to a peak of 26 of 64 bits/);
  for (let s = 1; s <= 200; s++) { const r = rng(s); ok(motionDescription(Array.from({ length: 96 }, () => (r() < 0.3 ? r() * 0.6 : 0)))); }
});

test("a spectrum is loudest where its tone is, and half its energy sits on the heavy side", () => {
  const tone = Array.from({ length: 64 }, (_, i) => (i === 10 ? 0.9 : 0.01)), d = spectrumDescription(tone, 100);
  ok(d); assert.match(d.text, /loudest at 1.05 kHz, 0.9/);
  const low = spectrumDescription(Array.from({ length: 64 }, (_, i) => 1 / (1 + i)), 100), high = spectrumDescription(Array.from({ length: 64 }, (_, i) => i / 64), 100);
  ok(low); ok(high);
  assert.ok(low.facts.medianHz < high.facts.medianHz, `${low.facts.medianHz} vs ${high.facts.medianHz}`);
  const quiet = spectrumDescription(new Array(32).fill(0), 750);
  ok(quiet); assert.match(quiet.text, /flat near silence/);
  const db = describeSpectrum(Array.from({ length: 48 }, (_, i) => (i < 10 ? -20 : -70)), (i) => 30 * 2 ** (i / 5), { db: true, quiet: -84 });
  ok(db); assert.match(db.text, /Across frequency the level falls/);
  for (let s = 1; s <= 100; s++) { const r = rng(s); ok(spectrumDescription(Array.from({ length: 32 }, () => r()), 750)); }
});

test("the music strip names its three bands in order", () => {
  const d = bandDescription({ bass: 0.6, mid: 0.3, treble: 0.1 });
  ok(d); assert.match(d.text, /^Bass is highest at 0.6 and treble lowest at 0.1/);
});

// a rising sine, 0.5 to 4 kHz over 2 s, through the sound engine's own STFT
function chirp() {
  const sr = 22050, n = sr * 2, x = new Float32Array(n);
  let ph = 0; for (let i = 0; i < n; i++) { ph += (2 * Math.PI * (500 + 3500 * (i / n))) / sr; x[i] = 0.5 * Math.sin(ph); }
  return stft(x, sr, { n: 2048, hop: 512 });
}

test("a spectrogram of a rising chirp says the loudest frequency rises, at a steady rate, 0.5 to 4 kHz", () => {
  const S = chirp(), d = describeSpectrogram(S.frames, { binHz: S.binHz, hopS: S.hopSec });
  ok(d);
  assert.match(d.text, /The loudest frequency rises from (5\d\d Hz|1 kHz) at 0 s to (3\.[89]\d* kHz|4 kHz) at [12]\.\d s, at a nearly steady rate/);
  const silent = describeSpectrogram(stft(new Float32Array(22050), 22050, { n: 2048, hop: 512 }).frames, { binHz: S.binHz, hopS: S.hopSec, quiet: -90 });
  ok(silent); assert.match(silent.text, /flat near silence/);
});

test("the live view's columns say time before now", () => {
  const cols = Array.from({ length: 120 }, (_, i) => ({ db: -40 + i / 6, best: -30, peakHz: 1000 }));
  const AGO = { fmt: Object.assign((t) => (Math.abs(t) < 0.05 ? "now" : `${Number((-t).toFixed(1))} s ago`), { at: (t) => (Math.abs(t) < 0.05 ? "now" : `${Number((-t).toFixed(1))} s ago`) }) };
  const d = describeColumns(cols, { stepS: 1 / 60, t0: -119 / 60, x: AGO });
  ok(d); assert.match(d.text, /^Loudness rises from −40 dB 2 s ago to −20.2 dB now/);
  assert.equal(column(Float32Array.from([-100, -20, -60, -100]), 10).peakHz, 10);
});

test("a series sampled at a fixed step reads in seconds", () => {
  const d = describeSeries([0, 0.2, 0.6, 1, 0.6, 0.2, 0], 0.1, { name: "loudness" });
  ok(d); assert.match(d.text, /^Loudness rises from 0 at 0 s to a peak of 1 at 0.3 s, then falls to 0 at 0.6 s\./);
});

test("the live describer: at most one computation per 2 s, labels only on change, speech only on a state change", () => {
  let t = 0, computed = 0; const labels = [], el = { setAttribute: (k, v) => labels.push([k, v]) }, live = { textContent: "" };
  const w = liveDescription(el, { axes: "Axes.", live, key: (f) => f.state, now: () => t });
  const say = (state, text) => () => { computed++; return { text, facts: { state } }; };
  for (let i = 0; i < 100; i++) { t = i * 19; w.update(say("still", "Still.")); }      // 0 to 1.9 s
  assert.equal(computed, 1); assert.deepEqual(labels, [["aria-label", "Still. Axes."]]); assert.equal(live.textContent, "");
  t = 2000; w.update(say("still", "Still.")); assert.equal(computed, 2); assert.equal(labels.length, 1, "same words, no rewrite");
  t = 4000; w.update(say("moving", "Moving.")); assert.equal(live.textContent, "Moving.", "a change of state is spoken");
  t = 6000; w.update(say("still", "Still again.")); assert.equal(live.textContent, "Moving.", "but not twice inside 20 s");
  t = 26000; w.update(say("still", "Still again.")); assert.equal(live.textContent, "Still again.");
  t = 60000; w.update(say("still", "Still, later.")); assert.equal(live.textContent, "Still again.", "the same state is not news");
  const text = { textContent: "" }; liveDescription(text, { as: "text", now: () => 0 }).update(() => ({ text: "Words.", facts: {} })); assert.equal(text.textContent, "Words.");
});

test("planted: a describer with no throttle would compute on every frame", () => {
  let n = 0; const w = liveDescription(null, { every: 0, now: (() => { let t = 0; return () => (t += 16); })() });
  for (let i = 0; i < 60; i++) w.update(() => (n++, { text: "x", facts: {} }));
  assert.equal(n, 60);
  let m = 0; const v = liveDescription(null, { now: (() => { let t = 0; return () => (t += 16); })() });
  for (let i = 0; i < 60; i++) v.update(() => (m++, { text: "x", facts: {} }));
  assert.ok(m <= 1, `the default throttle computed ${m} times in one second`);
});

test("each live canvas is wired to its describer", () => {
  const studio = read("system/studio.js"), html = read("studio.html");
  assert.match(studio, /motionWords\.update\(\(\) => motionDescription\(motionHist\)\)/);
  assert.match(studio, /spectrumWords\(sp\)\.update\(\(\) => spectrumDescription\(bars,/);
  assert.match(html, /id="mm-motion-live" aria-live="polite"/);
  assert.doesNotMatch(html, /Sparkline showing frame-to-frame perceptual motion over time/);
  assert.match(read("world/sound/sound-demo.js"), /scopeWords\.update\(\(\) => describeSpectrum\(bars,/);
  const reveal = read("world/sound/sound/reveal.js");
  assert.match(reveal, /canvas\.setAttribute\('aria-label', `\$\{d\.text\}/);
  assert.match(reveal, /words\.update\(\(\) => describeColumns\(cols,/);
  assert.match(read("world/visualizer/web/app.js"), /updateHud\(M\); describeInk\(M\);/);
  assert.match(read("world/visualizer/web/index.html"), /<p id="inkwords" class="vh">/);
});

test("the world pieces keep their words through the next import: every chart-words patch is present in its file", () => {
  const cfg = JSON.parse(read("scripts/import-mission-control.config.json")), imp = JSON.parse(read("world/IMPORT.json"));
  const mine = cfg.patches.filter((p) => p.why.startsWith("chart words:"));
  assert.ok(mine.length >= 5, `${mine.length} chart-words patches`);
  for (const p of mine) {
    const f = imp.files.find((x) => x.source === p.file);
    assert.ok(f, `no imported file for ${p.file}`);
    assert.ok(read(f.path).includes(p.replace), `${f.path} lacks the patch it records`);
  }
  // a source saved with CRLF still takes the patches (they were silently skipped before)
  assert.ok(read("scripts/import-mission-control.mjs").includes(String.raw`const eol = text.includes("\r\n")`), "the import applies LF patches to CRLF sources");
});

test("the copies of the describer in other repos pin this file's hash, so a change here cannot drift unseen", async () => {
  const { createHash } = await import("node:crypto");
  const pin = JSON.parse(read("system/chart-describe.vendored.json")), body = read("system/chart-describe.mjs").replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(body).digest("hex"), pin.sha256, "system/chart-describe.mjs changed: carry it to every copy listed in system/chart-describe.vendored.json and update the pin there and here");
  assert.ok(pin.copies.length >= 1);
});
