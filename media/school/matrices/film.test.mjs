// The matrices film's scene, checked in Node: every frame evaluates, cues run in order, the order
// game's answers wait for the held pause, the determinants and the rebuilt attention score drawn
// on screen are facts.json values, and the script has no unfilled token.
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

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("segments run in order; answers wait for the held questions", () => {
  const ends = ["title", "crane", "columns", "kinds", "order", "corner", "question", "edge"].map((k) => T[k].end);
  for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1], `segment ${i} ends before ${i - 1}`);
  assert.ok(T.order.st >= T.order.ask.held - 0.01 && T.corner.no >= T.corner.ask.held - 0.01);
  assert.ok(!textAt(T.order.ask.held - 0.3).some((s) => s.startsWith("east step lands")), "no answer during the hold");
  const after = textAt(T.order.ts + 4).filter((s) => s.startsWith("east step lands"));
  assert.deepEqual(after.sort(), [`east step lands at (${F.order.eastArrow.AB.map((v) => v.toFixed(2)).join(", ")})`, `east step lands at (${F.order.eastArrow.BA.map((v) => v.toFixed(2)).join(", ")})`].sort());
});

test("determinants and the rebuilt score on screen are facts.json values", () => {
  const dets = [T.kinds.area + 2.5, T.kinds.same + 2].flatMap((t) => textAt(t).filter((s) => s.includes("determinant")));
  assert.ok(dets.some((s) => s.endsWith(`determinant: ${F.demos[1].det.toFixed(2)}`)) && dets.some((s) => s.endsWith(`determinant: ${F.demos[2].det.toFixed(2)}`)));
  const end = textAt(T.question.same + 1);
  assert.ok(end.includes(`q . k = ${F.finale.qkRaw.toFixed(2)}`) && end.includes(`/ ${F.finale.sqrtDHead} = ${F.finale.scaled.toFixed(2)}`));
  assert.ok(Math.abs(F.finale.qkRaw / F.finale.sqrtDHead - F.finale.scaled) < 1e-3);
});

test("the script carries no unfilled token and quotes the rebuilt score", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film));
  assert.ok(film.includes(`add it up: ${F.finale.qkRaw.toFixed(2)}`));
});
