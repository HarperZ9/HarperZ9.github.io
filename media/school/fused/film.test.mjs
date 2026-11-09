// The fused-attention film's scene, checked in Node: every frame evaluates, the 16-per-head traffic
// waits for the held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, Bd = F.film.bars, MiB = (b) => (b / 1048576).toFixed(1).replace(/\.0$/, "");
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the 16-per-head traffic waits for the held question", () => {
  const s = `16 per head, fused: ${MiB(Bd.d16.fused[6].bytes)} MiB`;
  assert.ok(!has(T.fused.ask.held - 0.3, s) && has(Math.max(T.fused.d16, T.fused.ask.held) + 2.5, s));
});

test("the numbers on screen are facts values", () => {
  assert.ok(Bd.d64.unfused[6].N === 4096 && has(T.fused.count + 2.5, `64 per head, fused: ${MiB(Bd.d64.fused[6].bytes)} MiB`));
  const h = F.probe.heads[0];
  assert.ok(has(T.rescale.left + 3, `${h.brokenMismatches} of ${h.outputs}`) && has(T.overflow.probe + 1, `e to it ${F.overflow.probeRow.expOfMax.toLocaleString("en")}`));
  assert.ok(has(T.overflow.held + 1, `up to ${Math.max(...F.overflow.heldOut.map((x) => x.max)).toFixed(2)}`));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${MiB(Bd.d64.unfused[6].bytes)} mebibytes the plain way`) && film.includes(F.overflow.probeRow.expOfMax.toLocaleString("en")));
});
