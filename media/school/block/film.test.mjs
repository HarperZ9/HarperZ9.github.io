// The block film's scene, checked in Node: every frame evaluates, the readouts wait for the held
// question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, pct = (v) => `${Math.round(v * 100)}%`, row = (n) => F.ablations.trained.rows.find((r) => r.name === n && r.mode === "zero");
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the readouts wait for the held question and are the facts'", () => {
  assert.ok(T.climb.l0 >= T.climb.ask.held - 0.01 && !has(T.climb.ask.held - 0.3, "loss 2.33"));
  F.lens.trained.forEach((l) => assert.ok(has(T.climb.l2 + 1, `loss ${l.loss.toFixed(2)}`)));
  F.lens.trained.forEach((l) => assert.ok(has(T.climb.copy + 1, `copies ${pct(l.copyAccuracy)}`)));
});

test("knockout and residual numbers are facts values", () => {
  assert.ok(has(T.knockout.h1 + 1, `top floor, head 2 off: copies ${pct(row("l1.h1").copyAccuracy)}`));
  assert.ok(has(T.knockout.low + 1, `first floor, head 2 off: copies ${pct(row("l0.h1").copyAccuracy)}`));
  assert.ok(has(T.knockout.mlp + 1, `first floor MLP off: loss ${row("l0.mlp").loss.toFixed(2)}`) && row("l0.mlp").loss > Math.log(F.params.config.vocab));
  assert.ok(T.residual.top >= T.residual.ask.held - 0.01 && has(T.residual.top + 1, `loss ${F.residual.trained.rows[2].loss.toFixed(2)}`));
});

test("the script has no unfilled token", () => {
  assert.ok(!/\{\{/.test(readFileSync(new URL("film.json", here), "utf8")));
});
