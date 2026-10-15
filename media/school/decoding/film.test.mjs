// The decoding film's scene, checked in Node: every frame evaluates, rates wait for the held
// question, the runs on screen are the fill's recorded runs, every rate shown is a facts value, and
// the script has no unfilled token.
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
const T = ctx.assets.T, S = F.prompts.find((p) => p.key === "open").settings, pct = (v) => `${Math.round(v * 100)}%`;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the temperature rates wait for the held question; the cold limit is the facts'", () => {
  assert.ok(T.temperature.rates >= T.temperature.ask.held - 0.01 && !has(T.temperature.ask.held - 0.3, "% follow the rules"));
  assert.ok(has(T.temperature.rows[3] + 1, `${pct(S.t2.grammatical)} follow the rules`));
  assert.ok(has(T.temperature.zero + 3, `${F.prompts[2].nearZeroTemperature.n} spins at 0.01: ${F.prompts[2].nearZeroTemperature.n} were the greedy run`));
});

test("the runs on screen are recorded runs, and the rates are facts values", () => {
  const greedy = ["pylon", ...S.greedy.examples[0].split(" ")].slice(0, 6);
  assert.ok(greedy.every((w) => has(T.greedy.run + 6, w)));
  assert.ok(has(T.sample.tally + 1, `${S.t1.distinctTexts.toLocaleString("en")} different texts, ${pct(S.t1.grammatical)} follow the rules`));
  assert.ok(has(T.topp.few + 1, `${S["p0.5"].distinctTexts.toLocaleString("en")} different texts`));
  assert.ok(has(T.tail.top + 1, `follow the rules ${pct(S.t1.grammatical)} to ${pct(S["p0.9"].grammatical)}`) && has(T.tail.small + 1, `${pct(S.t1.unseenPair)} of runs hold a word pair`));
});

test("the script has no unfilled token", () => {
  assert.ok(!/\{\{/.test(readFileSync(new URL("film.json", here), "utf8")));
});
