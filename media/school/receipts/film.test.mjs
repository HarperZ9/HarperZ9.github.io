// The receipts film's scene, checked in Node: every frame evaluates, the rows' sweep result waits for
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
const T = ctx.assets.T, M = F.film;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));
const caught = (r) => `${r.caught.toLocaleString("en")} of ${r.bytes.toLocaleString("en")} caught`;

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the rows' sweep result waits for the held question", () => {
  assert.ok(T.rederive.ask.held <= T.tamper.rows + 0.01 && !has(T.rederive.ask.held - 0.3, caught(M.results)) && has(T.tamper.rows + 1, caught(M.results)));
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.claim.result + 1, `the result: ${F.receipt.correct} of ${F.receipt.total}`) && has(T.claim.receipt + 4, F.receipt.resultsSha256.slice(0, 24)));
  assert.ok(has(T.tamper.perm + 1, caught(M.receipt)) && has(T.tamper.perm + 1, caught(M.permissions)));
  assert.ok(has(T.cheater.reveal + 1, `${M.cheat.id}: said ${M.cheat.prediction}, answer ${M.cheat.answer}`) && has(T.rederive.recompute + 5, "the same"));
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film) && film.includes(`${F.receipt.correct} of ${F.receipt.total}`) && film.includes(M.tampers.toLocaleString("en")) && film.includes(`${M.receipt.caught.toLocaleString("en")} of ${M.receipt.bytes.toLocaleString("en")}`));
});
