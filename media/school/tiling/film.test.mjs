// The tiling film's scene, checked in Node: every frame evaluates, the tiled fetch count waits for the
// held question, every number on screen is a facts value, and the script has no unfilled token.
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
const T = ctx.assets.T, R = F.counts.rows, E = F.film.perElement[4];
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the tiled fetch count waits for the held question", () => {
  const s = `each number fetched ${E.tiled16} times`;
  assert.ok(!has(T.tray.ask.held - 0.3, s) && T.tray.fewer >= T.tray.ask.held && has(T.tray.fewer + 1, s));
});

test("the counts on screen are facts values", () => {
  assert.ok(R[12].n === 1024 && R[12].kind === "naive" && R[13].T === 8 && R[14].T === 16 && E.n === 1024);
  assert.ok(has(T.naive.all + 1, R[12].globalLoads.toLocaleString("en")) && has(T.count.start + 6.5, R[14].globalLoads.toLocaleString("en")));
  assert.ok(has(T.count.perbyte + 1, `${R[12].intensity.toFixed(2)}, ${R[13].intensity.toFixed(2)}, ${R[14].intensity.toFixed(2)}`) && has(T.matmul.reads + 1, F.film.trips[4].naive.toLocaleString("en")));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(R[14].globalLoads.toLocaleString("en")) && film.includes(`${R[12].intensity.toFixed(2)} operations per byte`));
});
