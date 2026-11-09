// The error-bars film's scene, checked in Node: every frame evaluates, the narrower intervals wait
// for the held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, W = F.widths.at, R = F.coverage.runs;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the narrower intervals wait for the held question", () => {
  const w = `width ${W["1024"].loss.rowPct.width.toFixed(4)}`;
  assert.ok(!has(T.bootstrap.ask.held - 0.3, w) && has(T.shrink.start + 5, w));
});

test("the intervals, coverage and differences on screen are facts values", () => {
  const I = F.film.bootstrap64.rowInterval;
  assert.ok(has(T.one.score + 1.5, `loss ${F.items.loss.toFixed(4)} on 1,024 rows`) && has(T.bootstrap.interval + 1, `middle 95%: ${I.lo.toFixed(4)} to ${I.hi.toFixed(4)}`));
  assert.ok(I.lo === W["64"].loss.rowPct.lo && I.hi === W["64"].loss.rowPct.hi);
  assert.ok(has(T.truth.answer + 1, `${(R.rows64.rowPct.coverage * 100).toFixed(1)}% hold it`) && has(T.truth.truth + 1, `the truth: ${F.coverage.truth.toFixed(4)}`));
  assert.ok(has(T.unit.naive + 1, `${(R.rows16x4.rowPct.coverage * 100).toFixed(1)}%`) && has(T.unit.distinct + 1, `${(R.rows16x4.clusterPct.coverage * 100).toFixed(1)}%`));
  assert.ok(has(T.paired.unpaired + 4, `each on its own: ${F.paired.at1024.unpairedPct.lo.toFixed(4)}`) && has(T.seeds.diffs + 1, F.seeds.difference.values.map((v) => v.toFixed(4)).join(", ")));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(F.coverage.truth.toFixed(4)) && film.includes(`${(R.rows64.rowPct.coverage * 100).toFixed(1)} percent`));
});
