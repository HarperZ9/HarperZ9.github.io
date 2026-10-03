// node --test system/retro-crt.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { crtStage } from "./retro-crt.js";

function fakeCtx(w, h, v) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255; }
  const img = { data, width: w, height: h };
  return { img, getImageData: () => img, putImageData: () => {} };
}

// Found while porting the tube to the GPU (3 October 2026): with scanlines off and a phosphor mask
// on, phosphorPass indexed a 16-entry flat table at bucket * cell + row, read past its end, and
// wrote 0 for most of the frame. A mid-grey frame through the grille must stay lit.
test("scanlines off with a mask keeps the frame lit", () => {
  const w = 48, h = 24, ctx = fakeCtx(w, h, 200);
  crtStage(ctx, w, h, { cell: 4, scanlines: false, mask: "grille", maskStrength: 0.3 });
  let black = 0;
  for (let i = 0; i < ctx.img.data.length; i += 4) if (ctx.img.data[i] + ctx.img.data[i + 1] + ctx.img.data[i + 2] === 0) black++;
  assert.equal(black, 0);
});

test("the same frame with scanlines on is still shaped by the beam", () => {
  const w = 48, h = 24, ctx = fakeCtx(w, h, 200);
  crtStage(ctx, w, h, { cell: 4, scanlines: true, scanStrength: 0.35, beam: 0.5, mask: "none" });
  const row = (y) => ctx.img.data[(y * w) * 4 + 1];
  assert.notEqual(row(0), row(2));
});
