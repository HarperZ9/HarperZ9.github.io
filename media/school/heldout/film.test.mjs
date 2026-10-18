// The held-out film's scene, checked in Node: every frame evaluates, cues run in order, the answer
// waits for the held question, numbers on screen are facts.json values, the spoken magnitude in
// words matches the measured one, and the script has no unfilled token.
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
const T = ctx.assets.T;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("segments run in order; the held-out errors wait for the held question", () => {
  const ends = ["title", "pts", "held", "leash", "spiral", "spread", "model", "rules"].map((k) => T[k].end);
  for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1], `segment ${i} ends before ${i - 1}`);
  assert.ok(T.held.errs >= T.pts.ask.held - 0.01);
  assert.ok(!has(T.pts.ask.held - 0.3, "held-out points"));
});

test("numbers on screen are facts.json values", () => {
  const p = F.poly, S = F.spiral, r = F.attention.rescored;
  assert.ok(has(T.held.errs + 1, `degree 3 error ${p.degrees[3].heldRmse.toFixed(2)}`) && has(T.held.wildErr + 1, `degree 15 error ${Math.round(p.degrees[15].heldRmse).toLocaleString("en")}`));
  assert.ok(has(T.leash.light + 1, `held-out error ${p.ridge.rows[4].heldRmse.toFixed(2)}`) && has(T.leash.hard + 1, `held-out error ${p.ridge.rows[6].heldRmse.toFixed(2)}`));
  assert.ok(has(T.spiral.right + 1, `${(S.small.finalHeldAccuracy * 100).toFixed(1)}% with ${S.small.nTrain} points`));
  assert.ok(has(T.spiral.lowest + 1, `lowest at update ${S.small.heldLossMinimum.step}`));
  assert.ok(has(T.model.hard + 1, `the lab's held-out set: ${r.heldOut.loss.toFixed(3)}`));
});

test("the script has no unfilled token, and 'one part in a hundred billion' matches the fit", () => {
  const film = readFileSync(new URL("film.json", here), "utf8"), e = F.poly.degrees[15].trainRmse;
  assert.ok(!/\{\{/.test(film));
  assert.ok(film.includes("one part in a hundred billion") && e > 3e-12 && e < 3e-11, `degree 15 train error ${e}`);
});
