import test from "node:test";
import assert from "node:assert/strict";
import { rowFrequencies, scanToMIDI } from "./ans-voice.js";

test("row frequencies descend the image and span the range", () => {
  const f = rowFrequencies(40, { mode: "log", loHz: 110, hiHz: 3520 });
  assert.equal(f.length, 40);
  assert.ok(Math.abs(f[39] - 110) < 1, "bottom row is the low end");
  assert.ok(Math.abs(f[0] - 3520) < 40, "top row is the high end");
  for (let r = 1; r < 40; r++) assert.ok(f[r] < f[r - 1], "monotonic: lower rows sound lower");
});

test("pentatonic fold lands every row on a scale degree of the root", () => {
  const PENTA = new Set([0, 3, 5, 7, 10]);
  const f = rowFrequencies(32, { mode: "penta", rootMidi: 45 });
  for (const hz of f) {
    const n = Math.round(69 + 12 * Math.log2(hz / 440));
    assert.ok(PENTA.has(((n - 45) % 12 + 12) % 12), "row at MIDI " + n + " is on the scale");
  }
});

function gridOf(rows, cols, fn) {
  const grid = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r * cols + c] = fn(r, c);
  return { grid, rows, cols };
}

test("a bright run becomes one note with run-length duration", () => {
  const scan = gridOf(4, 16, (r, c) => (r === 2 && c >= 4 && c < 9 ? 0.8 : 0));
  const freqs = rowFrequencies(4, { mode: "log" });
  const ev = scanToMIDI(scan, freqs, { ticksPerColumn: 120 });
  const ons = ev.filter((e) => e.type === "on");
  const offs = ev.filter((e) => e.type === "off");
  assert.equal(ons.length, 1);
  assert.equal(offs.length, 1);
  assert.equal(ons[0].tick, 4 * 120);
  assert.equal(offs[0].tick, 9 * 120, "the off lands where the run ends");
  assert.ok(ons[0].b > 90, "velocity follows brightness");
});

test("polyphony cap keeps the brightest voices and their offs consistent", () => {
  const scan = gridOf(12, 4, (r, c) => (c === 1 ? 0.3 + r * 0.05 : 0));
  const freqs = rowFrequencies(12, { mode: "log" });
  const ev = scanToMIDI(scan, freqs, { maxNotesPerColumn: 3 });
  const ons = ev.filter((e) => e.type === "on");
  assert.equal(ons.length, 3, "capped at three voices");
  const onNotes = new Set(ons.map((e) => e.a));
  for (const off of ev.filter((e) => e.type === "off")) {
    assert.ok(onNotes.has(off.a), "no orphan note-off survives the cull");
  }
  const kept = ons.map((e) => e.b).sort((a, b) => a - b);
  assert.ok(kept[0] >= Math.round(0.3 * 127), "the culled voices were the dimmest");
});
