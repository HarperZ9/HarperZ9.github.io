// The data film's scene, checked in Node: every frame evaluates, scores wait for the held
// questions, every share and score on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, pct = (v) => `${Math.round(v * 100)}%`, lb = (n) => F.lookback.runs.find((r) => r.name === n).summary;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("scores wait for the held questions", () => {
  assert.ok(T.less.r40 >= T.less.ask.held - 0.01 && !has(T.less.ask.held - 0.3, `${pct(lb("lb05").copyAccuracy)} right`));
  assert.ok(has(T.less.r05 + 1, `${pct(lb("lb05").copyAccuracy)} right`) && has(T.less.loss + 1, `none: held-out loss ${lb("lb0").heldOut.toFixed(2)}`));
  assert.ok(!has(T.repeat.ask.held - 0.3, "held-out 3.02") && has(T.repeat.ask.held + 1, `${F.duplication.runs[0].rows} rows: held-out ${F.duplication.runs[0].summary.heldOut.toFixed(2)}`));
});

test("the transfer, noise and shift numbers are facts values", () => {
  assert.ok(has(T.transfer.copy + 1, `${pct(F.shift.noCopyEpisodes.copyOnly.lookback)} right`));
  const n = F.labelNoise.runs[0];
  assert.ok(has(T.noise.split + 1, `copy episodes ${pct(n.split.copyEpisodes.accuracy)}, who questions ${pct(n.split.whoEpisodes.accuracy)}`));
  assert.ok(has(T.shift.rerun + 1, `${pct(F.shift.rerunNeverDoes.whoRerunDoes.guideAnswer)} named`));
});

test("the script has no unfilled token", () => {
  assert.ok(!/\{\{/.test(readFileSync(new URL("film.json", here), "utf8")));
});
