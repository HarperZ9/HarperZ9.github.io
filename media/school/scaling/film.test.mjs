// The scaling film's scene, checked in Node: every frame evaluates, the larger models' gaps wait for
// the held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, G = F.grid.runs;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the larger models' gaps wait for the held question", () => {
  assert.ok(T.bigger.big >= T.bigger.ask.held - 0.01 && !has(T.bigger.ask.held - 0.3, G[11].final.excess.toFixed(3)));
  assert.ok(has(T.bigger.big + 1, G[11].final.excess.toFixed(3)) && has(T.bigger.mid + 1, G[4].final.excess.toFixed(3)));
});

test("the seed spread, slopes and paper figures are facts values", () => {
  assert.ok(has(T.bigger.seeds + 1, `gap ${(F.noise.d16.heldOut.min - F.floor).toFixed(3)} to ${(F.noise.d16.heldOut.max - F.floor).toFixed(3)}`));
  assert.ok(has(T.compute.line + 3, `slope ${F.frontier.fitExcess.slope.toFixed(2)}`) && has(T.compute.size + 1, `slope ${F.frontier.fitSizeAtBudget.slope.toFixed(2)}`));
  assert.ok(has(T.papers.hoff + 1, `Chinchilla ${F.papers.hoffmann.chinchilla.params / 1e9} billion`) && F.papers.hoffmann.chinchilla.params * 4 === F.papers.hoffmann.gopher.params);
});

test("the script has no unfilled token and says 70 billion only as the facts do", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${F.papers.hoffmann.chinchilla.params / 1e9} billion`));
});
