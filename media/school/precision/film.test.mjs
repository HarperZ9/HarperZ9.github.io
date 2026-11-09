// The precision film's scene, checked in Node: every frame evaluates, the fp16 ticks wait for the held
// question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, N = F.near110;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the fp16 ticks and the worst move wait for the held question", () => {
  const s = `off by up to ${N.absolute.fp16WorstMove}`;
  assert.ok(T.near.fp >= T.near.ask.held - 0.01 && !has(T.near.ask.held - 0.3, s) && has(T.near.worst + 1, s));
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.stuck.stops + 1, `fp16 stops at ${F.stagnation.rows[0].stuckAt.toLocaleString("en")}`) && has(T.stuck.bfStop + 1, `bf16 stops at ${F.stagnation.rows[1].stuckAt}`));
  assert.ok(has(T.jugs.bits + 2, `${F.formats.rows[0].p} bits of significand`) && has(T.model.loss + 4, F.film.lossBars.at(-1).value.toFixed(4)));
  assert.ok(has(T.cores.bars + 4, F.matmul.rows[1].modes[2].total.relNorm.toExponential(1)));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${N.fp16.spacing} apart`) && film.includes(F.stagnation.rows[0].stuckAt.toLocaleString("en")));
});
