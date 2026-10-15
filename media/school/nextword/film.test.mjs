// The next-word film's scene, checked in Node: every frame evaluates, the answer to each held
// question waits for its hold, the wheel's shares and every number on screen are facts values, and
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
const T = ctx.assets.T, H = F.held.scores;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("answers wait for the held questions", () => {
  assert.ok(T.surprise.zero >= T.surprise.ask.held - 0.01 && !has(T.surprise.ask.held - 0.3, "share 100%: surprise 0"));
  assert.ok(has(T.surprise.zero + 1, "share 100%: surprise 0"));
  assert.ok(T.floor.start >= T.scores.ask.held - 0.01);
});

test("numbers on screen are facts values", () => {
  const W = F.worked, R0 = F.torn.rows[0];
  assert.ok(has(T.guess.cut + 4, `after "pylon": ${R0.model[0].word} ${Math.round(R0.model[0].p * 100)}%`));
  assert.ok(has(T.surprise.loss + 1, `share ${Math.round(W.probs[0] * 100)}%: surprise ${W.loss.toFixed(2)}`));
  assert.ok(has(T.surprise.check + 1, "checked against nudges: agrees; without the minus one: fails") && W.passes && W.controlFails);
  assert.ok(has(T.torn.knock + 1, `the model, ${F.torn.rows[2].modelBetween.toFixed(2)}`) && has(T.torn.found + 1, `the model, ${F.torn.rows[1].modelBetween.toFixed(2)}`));
  assert.ok(has(T.scores.rows[4] + 1, `torn between ${H.trained.all.perplexity.toFixed(2)}`) && has(T.scores.copy + 1, `copy positions: ${H.bigram.copy.perplexity.toFixed(2)}`));
  assert.ok(has(T.floor.left + 1, `left above the floor: ${F.held.excessOverGenerator.all.toFixed(2)}`));
});

test("the script has no unfilled token and says the held-out sentences are not new", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes("the sentences in them are not"));
});
