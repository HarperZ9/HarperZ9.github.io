// The search film's scene, checked in Node: every frame evaluates, the halving bound waits for the held
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
const T = ctx.assets.T, B = F.search.binary[13], n = (v) => Math.round(v).toLocaleString("en");
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the halving bound waits for the held question", () => {
  const s = `at most ${B.bound} knocks`;
  assert.ok(T.binary.bound >= T.binary.ask.held - 0.01 && !has(T.binary.ask.held - 0.3, s) && has(T.binary.bound + 1, s));
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.linear.avg + 1, n(F.search.linear[13].successful.mean)) && has(T.linear.missing + 1, n(F.search.linear[13].missing)));
  assert.ok(has(T.insertion.jumbled + 1, n(F.sorting.rows[13].insertion.comparisons.mean)) && has(T.insertion.reversed + 1, n(F.sorting.rows[41].insertion.comparisons.mean)));
  assert.ok(has(T.merge.count + 1, n(F.sorting.rows[13].merge.comparisons.mean)) && has(T.order.jumbled + 1, n(F.controls.unsortedBinary.rows[13].wrong)));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`at most ${B.bound} knocks`) && film.includes(n(F.sorting.rows[13].merge.comparisons.mean)));
});
