// The embeddings film's scene, checked in Node: every frame evaluates, the cards' places are the
// facts' snapshots, the drift waits for the held question, numbers on screen are facts values, the
// hand-worded "three words fewer" matches the measured drop, and the script has no unfilled token.
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
const T = ctx.assets.T, S = F.training.snapshots;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the drift waits for the held question; the shares on screen are the snapshots'", () => {
  assert.ok(T.train.reveal >= T.train.ask.held - 0.01);
  assert.ok(!has(T.train.ask.held - 0.3, `same-kind neighbours ${Math.round(S[5].share.top1 * 100)}%`));
  assert.ok(has(T.train.end2 - 0.5, `${Math.round(S[5].fraction * 100)}% of training: same-kind neighbours ${Math.round(S[5].share.top1 * 100)}%`));
  assert.ok(has(T.train.end - 0.5, `same-kind neighbours ${Math.round(S.at(-1).share.top1 * 100)}%`));
  assert.ok(has(T.compare.overlap + 1, `${Math.round(F.comparison.overlapWithWte * 100)}% between the two; ${Math.round(F.comparison.chanceOverlap * 100)}% by chance`));
});

test("'three words fewer out of 46' matches the measured drop, and no token is left", () => {
  const film = readFileSync(new URL("film.json", here), "utf8"), drop = Math.round((S[5].share.top1 - S.at(-1).share.top1) * F.words.length);
  assert.equal(drop, 3);
  assert.ok(film.includes(`three words fewer out of ${F.words.length}`) && !/\{\{/.test(film));
});
