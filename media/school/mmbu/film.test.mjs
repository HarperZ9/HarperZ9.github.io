// The MMBU film's scene, checked in Node: every frame evaluates, the fourth run's interval waits for
// the held question, every number on screen is a facts value, and the script has no unfilled token.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import scene from "./film.scene.mjs";
import { sceneContext, loadScene, evaluate } from "../../raw-native/tree-c6b114d/web/motion/scene.mjs";
import { LABELS } from "../shared/lib.mjs";
import { ivText } from "./scene/book.mjs";

const here = new URL("./", import.meta.url);
const fetcher = async (u) => { const p = fileURLToPath(u); return { ok: true, json: async () => JSON.parse(readFileSync(p, "utf8")) }; };
const ctx = sceneContext(scene, { baseUrl: new URL("film.scene.mjs", here).href, fetcher });
await loadScene(scene, ctx);
const F = JSON.parse(readFileSync(new URL("facts.json", here), "utf8"));
const T = ctx.assets.T;
const textAt = (t) => evaluate(scene, ctx, t).items.map((it) => LABELS.get(it.shape)).filter(Boolean);
const has = (t, s) => textAt(t).some((x) => x.includes(s));

test("every half second of the film evaluates to a frame with items", () => {
  for (let t = 0; t < scene.duration; t += 0.5) {
    const f = evaluate(scene, ctx, t);
    assert.ok(f.items.length > 0, `empty frame at ${t}`);
    assert.ok(f.camera && Number.isFinite(f.camera.zoom), `camera at ${t}`);
  }
});

test("the fourth run's interval waits for the held question", () => {
  const s = ivText(F.ft4.H1);
  assert.ok(T.miss.ink4 >= T.bar.ask.held - 0.01);
  assert.ok(!has(T.bar.ask.held - 0.3, s), "not before the hold ends");
  assert.ok(has(T.miss.ink4 + 2, s), "inked after it");
});

test("the numbers on screen are facts values", () => {
  assert.ok(has(T.miss.ink5 + 2, ivText(F.ft5.K1)));
  assert.ok(has(T.knows.ink6 + 2, ivText(F.ft6.M2)));
  assert.ok(has(T.rule.ink7 + 2, ivText(F.ft7.N4)));
  assert.ok(has(T.words.flip + 2.5, ivText(F.vocab.ft7minusFt6.harmonised)) && has(T.words.flip + 2.5, ivText(F.vocab.ft7minusFt6.original)));
  assert.ok(has(T.prior.cheat + 1.5, `${(F.baselines.oracle * 100).toFixed(1)} percent`));
  assert.ok(has(T.lights.dup + 1.5, `${F.records.survival.dupSteps} steps lost`));
  assert.ok(has(T.ledger.local + 1.5, `entries ${F.ledger.firstUnpushed} to ${F.ledger.lastEntry}: first pushed ${F.ledger.latePushDate}`));
  assert.ok(has(T.close.ft8 + 1.5, `step ${F.records.survival.ft8Step} of`));
});

test("no label shows a number that is not a facts value", () => {
  // Every number a facts value can be shown as: rounded to 0 to 5 places, as a percent, in billions, with separators.
  const shown = new Set(), walk = (v) => { if (typeof v === "number") { for (let d = 0; d <= 5; d++) { shown.add(v.toFixed(d)); shown.add((v * 100).toFixed(d)); }
    shown.add((v / 1e9).toFixed(1)); shown.add(String(v)); shown.add(v.toLocaleString("en")); } else if (typeof v === "string") { for (const m of v.match(/\d+/g) || []) shown.add(m); } else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(F);
  for (const v of [0, 0.02, 0.04, -0.02, 99.0, 99.5, 100.0, 99.9, 3.5]) { shown.add(v.toFixed(1)); shown.add(v.toFixed(2)); shown.add(String(v)); }   // axis ticks, the 99.9 bar, Qwen 3.5
  const seen = new Set();
  for (let t = 0; t < scene.duration; t += 0.5) for (const x of textAt(t)) seen.add(x);
  const bad = [];
  for (const x of seen) for (const m of x.replace(/\d{4}-\d{2}-\d{2}/g, "").match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || []) if (!shown.has(m) && !shown.has(m.replace(/^-/, ""))) bad.push(`${m} in "${x}"`);
  assert.deepEqual(bad, []);
});

test("the script has no unfilled token and quotes the facts' main numbers", () => {
  const film = readFileSync(new URL("film.json", here), "utf8");
  assert.ok(!/\{\{/.test(film));
  assert.ok(film.includes(F.ft4.H1.mean.toFixed(3)) && film.includes(F.ft7.N4.mean.toFixed(3)) && film.includes(F.vocab.ft7minusFt6.harmonised.mean.toFixed(3)));
  assert.ok(film.includes("nothing has been submitted") && film.includes("not a medical tool"));
});
