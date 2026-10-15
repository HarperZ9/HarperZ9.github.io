// The gradients film's scene, checked in Node: every frame evaluates, cues run in order, the answers
// wait for the held questions, and the numbers drawn about the surfaces and the model are
// facts.json values; the script has no unfilled token.
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

test("segments run in order; answers wait for the held questions", () => {
  const ends = ["title", "slope", "step", "valley", "valleys", "real", "one", "edge"].map((k) => T[k].end);
  for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1], `segment ${i} ends before ${i - 1}`);
  assert.ok(T.step.reveal >= T.step.ask.held - 0.01 && T.valleys.reveal >= T.valleys.ask.held - 0.01);
  assert.ok(!has(T.step.ask.held - 0.3, "over the edge") && has(T.step.reveal + 1, "over the edge"));
  assert.ok(!has(T.valleys.ask.held - 0.3, "ends at loss") && has(T.valleys.lower + 1, "ends at loss"));
});

test("numbers on screen are facts.json values", () => {
  const b = F.bowl, G = F.gradientNorm, L = F.landscape.trained, o = F.oneNumber;
  assert.ok(has(T.step.edge + 1, `edge = 2 / ${b.curvatures[0]} = ${b.predictedBound}`));
  assert.ok(has(T.step.twice + 3, `${b.runs[3].finalLoss.toExponential(2)}`));
  assert.ok(has(T.real.after + 2, `before training: ${G.init.rows256.norm.toFixed(2)}`) && has(T.real.after + 2, `after training: ${G.trained.rows256.norm.toFixed(2)}`));
  assert.ok(has(T.real.values + 1, `${L.center.toFixed(2)}`) && has(T.real.values + 1, `${L.max.toFixed(2)}`));
  assert.ok(has(T.one.bottom + 1, `lowest at ${o.sStar.toFixed(2)}`) && has(T.one.big + 5, `ends at ${o.descents[2].end.toFixed(2)}`));
  const tv = F.twoValleys.runs.find((r) => r.start[0] === 0.3);
  assert.ok(has(T.valleys.lower + 1, `right start ends at loss ${tv.f.toFixed(2)}`));
});

test("the script carries no unfilled token and quotes the measured edge and norms", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film));
  assert.ok(film.includes(`That edge is ${F.bowl.predictedBound}`) && film.includes(`it is ${F.gradientNorm.trained.rows256.norm.toFixed(2)}`));
});
