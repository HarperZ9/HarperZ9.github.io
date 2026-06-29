import { test } from "node:test";
import assert from "node:assert/strict";

import { TRANSFORM_GROUPS, isEffectKey, runEffect } from "./studio-effects.js";

globalThis.ImageData = class ImageData {
  constructor(dataOrWidth, width, height) {
    if (typeof dataOrWidth === "number") {
      this.width = dataOrWidth;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width;
      this.height = height;
    }
  }
};

function image(width, height, pixels) {
  return new ImageData(new Uint8ClampedArray(pixels), width, height);
}

test("effect catalog exposes grouped creative capabilities", () => {
  const keys = TRANSFORM_GROUPS.flatMap((g) => g.items.map(([key]) => key));
  for (const key of ["dither", "halftone", "pixelSort", "chromatic", "glitch", "scanlines", "duotone"]) {
    assert.ok(keys.includes(key), `${key} should be menuized`);
    assert.equal(isEffectKey(key), true);
  }
});

test("pixel sort is deterministic and preserves alpha", () => {
  const img = image(3, 1, [
    250, 250, 250, 255,
    10, 10, 10, 128,
    120, 120, 120, 64,
  ]);
  const out = runEffect(img, "pixelSort");
  assert.deepEqual([...out.data], [
    10, 10, 10, 128,
    120, 120, 120, 64,
    250, 250, 250, 255,
  ]);
});

test("chromatic aberration shifts red and blue channels in opposite directions", () => {
  const img = image(7, 1, [
    10, 0, 1, 255,
    20, 0, 2, 255,
    30, 0, 3, 255,
    40, 0, 4, 255,
    50, 0, 5, 255,
    60, 0, 6, 255,
    70, 0, 7, 255,
  ]);
  const out = runEffect(img, "chromatic");
  const mid = 3 * 4;
  assert.equal(out.data[mid], 10);
  assert.equal(out.data[mid + 2], 7);
  assert.equal(out.data[mid + 3], 255);
});

test("ordered dither produces a binary print surface", () => {
  const img = image(2, 2, [
    0, 0, 0, 255,
    80, 80, 80, 255,
    180, 180, 180, 255,
    255, 255, 255, 255,
  ]);
  const out = runEffect(img, "dither");
  for (let i = 0; i < out.data.length; i += 4) {
    assert.ok(out.data[i] === 0 || out.data[i] === 255);
    assert.equal(out.data[i], out.data[i + 1]);
    assert.equal(out.data[i], out.data[i + 2]);
  }
});
