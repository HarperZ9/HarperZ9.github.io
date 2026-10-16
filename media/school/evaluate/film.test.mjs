// The evaluation film's scene, checked in Node: every frame evaluates, the cheap judge's step-200 band
// waits until after the held question (it answers it in the next segment), every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, C2 = F.checkpoints.across["200"], pc = (v) => `${Math.round(v * 100)}%`;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the cheap judge's band waits for the held question", () => {
  const s = pc(C2.fluent.mean);
  assert.ok(!has(T.curve.ask.held - 0.3, s) && T.judges.cheap > T.curve.ask.held && has(T.judges.cheap + 1.5, s));
});

test("the scores on screen are facts values", () => {
  assert.ok(has(T.curve.early + 2, `loss ${C2.loss.mean.toFixed(2)}`) && has(T.curve.early + 2, pc(C2.exact.mean)));
  assert.ok(has(T.judges.lets + 1, `accepts ${pc(F.judges.perSeed["1"]["200"].falseAccept)}`));
  assert.ok(has(T.disagree.lossOnly + 1, `${F.disagreements.counts.lossOnly} of ${F.disagreements.counts.pairs}`) && has(T.order.keeps + 1.5, `${pc(F.pairwise.pairs["1.200"].consistentDiffer)} of`));
  assert.ok(has(T.leak.many + 3, `mean gap ${F.contamination.arms["2000.32x250"].gap.loss.mean.toFixed(4)}`));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${Math.round(C2.exact.mean * 100)} percent`) && film.includes(`${F.disagreements.counts.lossOnly} of ${F.disagreements.counts.pairs}`));
});
