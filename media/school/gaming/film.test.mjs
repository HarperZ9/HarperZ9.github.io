// The gaming film's scene, checked in Node: every frame evaluates, the answers-right curve waits for
// the held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, S = F.start200, pc = (v) => `${Math.round(v * 100)}%`;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the answers-right result waits for the held question", () => {
  const s = `answers right at the end: ${pc(S.gamed.end.correct.mean)}`;
  assert.ok(!has(T.gamed.ask.held - 0.3, s) && has(T.gamed.ask.held + 3.5, s));
});

test("the scores on screen are facts values", () => {
  assert.ok(has(T.task.decoy + 1, `${pc(F.task.decoyShare)} of questions`) && has(T.task.begin + 1, `right at the start: ${pc(F.task.startCorrect.step200)}`));
  assert.ok(has(T.gamed.points + 1, `points at the end: ${(S.gamed.end.reward.mean * 100).toFixed(1)}%`) && has(T.gamed.first + 1, `first name right: ${pc(S.gamed.end.firstRight.mean)}`));
  assert.ok(has(T.patch.fixed + 3.5, `answers right at the end: ${pc(S.fixed.end.correct.mean)}`) && has(T.trained.drift + 1, `${(F.start2000.patched.end.correct.min * 100).toFixed(1)}%`));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${Math.round(F.task.decoyShare * 100)} percent`) && film.includes(`${Math.round(F.start2000.patched.end.correct.min * 100)} percent`));
});
