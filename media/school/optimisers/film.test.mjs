// The optimisers film's scene, checked in Node: every frame evaluates, the walkers run at load
// reproduce the races facts.json records, the race waits for the held question, numbers on screen
// are facts values, and the script has no unfilled token.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import scene from "./film.scene.mjs";
import { sceneContext, loadScene, evaluate } from "../../raw-native/tree-ada041f/web/motion/scene.mjs";
import { LABELS } from "../shared/lib.mjs";

const here = new URL("./", import.meta.url);
const fetcher = async (u) => { const p = fileURLToPath(u); return { ok: true, json: async () => JSON.parse(readFileSync(p, "utf8")) }; };
const ctx = sceneContext(scene, { baseUrl: new URL("film.scene.mjs", here).href, fetcher });
await loadScene(scene, ctx);
const F = JSON.parse(readFileSync(new URL("facts.json", here), "utf8"));
const T = ctx.assets.T, R = ctx.assets.runs;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the walkers drawn are the races facts.json records", () => {
  for (const n of ["sgd", "momentum", "adam"]) {
    assert.equal(R.rosen[n].stepsToThreshold, F.races.rosenbrock.entrants[n].stepsToThreshold, `rosenbrock ${n}`);
    assert.equal(R.bowl[n].stepsToThreshold, F.races.bowl.entrants[n].stepsToThreshold, `bowl ${n}`);
  }
  assert.equal(R.edge.sgd.diverged, true);
  assert.equal(R.edge.momentum.stepsToThreshold, F.aboveEdge.runs.momentum.stepsToThreshold);
  assert.equal(R.edge.adam.stepsToThreshold, F.aboveEdge.runs.adam.stepsToThreshold);
});

test("the race waits for the held question; finishes show facts values", () => {
  assert.ok(T.race.reveal >= T.race.ask.held - 0.01);
  assert.ok(has(T.race.ask.held - 0.3, "update 0"));
  const E = F.races.rosenbrock.entrants;
  assert.ok(has(T.race.bowl - 0.5, `down to stay at ${E.adam.stepsToThreshold.toLocaleString("en")}`) && has(T.race.bowl - 0.5, `down to stay at ${E.momentum.stepsToThreshold}`));
  assert.ok(has(T.real.first400 + 2, `AdamW: ${F.transformer.arms.adamw.finalHeldOut.toFixed(2)}`));
});

test("the script carries no unfilled token, and the bowl's other two tie as it says", () => {
  const film = readFileSync(new URL("film.json", here), "utf8"), B = F.races.bowl.entrants;
  assert.ok(!/\{\{/.test(film));
  assert.equal(B.momentum.stepsToThreshold, B.adam.stepsToThreshold, "\"146 for the other two\" needs both to be equal");
});
