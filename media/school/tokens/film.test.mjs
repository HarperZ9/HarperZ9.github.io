// The tokens film's scene, checked in Node: every frame evaluates, the crates are the encoder's
// pieces (lamplit and lighthouse cut as facts.json records, English merges learned at load matching
// facts.json's first merges), the answer waits for the held question, numbers on screen are facts
// values, and the script has no unfilled token.
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
const T = ctx.assets.T, A = ctx.assets;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the crates are the encoder's pieces, as facts.json records them", () => {
  assert.deepEqual(A.enc(F.corpus.unseen[0].word, 136), F.corpus.unseen[0].pieces);
  assert.deepEqual(A.encE("lighthouse", F.english.curveHeld[9].merges), F.english.unseen[0].pieces);
  F.english.firstMerges.forEach((m, i) => { assert.equal(A.engMerges[i].a, m.a); assert.equal(A.engMerges[i].b, m.b); });
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(film.includes("comes out as li, gh, thou and se.") && F.english.unseen[0].pieces.join("|") === "li|gh|thou|se</w>");
});

test("the merge count waits for the held question; numbers on screen are facts values", () => {
  assert.ok(T.merge.reveal >= T.merge.ask.held - 0.01);
  assert.ok(!has(T.merge.ask.held - 0.3, "50 merges"), "no 50-merge row during the hold");
  assert.ok(has(T.merge.reveal + 1, `${F.corpus.curveTrain[7].tokensPerWord.toFixed(2)} pieces per word`));
  const rc = F.corpus.randomControl.train[12];
  assert.ok(has(T.random.rand + 2, `${rc.min.toFixed(2)} to ${rc.max.toFixed(2)}`));
  assert.ok(has(T.bytes.zero + 1, `${F.bytes.byteBPE.heldUnknownTokens} from bytes, ${F.bytes.charBPE.heldUnknownTokens} from letters`));
});

test("the script carries no unfilled token", () => {
  assert.ok(!/\{\{/.test(readFileSync(new URL("film.json", here), "utf8")));
});
