// "One box, many eyes" (draft): the scene runs over its whole length, its numbers come from its
// evidence, and no label meets the caption area while a sentence is spoken.
// Run: node --test tests/explainer-film-raw-native-showcase.test.mjs
// The narration is not recorded, so the caption cues are the provisional timing's sentences, one
// cue each: the live films' VTT splits a sentence into shorter cues inside the same span.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { overlaps } from "./explainer-film-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "media/explainers/raw-native-showcase");
const ENGINE = path.join(ROOT, "media/raw-native/tree-c6b114d/web/motion");
const read = async (p) => JSON.parse(await readFile(p, "utf8"));

async function loadFilm() {
  const { sceneContext, loadScene } = await import(pathToFileURL(path.join(ENGINE, "scene.mjs")).href);
  const file = path.join(DIR, "film.scene.mjs");
  const scene = (await import(pathToFileURL(file).href)).default;
  const fetcher = async (u) => { const body = await readFile(fileURLToPath(u), "utf8"); return { ok: true, json: async () => JSON.parse(body), text: async () => body }; };
  const ctx = sceneContext(scene, { baseUrl: pathToFileURL(file).href, fetcher });
  await loadScene(scene, ctx);
  const timing = await read(path.join(DIR, "timing.json"));
  return { slug: "raw-native-showcase", scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) };
}

const film = await loadFilm();
const { evaluate } = await import(pathToFileURL(path.join(ENGINE, "scene.mjs")).href);

test("the scene draws every 0.1 s of the film without throwing, with a finite camera", () => {
  let n = 0;
  for (let t = 0; t <= film.scene.duration; t += 0.1) {
    const f = evaluate(film.scene, film.ctx, t);
    assert.ok(Array.isArray(f.items) && f.items.length > 0, `no items at ${t.toFixed(1)} s`);
    for (const k of ["x", "y", "zoom"]) assert.ok(Number.isFinite(f.camera[k]), `camera.${k} at ${t.toFixed(1)} s`);
    n++;
  }
  assert.ok(n > 2000);
});

test("the film's length follows the timing: the last sentence, then the host's close", async () => {
  const timing = await read(path.join(DIR, "timing.json")), filmJson = await read(path.join(DIR, "film.json"));
  assert.ok(Math.abs(film.scene.duration - (timing[timing.length - 1].end + filmJson.host.close.seconds)) < 0.05);
});

test("the AO numbers are the release's own facts, and the shown facts are the evidence's", async () => {
  const facts = (await read(path.join(ROOT, "media/releases/raw-native/v0.6.0/ao-check/facts.json"))).facts;
  const ev = await read(path.join(DIR, "evidence.json")), A = film.ctx.assets;
  assert.equal(A.s1.rmse, facts.rmse.value);
  assert.equal(A.s1.tol, facts.tolerance.value);
  assert.equal(A.s1.verdict, facts.verdict.value);
  assert.equal(ev.facts.values.rmse.show, facts.rmse.value.toFixed(3));
  assert.equal(ev.facts.values.tolerance.show, facts.tolerance.value.toFixed(3));
  // Each shown fact is the value it was read from, formatted.
  const fmt = (v) => (typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 6 }) : String(v));
  for (const [key, f] of Object.entries(ev.facts.values)) {
    if (typeof f.value !== "number" || key === "rmse" || key === "tolerance" || key === "vector_edge" || key === "ocio_de") continue;
    assert.equal(f.show ?? fmt(f.value), fmt(f.value), key);
  }
  assert.equal(ev.facts.values.vector_edge.show, (Math.ceil(ev.facts.values.vector_edge.value * 1000) / 1000).toFixed(3));
  assert.equal(ev.facts.values.ocio_de.show, ev.facts.values.ocio_de.value.toFixed(4));
});

test("the host hands over to the lens and back: pixel mode only in the host beats", () => {
  const A = film.ctx.assets;
  assert.ok(evaluate(film.scene, film.ctx, 1.0).pixel, "the cold open is in Rerun's pixel style");
  assert.ok(evaluate(film.scene, film.ctx, film.scene.duration - 0.5).pixel, "the close is in Rerun's pixel style");
  const mid = evaluate(film.scene, film.ctx, A.T1.enter + 3);
  assert.ok(!mid.pixel, "segment 1 is not in pixel mode");
});

test("no label meets the caption area while a sentence is spoken", async () => {
  const rows = await overlaps(film);
  assert.deepEqual(rows, [], rows.slice(0, 5).map((r) => `${r.t}s ${r.box} under "${r.cue}"`).join("\n"));
});

test("control: the same labels are found in a band at the top of the frame", async () => {
  const rows = await overlaps(film, { x0: 0, y0: 0, x1: 1920, y1: 240 }, 0.5);
  assert.ok(rows.length > 0, "the detector found no labels at the top, so the caption check above proves nothing");
});
