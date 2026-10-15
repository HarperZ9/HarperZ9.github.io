// The backpropagation film's scene, checked in Node: every frame evaluates, cues run in order, the
// walk back waits for the held question, numbers on screen are facts.json values, and the script
// has no unfilled token; the magnitudes spoken in words match the measured values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import scene from "./film.scene.mjs";
import { sceneContext, loadScene, evaluate } from "../../raw-native/tree-c6b114d/web/motion/scene.mjs";
import { LABELS } from "../shared/lib.mjs";

const here = new URL("./", import.meta.url);
const fetcher = async (u) => { const p = fileURLToPath(u); return { ok: true, json: async () => JSON.parse(readFileSync(p, "utf8")) }; };
const ctx = sceneContext(scene, { baseUrl: new URL("film.scene.mjs", here).href, fetcher });
await loadScene(scene, ctx);
const F = JSON.parse(readFileSync(new URL("facts.json", here), "utf8"));
const T = ctx.assets.T;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("segments run in order; the walk back waits for the held question", () => {
  const ends = ["title", "network", "nudge", "back", "cost", "check", "learn", "big"].map((k) => T[k].end);
  for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1], `segment ${i} ends before ${i - 1}`);
  assert.ok(T.back.last >= T.back.ask.held - 0.01);
  assert.ok(!has(T.back.ask.held - 0.3, "each ring") && has(T.back.last + 1, "each ring"));
});

test("numbers on screen are facts.json values", () => {
  const c = F.cost, tr = F.training;
  assert.ok(has(T.cost.not + 2, `forward: ${c.forward} multiply-adds`) && has(T.cost.not + 2, `backward: ${c.backward} (${c.ratio.toFixed(2)} x forward)`));
  assert.ok(has(T.cost.not + 2, `${F.net.nParams} x ${c.forward} = ${(F.net.nParams * c.forward).toLocaleString("en")}`));
  assert.ok(has(T.learn.acc + 1, `${(tr.finalHeldAccuracy * 100).toFixed(1)}% after ${tr.steps.toLocaleString("en")}`));
  assert.ok(has(T.big.full + 1, `worst of ${F.attention.entries}`));
  assert.ok(has(T.network.numbers + 2, `${F.net.nParams} numbers`));
});

test("the script has no unfilled token, and its spoken magnitudes match the measurements", () => {
  const film = readFileSync(new URL("film.json", here), "utf8"), gc = F.gradientCheck.afterTraining;
  assert.ok(!/\{\{/.test(film));
  // "about one part in a billion" (worst layer), "about three parts in a hundred million" (worst entry),
  // "a few parts in ten million" (the transformer, float64).
  assert.ok(gc.worst > 3e-10 && gc.worst < 3e-9, `worst layer ${gc.worst}`);
  assert.ok(gc.worstEntry > 2.5e-8 && gc.worstEntry < 4e-8, `worst entry ${gc.worstEntry}`);
  assert.ok(F.attention.float64Worst.relErr > 1e-7 && F.attention.float64Worst.relErr < 9e-7);
  assert.ok(film.includes("one part in a billion") && film.includes("three parts in a hundred million") && film.includes("a few parts in ten million"));
});
