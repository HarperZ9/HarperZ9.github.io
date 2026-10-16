// The LoRA film's scene, checked in Node: every frame evaluates, the method bars wait for the held
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
const T = ctx.assets.T, R = F.methods.runs, pc = (v) => `${Math.round(v * 100)}%`;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the method bars wait for the held question", () => {
  const r1 = `${pc(R["lora.attn.r1"].answer.mean)}`;
  assert.ok(!textAt(T.howmany.ask.held - 0.3).includes(r1) && textAt(T.howmany.ask.held + 2).includes(r1));
});

test("the counts, shares and losses on screen are facts values", () => {
  const [K, M] = F.film.shape;
  assert.ok(has(T.rudder.count + 1, `${K} x ${M} = ${(K * M).toLocaleString("en")} numbers`) && has(T.rudder.pair + 1, `rank 1: ${K} + ${M} = ${K + M}`));
  assert.ok(has(T.full.learn + 1, `new habit: ${pc(R.full.answer.mean)} right`) && has(T.full.after + 2, `look-back words right: ${pc(R.full.origCopy.mean)}`));
  assert.ok(has(T.job.base + 1, `right ${pc(F.base.task.answer)} of the time`) && has(T.howmany.odd + 1, `${pc(R["lora.attn.r1"].repeatThing.mean)} at rank 1`));
  assert.ok(has(T.shape.random + 1, `a random change's top direction: ${pc(F.rank.randomBaseline["32x96"].top["1"])}`) && has(T.shape.cut + 1, `cut to rank 8: ${pc(F.rank.truncated[3].answer.mean)} right`));
  assert.ok(has(T.forget.rows + 3, pc(R["lora.attn.r1"].origCopy.mean)));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${Math.round(R.full.answer.mean * 100)} percent right`) && film.includes(`${Math.round(R["lora.all.r8"].answer.mean * 100)} at rank 8`));
});
