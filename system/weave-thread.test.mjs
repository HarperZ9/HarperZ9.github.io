// Node-only contracts for the thread sprites behind the Loom cloth. The pixel
// recipe is pure, so the browser tiles and these checks share one function.
import test from "node:test";
import assert from "node:assert/strict";
import {
  hexToRgb, threadShade, threadTilePixels, tilePitch, diveAlpha, diveSpritePixels, lusterPixels,
} from "./weave-thread.js";

test("hex colours parse to channels with or without the hash", () => {
  assert.deepEqual(hexToRgb("#e8e2d4"), [232, 226, 212]);
  assert.deepEqual(hexToRgb("14131a"), [20, 19, 26]);
});

test("the profile is brightest near the crest, and the lit edge beats the shadow edge", () => {
  const left = threadShade(-1), right = threadShade(1), crest = threadShade(-0.3);
  assert.ok(crest.diffuse > left.diffuse && crest.diffuse > right.diffuse);
  assert.ok(left.diffuse > right.diffuse, "light comes from the left");
  assert.ok(crest.spec > threadShade(0.9).spec, "the gleam sits on the crest");
});

test("a tile spans the thread width across and one twist pitch along, in both orientations", () => {
  for (const t of [3, 6, 10, 14]) {
    const v = threadTilePixels([200, 180, 160], t, true), hz = threadTilePixels([200, 180, 160], t, false);
    assert.equal(v.w, t); assert.equal(v.h, tilePitch(t));
    assert.equal(hz.w, tilePitch(t)); assert.equal(hz.h, t);
    assert.equal(v.data.length, v.w * v.h * 4);
    for (let i = 3; i < v.data.length; i += 4) assert.equal(v.data[i], 255);
  }
});

test("across a vertical tile the mean column brightness peaks off-centre toward the light", () => {
  const t = 12, px = threadTilePixels([220, 220, 220], t, true);
  const col = (x) => { let s = 0; for (let y = 0; y < px.h; y++) s += px.data[(y * px.w + x) * 4]; return s / px.h; };
  const cols = Array.from({ length: t }, (_, x) => col(x));
  const peak = cols.indexOf(Math.max(...cols));
  assert.ok(peak >= 2 && peak <= 5, "peak column " + peak);
  assert.ok(cols[0] > cols[t - 1], "the far edge is the shadow side");
});

test("hairline threads carry no twist texture and wide threads do", () => {
  const flat = threadTilePixels([200, 200, 200], 3, true);
  for (let y = 1; y < flat.h; y++) for (let x = 0; x < flat.w; x++) {
    assert.equal(flat.data[(y * flat.w + x) * 4], flat.data[x * 4]);
  }
  const wide = threadTilePixels([200, 200, 200], 12, true);
  let differs = false;
  for (let x = 0; x < wide.w && !differs; x++) {
    const first = wide.data[x * 4];
    for (let y = 1; y < wide.h && !differs; y++) {
      if (wide.data[(y * wide.w + x) * 4] !== first) differs = true;
    }
  }
  assert.ok(differs, "a wide tile varies along its length");
});

test("dive shadows fall off monotonically and the end sprite mirrors the start", () => {
  let prev = 1;
  for (let i = 0; i <= 8; i++) { const a = diveAlpha(i, 8); assert.ok(a <= prev); prev = a; }
  assert.equal(diveAlpha(8, 8), 0);
  const s = diveSpritePixels(6, 4, true, false), e = diveSpritePixels(6, 4, true, true);
  assert.ok(s.data[3] > 0);
  assert.equal(s.data[3], e.data[(3 * 6) * 4 + 3]);
  assert.ok(s.data[3] > s.data[(3 * 6) * 4 + 3]);
});

test("luster peaks at mid-span and vanishes at the float ends", () => {
  const L = lusterPixels(6, 32, true, 0.3);
  const a = (row) => L.data[(row * 6 + 3) * 4 + 3];
  assert.equal(a(0), 0); assert.equal(a(31), 0);
  assert.ok(a(16) > a(8) && a(8) > 0);
});

test("tiles are deterministic", () => {
  const a = threadTilePixels([120, 60, 30], 9, false), b = threadTilePixels([120, 60, 30], 9, false);
  assert.deepEqual(Array.from(a.data), Array.from(b.data));
});
