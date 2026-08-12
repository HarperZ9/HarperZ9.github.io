import { test } from "node:test";
import assert from "node:assert/strict";
import { vlq, writeMIDI } from "./midi-writer.js";

// Reads one VLQ starting at offset; returns {value, next}.
function readVLQ(bytes, offset) {
  let value = 0;
  let i = offset;
  while (bytes[i] & 0x80) {
    value = (value << 7) | (bytes[i] & 0x7F);
    i++;
  }
  value = (value << 7) | (bytes[i] & 0x7F);
  return { value, next: i + 1 };
}

test("vlq matches the spec worked examples", () => {
  assert.deepEqual(vlq(0), [0x00]);
  assert.deepEqual(vlq(0x40), [0x40]);
  assert.deepEqual(vlq(127), [0x7F]);
  assert.deepEqual(vlq(128), [0x81, 0x00]);
  assert.deepEqual(vlq(255), [0x81, 0x7F]);
  assert.deepEqual(vlq(0x2000), [0xC0, 0x00]);
  assert.deepEqual(vlq(16383), [0xFF, 0x7F]);
  assert.deepEqual(vlq(32768), [0x82, 0x80, 0x00]);
  assert.deepEqual(vlq(0x0FFFFFFF), [0xFF, 0xFF, 0xFF, 0x7F]);
});

test("header is MThd 00000006 format 0 one track with the division", () => {
  const bytes = writeMIDI({ ticksPerQuarter: 480, events: [] });
  const head = [
    0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
    0x00, 0x00, 0x00, 0x01, 0x01, 0xE0,
  ];
  assert.deepEqual(Array.from(bytes.slice(0, 14)), head);
  assert.deepEqual(Array.from(bytes.slice(14, 18)), [0x4D, 0x54, 0x72, 0x6B]);
});

test("track length field equals the actual data byte count", () => {
  const bytes = writeMIDI({
    events: [{ tick: 0, type: "on", ch: 0, a: 60, b: 100 }],
  });
  const declared =
    (bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21];
  assert.equal(declared, bytes.length - 22);
});

test("file ends with the End of Track meta FF 2F 00", () => {
  const bytes = writeMIDI({ events: [] });
  const tail = Array.from(bytes.slice(bytes.length - 3));
  assert.deepEqual(tail, [0xFF, 0x2F, 0x00]);
});

test("tempo meta at tick 0 encodes microseconds per quarter", () => {
  const bytes = writeMIDI({ tempoBPM: 120, events: [] });
  // Track data starts at byte 22: dt 0, FF 51 03, then 500000 = 07 A1 20.
  assert.deepEqual(
    Array.from(bytes.slice(22, 29)),
    [0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20],
  );
});

test("a two-note file round-trips its delta times", () => {
  // Deliberately unsorted input; writer must sort by tick.
  const bytes = writeMIDI({
    ticksPerQuarter: 480,
    events: [
      { tick: 480, type: "off", ch: 0, a: 60, b: 64 },
      { tick: 0, type: "on", ch: 0, a: 60, b: 100 },
      { tick: 960, type: "off", ch: 0, a: 64, b: 64 },
      { tick: 480, type: "on", ch: 0, a: 64, b: 100 },
    ],
  });
  let i = 22 + 7; // skip header, MTrk header, tempo meta
  const seen = [];
  while (i < bytes.length) {
    const { value, next } = readVLQ(bytes, i);
    i = next;
    const status = bytes[i];
    if (status === 0xFF) {
      seen.push({ dt: value, status, type: bytes[i + 1] });
      i += 3;
      continue;
    }
    const dataLen = (status & 0xF0) === 0xC0 ? 1 : 2;
    seen.push({ dt: value, status, a: bytes[i + 1], b: bytes[i + 2] });
    i += 1 + dataLen;
  }
  assert.equal(seen.length, 5);
  assert.deepEqual(seen[0], { dt: 0, status: 0x90, a: 60, b: 100 });
  assert.deepEqual(seen[1], { dt: 480, status: 0x80, a: 60, b: 64 });
  assert.deepEqual(seen[2], { dt: 0, status: 0x90, a: 64, b: 100 });
  assert.deepEqual(seen[3], { dt: 480, status: 0x80, a: 64, b: 64 });
  assert.deepEqual(seen[4], { dt: 0, status: 0xFF, type: 0x2F });
});

test("cc and prog events carry the right status and byte counts", () => {
  const bytes = writeMIDI({
    events: [
      { tick: 0, type: "prog", ch: 2, a: 5 },
      { tick: 0, type: "cc", ch: 2, a: 7, b: 90 },
    ],
  });
  const data = Array.from(bytes.slice(22 + 7, bytes.length - 4));
  // Stable sort keeps input order at equal ticks: prog then cc.
  assert.deepEqual(data, [0x00, 0xC2, 0x05, 0x00, 0xB2, 0x07, 0x5A]);
});
