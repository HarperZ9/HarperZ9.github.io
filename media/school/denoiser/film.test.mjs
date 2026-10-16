// The denoiser film's scene, checked in Node: every frame evaluates, the tensor-core reading waits for
// the held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, P = F.primary;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the tensor-core reading waits for the held question", () => {
  const s = P.rtx.coop.max_abs.toFixed(4);
  assert.ok(T.parity.coop >= T.parity.ask.held - 0.01 && !has(T.parity.ask.held - 0.3, s) && has(T.parity.coop + 2.5, s));
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.parity.read + 2, P.rtx.scalar.max_abs.toFixed(4)));
  assert.ok(has(T.reproduce.split + 3, P.emulation.A.max_abs.toFixed(4)) && has(T.reproduce.split + 3, P.emulation.W.max_abs.toFixed(4)));
  assert.ok(has(T.fixes.six + 1.5, P.mixed["keep-10_1_9_8_0_3"].max_abs.toFixed(4)) && has(T.fixes.head + 1.5, P.mixed["keep-10"].max_abs.toFixed(4)));
  assert.ok(has(T.arithmetic.stand + 2, F.recreation.firefly.WA.maxAbs.toFixed(4)) && has(T.bound.kept + 1, "the bound is not loosened"));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(P.rtx.coop.max_abs.toFixed(4)) && film.includes(P.emulation.WA.max_abs.toFixed(4)) && film.includes("the bound is not loosened"));
});
