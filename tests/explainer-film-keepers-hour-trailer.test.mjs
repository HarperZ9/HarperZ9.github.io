// The Keeper's Hour trailer (draft): the Motion layer runs over its length (84 s, 21 sweeps), every card is the
// film.json line word for word (film.json's lines are night.txt's, checked when they were
// written), the end card's numbers trace to evidence.json, the cards keep to the lamp's
// four-second sweeps, and no word sits in the caption area while a card is on screen.
// Run: node --test tests/explainer-film-keepers-hour-trailer.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { overlaps } from "./explainer-film-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "media/explainers/keepers-hour-trailer");
const { sceneContext, loadScene, evaluate } = await import(pathToFileURL(path.join(ROOT, "media/raw-native/tree-c6b114d/web/motion/scene.mjs")).href);
const read = async (f) => JSON.parse(await readFile(path.join(DIR, f), "utf8"));
const file = path.join(DIR, "film.scene.mjs");
const scene = (await import(pathToFileURL(file).href)).default;
const fetcher = async (u) => { const body = await readFile(fileURLToPath(u), "utf8"); return { ok: true, json: async () => JSON.parse(body), text: async () => body }; };
const ctx = sceneContext(scene, { baseUrl: pathToFileURL(file).href, fetcher });
await loadScene(scene, ctx);
const film = await read("film.json"), timing = await read("timing.json"), evidence = await read("evidence.json"), capture = await read("capture.json");

test("the layer evaluates every 0.1 s over its 21 sweeps (84 s)", () => {
  assert.equal(film.duration, 84);
  assert.equal(scene.duration, film.duration);
  assert.equal(film.segments.at(-1).sweeps[1], 21);
  for (let t = 0; t <= film.duration; t += 0.1) assert.ok(Array.isArray(evaluate(scene, ctx, t).items));
});

test("each card is its film.json line, word for word, and ends on a sweep", () => {
  const lines = film.segments.filter((s) => s.lines.length).map((s) => s.lines[0]);
  assert.deepEqual(ctx.assets.cardText, lines);
  for (const s of film.segments) assert.ok(s.sweeps[1] >= s.sweeps[0] && s.sweeps[1] <= 21);
  // A card is on screen at least (words / 3) seconds (bible 4.4): from its cut to the next.
  for (const s of film.segments.filter((x) => x.lines.length)) {
    const words = s.lines[0].split(/\s+/).length, secs = (s.sweeps[1] - s.sweeps[0] + 1) * film.sweep_seconds;
    const on = [], step = 0.05;
    for (let t = (s.sweeps[0] - 1) * film.sweep_seconds; t < s.sweeps[1] * film.sweep_seconds; t += step) if (evaluate(scene, ctx, t).items.length) on.push(t);
    assert.ok(on.length * step >= words / 3 - step, `${s.key}: on screen ${(on.length * step).toFixed(2)} s for ${words} words`);
    assert.ok(secs >= words / 3, `${s.key}: ${words} words in ${secs} s`);
  }
  assert.equal(film.segments.at(-1).sweeps[1] * film.sweep_seconds, film.duration);
  // Sweeps follow each other with no gap and no overlap.
  film.segments.forEach((s, i) => { if (i) assert.equal(s.sweeps[0], film.segments[i - 1].sweeps[1] + 1, s.key); });
});

test("every footage sweep has exactly one planned capture shot", () => {
  const covered = capture.shots.flatMap((s) => Array.from({ length: s.sweeps[1] - s.sweeps[0] + 1 }, (_, k) => s.sweeps[0] + k));
  assert.deepEqual(covered, Array.from({ length: 19 }, (_, k) => k + 1));
  for (const s of capture.shots) assert.equal(s.seconds, (s.sweeps[1] - s.sweeps[0] + 1) * film.sweep_seconds);
});

test("the end card's numbers trace to evidence.json", () => {
  const all = JSON.stringify(evidence);
  for (const n of ["25", "1998", "1.4"]) assert.ok(ctx.assets.endText.join(" ").includes(n) && all.includes(n), n);
  assert.ok(all.includes("Three endings"));
  assert.ok(all.includes("about 25 minutes") || all.includes("about 25 minutes".replace("a", "A")) || all.includes("25 minutes"));
});

test("no card word meets the caption area while a card shows", async () => {
  const rows = await overlaps({ slug: "keepers-hour-trailer", scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) });
  assert.deepEqual(rows, []);
  const top = { x0: 0, y0: 0, x1: 1920, y1: 308 };
  assert.ok((await overlaps({ scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) }, top, 0.5)).length > 0, "control: the cards sit at the top");
});
