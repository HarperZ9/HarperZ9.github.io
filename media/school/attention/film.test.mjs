// The attention film's scene, checked in Node: every frame evaluates, the cues are in order, and
// every number the scene writes about the model is one facts.json holds (computed from the
// weights by tools/school/fill_film.mjs), so no model number is typed by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import scene from "./film.scene.mjs";
import { sceneContext, loadScene, evaluate } from "../../raw-native/tree-c6b114d/web/motion/scene.mjs";
import { LABELS } from "./scene/lib.mjs";

const here = new URL("./", import.meta.url);
const fetcher = async (u) => { const p = fileURLToPath(u); return { ok: true, json: async () => JSON.parse(readFileSync(p, "utf8")) }; };
const ctx = sceneContext(scene, { baseUrl: new URL("film.scene.mjs", here).href, fetcher });
await loadScene(scene, ctx);
const F = JSON.parse(readFileSync(new URL("facts.json", here), "utf8"));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("segment cues run in order and the film ends after the last line", () => {
  const T = ctx.assets.T, ends = ["title", "hole", "whisper", "lamp", "inside", "heads", "sw", "cost", "edge"].map((k) => T[k].end);
  for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1], `segment ${i} ends before ${i - 1}`);
  assert.ok(T.host.end > ends.at(-1));
  assert.ok(T.inside.reveal > T.inside.ask.held - 0.01, "the reveal waits for the held pause");
  assert.ok(T.hole.reveal > T.hole.ask.held - 0.01, "the hole is filled after the held pause");
});

test("numbers drawn about the model come from facts.json", () => {
  const allowed = new Set([...F.scores.map((v) => v.toFixed(1)), ...F.shares.map((v) => `${Math.round(v * 100)}%`), F.qkRaw.toFixed(2), (F.qkRaw / Math.sqrt(F.dHead)).toFixed(2)]);
  const T = ctx.assets.T, seen = [];
  for (const t of [T.lamp.scores + 1.7, T.lamp.shares + 2.1, T.inside.reveal + 2.2, T.inside.ask.start - 1.0]) {
    for (const it of evaluate(scene, ctx, t).items) { const s = LABELS.get(it.shape); if (s && /^-?\d+(\.\d+)?%?$/.test(s)) seen.push(s); }
  }
  assert.ok(seen.length >= 10, `only ${seen.length} numeric labels found`);
  for (const s of seen) assert.ok(allowed.has(s), `label ${s} is not a facts.json value`);
});

test("the film's script carries no unfilled token and states the measured copy rates", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film));
  assert.ok(film.includes(`correctly ${Math.round(F.copyOn * 100)} percent`));
  assert.ok(film.includes(`only itself, ${Math.round(F.copyOff * 100)} percent`));
});
