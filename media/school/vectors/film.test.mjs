// The vectors film's scene, checked in Node: every frame evaluates, cues run in order, the reveals
// wait for the held pauses, numbers drawn about the model are facts.json values (or arithmetic on
// the word lists facts.json holds), and the script has no unfilled token.
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

test("segments run in order; reveals wait for the held questions", () => {
  const ends = ["title", "place", "arrows", "dot", "cos", "many", "words", "cone", "flat"].map((k) => T[k].end);
  for (let i = 1; i < ends.length; i++) assert.ok(ends[i] > ends[i - 1], `segment ${i} ends before ${i - 1}`);
  assert.ok(T.dot.reveal >= T.dot.ask.held - 0.01 && T.cos.reveal >= T.cos.ask.held - 0.01);
  // During each held pause the answer is not on screen.
  for (const [q, s] of [[T.dot.ask, "  =  ?"], [T.cos.ask, "a . b = ?"]]) assert.ok(textAt(q.held - 0.3).some((x) => x.includes(s)), `answer hidden during "${q.text}"`);
  assert.ok(textAt(T.dot.reveal + 1.4).some((x) => x.endsWith("=  0.00")), "the dot product shows zero at the right angle");
});

test("percentages and cosines drawn about the model are facts.json values", () => {
  const pct = (v) => `${Math.round(v * 100)}%`, m = F.measurements;
  const allowed = new Set([m.wte.top1, m.wte.control.top1.mean, m.wte.control.top1.lo95, m.wte.control.top1.hi95, m.wteUntrained.top1, F.chartWte.varianceShare, F.chartWte.top1In2D].map(pct));
  allowed.add("95%"); // the interval's level ("95% of shuffles"), not a measurement
  for (const w of ["kettle", "tallow", "cone"]) for (const n of F.neighbours.wte[w]) allowed.add(n.cosine.toFixed(2));
  const seen = [];
  for (const t of [T.words.share + 3, T.words.before + 1, T.flat.all + 1, T.flat.keep + 1.2, T.words.close + 1, T.words.tallow + 1, T.cone.nb + 1]) {
    for (const s of textAt(t)) for (const x of s.match(/-?\d+(\.\d+)?%?/g) || []) if (x.endsWith("%") || /^-?0\.\d\d$/.test(x)) seen.push(x);
  }
  assert.ok(seen.length >= 10, `only ${seen.length} numeric labels found`);
  for (const s of seen) assert.ok(allowed.has(s), `label ${s} is not a facts.json value`);
});

test("the 32-number dot product is computed from the stored word lists", () => {
  const i = F.words.indexOf("kettle"), j = F.words.indexOf("map"), d = F.wte[i].reduce((s, v, k) => s + v * F.wte[j][k], 0);
  assert.ok(textAt(T.many.still + 6.5).includes(`kettle . map = ${d.toFixed(2)}`));
  const cos = F.neighbours.wte.kettle.find((n) => n.word === "map").cosine;
  assert.ok(textAt(T.many.still + 7).includes(`cosine = ${cos.toFixed(2)}`));
});

test("the script carries no unfilled token and quotes the measured shares", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film));
  assert.ok(film.includes(`${Math.round(F.measurements.wte.top1 * 100)} percent have a nearest neighbour`));
  assert.ok(film.includes(`only ${Math.round(F.chartWte.top1In2D * 100)} percent of the words sit nearest`));
});
