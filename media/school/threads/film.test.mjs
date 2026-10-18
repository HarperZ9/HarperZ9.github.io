// The threads film's scene, checked in Node: every frame evaluates, the stride-8 total waits for the
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
const T = ctx.assets.T, R = F.traffic.rows;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the stride-8 total waits for the held question", () => {
  const s = R[3].t32.total.toLocaleString("en");
  assert.ok(!has(T.count.ask.held - 0.3, s) && T.count.far >= T.count.ask.held && has(T.count.far + 1.5, s));
});

test("the counts on screen are facts values", () => {
  const G = F.grouping.rows[2], o = F.film.offByOne[0];
  assert.ok(has(T.crews.forty + 1, `element ${o.global}`) && has(T.crews.idle + 1, `${G.workgroups} crews, ${G.invocations.toLocaleString("en")} threads, ${G.idleThreads} idle`));
  assert.ok(has(T.warehouse.near + 1, `${F.film.segments.contiguous.t32} blocks`) && has(T.warehouse.spread + 1, `${F.film.segments.stride8.t32} blocks`));
  assert.ok(has(T.count.ratio + 1, `${R[3].ratio32.toFixed(2)} times`) && has(T.count.near + 1.5, R[0].t32.total.toLocaleString("en")));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(R[3].t32.total.toLocaleString("en")) && film.includes(`${R[3].ratio32.toFixed(2)} times`));
});
