// plot-image-studies.test.mjs — the eight image methods and the fidelity judge.
// Run: node --test system/plot-image-studies.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_METHODS, composeFromImage, measureTone, prepareImage } from "./plot-image-studies.js";

// A synthetic portrait stand-in: a dark disc on a light ground with a soft edge — enough
// structure for every method to have something to say.
function discField(w = 96, h = 120) {
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const d = Math.hypot(x - w / 2, y - h * 0.45) / (w * 0.32);
      lum[y * w + x] = Math.min(1, Math.max(0.05, (d - 0.6) * 1.6 + 0.15));
    }
  }
  return { w, h, lum };
}

test("every method draws the disc, deterministically, inside the sheet", () => {
  for (const key of Object.keys(IMAGE_METHODS)) {
    const a = composeFromImage(discField(), "suite", { method: key, density: 0.7 });
    const b = composeFromImage(discField(), "suite", { method: key, density: 0.7 });
    assert.equal(a.meta.strokes, b.meta.strokes, `${key}: same picture, same seed, same drawing`);
    assert.ok(a.meta.strokes > 0, `${key}: drew something`);
    assert.equal(a.meta.method, key, `${key}: honoured`);
    for (const layer of a.layers) {
      for (const line of layer.polylines) {
        for (const [x, y] of line) {
          assert.ok(x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9, `${key}: stays on the sheet`);
        }
      }
    }
  }
});

test("the drawing carries the picture: tone correlation is high for real methods", () => {
  for (const key of ["flowline", "engrave", "stipple", "squiggle"]) {
    const s = composeFromImage(discField(), "tone", { method: key, density: 1 });
    assert.ok(s.meta.tone.r > 0.5, `${key}: ink lands where the picture is dark (r ${s.meta.tone.r})`);
  }
});

test("the judge is not a rubber stamp: scrambled ink scores near zero", () => {
  const ctx = prepareImage(discField());
  // A fake layer that spreads uniform ink everywhere: no relationship to the disc.
  const uniform = [];
  for (let i = 0; i < 40; i += 1) {
    const t = ctx.rect.y + (i / 40) * ctx.rect.h;
    uniform.push([[ctx.rect.x, t], [ctx.rect.x + ctx.rect.w, t]]);
  }
  const m = measureTone([{ name: "u", polylines: uniform, weight: 1, tone: "ink" }], ctx.field, ctx.rect);
  assert.ok(Math.abs(m.r) < 0.3, `uniform ink correlates with nothing (r ${m.r})`);
  // And an empty sheet is 0, not 1: undefined correlation must not read as perfect.
  const empty = measureTone([], ctx.field, ctx.rect);
  assert.equal(empty.r, 0, "no ink, no claim");
});

test("auto picks by measurement and reports what it considered", () => {
  const s = composeFromImage(discField(), "auto-pick", { density: 0.8, candidates: 3 });
  assert.equal(s.meta.chosen, "measured");
  assert.equal(s.meta.considered.length, 3, "three candidates drawn and measured");
  const rs = s.meta.considered.map((c) => parseFloat(c.split(" ")[1]));
  assert.ok(Math.max(...rs) === s.meta.tone.r, "the winner IS the best-measured, not a preference");
});

test("the sheet takes the picture's aspect and the register applies", () => {
  const s = composeFromImage(discField(96, 120), "aspect", { method: "flowline", register: "clean" });
  assert.ok(Math.abs(s.meta.aspect - 120 / 96) < 1e-6, "portrait picture, portrait paper");
  assert.equal(s.meta.register, "clean");
  assert.ok(s.layers.some((l) => l.name === "frame"), "the plate mark is present");
});

test("one path really is one path", () => {
  const s = composeFromImage(discField(), "single", { method: "tsp", density: 0.5 });
  const tour = s.layers.find((l) => l.name.includes("tour"));
  assert.ok(tour, "tour layer exists");
  // clean register keeps single-pass; the clip may split at the margin but the drawing should
  // remain a handful of long runs, not thousands of fragments.
  const s2 = composeFromImage(discField(), "single", { method: "tsp", register: "clean", density: 0.5 });
  const t2 = s2.layers.find((l) => l.name.includes("tour"));
  assert.ok(t2.polylines.length <= 4, `zero-pen-lift gesture survives (got ${t2.polylines.length} runs)`);
  const pts = t2.polylines.reduce((a, l) => a + l.length, 0);
  assert.ok(pts > 500, `and it is a real tour (${pts} points)`);
});
