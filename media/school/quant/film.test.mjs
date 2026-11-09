// The quantisation film's scene, checked in Node: every frame evaluates, the 4-bit loss waits for the
// held question, every number on screen is a facts value, the rows named by position are the schemes
// the words say, and the script has no unfilled token.
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
const T = ctx.assets.T, R = F.schemes.rows;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the 4-bit loss waits for the held question", () => {
  const s = R[18].loss.value.toFixed(4);
  assert.ok(!has(T.cost.ask.held - 0.3, s) && has(Math.max(T.cost.four, T.cost.ask.held) + 1, s));
});

test("the rows the script names by position are the schemes its words say", () => {
  const want = { 2: ["rtn", 8, "channel"], 10: ["rtn", 6, "channel"], 18: ["rtn", 4, "channel"], 19: ["gptq", 4, "channel"], 24: ["rtn", 3, "tensor"], 26: ["rtn", 3, "channel"], 33: ["gptq", 2, "tensor"], 34: ["rtn", 2, "channel"] };
  for (const [i, [m, b, s]] of Object.entries(want)) assert.deepEqual([R[i].method, R[i].bits, R[i].scheme], [m, b, s], `row ${i}`);
  assert.equal(F.sensitivity.rows[10].name, "wout"); assert.equal(F.sensitivity.rows[10].bits, 4);
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.size.four + 1.5, R[18].bytes.total.toLocaleString("en")) && has(T.gptq.careful + 1.5, `+${R[19].loss.diff.toFixed(4)}`));
  assert.ok(has(T.where.one + 5, F.sensitivity.rows[10].loss.diff.toFixed(4)) && has(T.palette.hist + 1.5, `its ${F.banding.levels[0].values.length} levels`));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(R[18].loss.value.toFixed(4)) && film.includes(R[19].loss.diff.toFixed(4)));
});
