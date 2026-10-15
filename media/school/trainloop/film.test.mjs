// The training-loop film's scene, checked in Node: every frame evaluates, the copy curve waits for
// the held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, pct = (v) => `${Math.round(v * 100)}%`;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the copy rate waits for the held question; the run's numbers are the facts'", () => {
  assert.ok(!has(T.run.ask.held - 0.3, "copies ") && has(T.run.ask.held + 1, "copies "));
  assert.ok(has(T.run.same + 1, `${F.reproduce.tensorsEqual} of ${F.reproduce.tensorsTotal} tables equal`) && F.reproduce.tensorsEqual === F.reproduce.tensorsTotal);
  assert.ok(has(T.settings.fired + 1, `clipped on ${F.gradients.stats.clipped} of`));
});

test("variants and controls on screen are facts values", () => {
  const R = (n) => F.variants.runs.find((r) => r.name === n).summary;
  assert.ok(has(T.change.high + 1, `${R("lrHigh").heldOut.toFixed(2)}, copies ${pct(R("lrHigh").copyAccuracy)}`));
  assert.ok(has(T.change.batch2 + 1, `${R("batch4Tokens").heldOut.toFixed(2)}`));
  assert.ok(has(T.broken.up + 3, `climbs to ${F.controls.runs[1].summary.heldOut.toFixed(1)}`));
});

test("the script has no unfilled token and says five steps", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes("Five steps"));
});
