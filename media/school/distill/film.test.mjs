// The distillation film's scene, checked in Node: every frame evaluates, the soft-target bars wait
// for each held question, every number on screen is a facts value, and the script has no unfilled
// token.
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
const T = ctx.assets.T, R = F.fullData.arms, L = F.lowData;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the teacher's bars wait for each held question", () => {
  const soft = R.soft2.heldOut.mean.toFixed(2), pool = L.pool32.soft2.heldOut.mean.toFixed(2);
  assert.ok(!has(T.plenty.ask.held - 0.3, soft) && has(T.plenty.ask.held + 2, soft));
  assert.ok(!has(T.little.ask.held - 0.3, pool) && has(T.little.ask.held + 2, pool));
});

test("the losses, shares and counts on screen are facts values", () => {
  assert.ok(has(T.plenty.hard + 1, R.hard.heldOut.mean.toFixed(2)) && has(T.plenty.agree + 1, `${Math.round(R.soft2.agreement.mean * 100)}%`));
  assert.ok(has(T.little.hard + 2, L.pool32.hard.heldOut.mean.toFixed(2)) && has(T.little.mid + 3, L.pool256.soft2.heldOut.mean.toFixed(2)));
  assert.ok(has(T.wrong.argmax + 1.5, R.argmax.heldOut.mean.toFixed(2)) && has(T.wrong.counts + 1, F.controls.unigramLoss.toFixed(2)));
  assert.ok(has(T.labels.torn + 1, `${Math.round(F.darkKnowledge.torn * 100)}%`) && has(T.temperature.sizes + 1.5, F.teacher.nParams.toLocaleString("en")));
  assert.ok(has(T.little.pool + 1, `${L.pool.small} rows of ${L.pool.words} words`));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(R.hard.heldOut.mean.toFixed(2)) && film.includes(L.pool32.soft2.heldOut.mean.toFixed(2)));
});
