// The edit-distance film's scene, checked in Node: every frame evaluates, the thirteen-character count
// waits for the held question, every number on screen is a facts value, and the script has no unfilled
// token.
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
const T = ctx.assets.T, N = F.naive.rows.at(-1);
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the thirteen-character count waits for the held question", () => {
  const s = N.calls.toLocaleString("en");
  assert.ok(T.explode.start >= T.naive.ask.held - 0.01 && !has(T.naive.ask.held - 0.3, s) && has(T.explode.start + 1.5, s));
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.naive.kitten + 1, F.pairs.rows[0].naiveCallsRun.toLocaleString("en")) && has(T.naive.intention + 1, F.pairs.rows[1].naiveCallsRun.toLocaleString("en")));
  assert.ok(has(T.table.corner + 1, `${F.pairs.rows[0].cells} squares`) && has(T.explode.cells + 1.5, String(N.cells)));
  assert.ok(has(T.greedy.wrong + 2, `too high on ${F.controls.random.greedyAbove} of ${F.controls.random.pairs}`) && has(T.problem.edits + 1, `edit distance: ${F.pairs.rows[0].distance}`));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(N.calls.toLocaleString("en")) && film.includes(F.pairs.rows[0].naiveCallsRun.toLocaleString("en")));
});
