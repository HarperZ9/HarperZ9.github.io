// Film 6, "Provenance and the commons" (draft scene code): the scene runs over its whole length,
// every number on screen is in the source whose tab is on screen with it, the timing is the
// script's, and no label meets the caption area while a sentence is spoken.
// Run: node --test tests/explainer-film-provenance-commons.test.mjs
// Engine: the vendored raw-native tree at media/raw-native/tree-c6b114d.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { CAPTION_AREA, labelsAt } from "./explainer-film-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "provenance-commons", DIR = path.join(ROOT, "media/explainers", SLUG);
const ENGINE = pathToFileURL(path.join(ROOT, "media/raw-native/tree-c6b114d/web/motion/")).href;
const { sceneContext, loadScene, evaluate } = await import(ENGINE + "scene.mjs");

// The guides' stage fetches its type atlas by URL; in Node, serve file: URLs from disk.
const fileFetch = async (u) => {
  const body = await readFile(fileURLToPath(typeof u === "string" ? u : u.href), "utf8");
  return { ok: true, json: async () => JSON.parse(body), text: async () => body };
};
const netFetch = globalThis.fetch;
globalThis.fetch = (u, ...rest) => (String(u).startsWith("file:") ? fileFetch(String(u)) : netFetch(u, ...rest));

const file = path.join(DIR, "film.scene.mjs");
const scene = (await import(pathToFileURL(file).href)).default;
const { LABELS, TAB_OF } = await import(pathToFileURL(path.join(DIR, "scene/world.mjs")).href);
const ctx = sceneContext(scene, { baseUrl: pathToFileURL(file).href, fetcher: fileFetch });
await loadScene(scene, ctx);
const evidence = JSON.parse(await readFile(path.join(DIR, "evidence.json"), "utf8"));
const timing = JSON.parse(await readFile(path.join(DIR, "timing.json"), "utf8"));
const film = JSON.parse(await readFile(path.join(DIR, "film.json"), "utf8"));
const times = [];
for (let t = 0; t <= scene.duration + 1e-9; t += 0.1) times.push(+t.toFixed(2));

test("the scene evaluates every 0.1 s over its whole length without throwing", () => {
  assert.ok(scene.duration > 60, `duration ${scene.duration}`);
  let empty = 0;
  for (const t of times) {
    const f = evaluate(scene, ctx, t);
    assert.ok(Array.isArray(f.items), `${t}s: no item list`);
    if (!f.items.length) empty++;   // the one frame of dark the net gathers from is allowed
    for (const it of f.items) assert.ok(it.kind || Array.isArray(it.shape), `${t}s: an item with no shape`);
  }
  assert.ok(empty <= 2, `${empty} empty frames`);
});

// Numbers in a string: digits with their separators and a % sign; "C4" (a corpus name) and the
// "1 mark = 1" unit statements are not claims.
const numbers = (s) => s.replace(/\b1 (mark|ring) = 1\b/g, "").match(/(?<![A-Za-z])\d[\d,.]*\d%?|(?<![A-Za-z\d])\d%?(?![\dA-Za-z])/g) || [];
const WORDS = { 8: "eight" };
function inSource(num, id) {
  const e = evidence.sources[id], hay = [e.short, e.citation, e.n, e.quote, ...(e.claims || [])].join(" ").toLowerCase();
  const n = num.replace(/%$/, "");
  return hay.includes(n.toLowerCase()) || Boolean(WORDS[n] && hay.includes(WORDS[n]));
}

test("every number on screen is in the source whose tab is on screen with it", () => {
  const seen = new Set(), bad = [];
  for (const t of times) {
    const f = evaluate(scene, ctx, t);
    const tabs = f.items.filter((it) => TAB_OF.has(it.shape) && (it.opacity ?? 1) > 0.02).map((it) => TAB_OF.get(it.shape));
    for (const it of f.items) {
      const s = LABELS.get(it.shape);
      if (!s || TAB_OF.has(it.shape) || (it.opacity ?? 1) <= 0.05) continue;
      for (const num of numbers(s)) {
        seen.add(num);
        if (!tabs.some((id) => inSource(num, id))) bad.push(`${t}s "${s}" (${num}) with tabs [${tabs}]`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 8), []);
  // The film's numbers all reached the screen.
  for (const n of ["2021", "5.6.0", "0.01", "0.5", "8", "100", "178", "1,858", "72%", "29%", "30%", "5%"]) assert.ok(seen.has(n), `never shown: ${n}`);
});

test("the control: a number with no matching tab is caught", () => {
  assert.equal(inSource("72%", "hardin1968"), false);
  assert.equal(inSource("72%", "longpre2023"), true);
  assert.deepEqual(numbers("1 mark = 1 dataset . 1,858"), ["1,858"]);
  assert.deepEqual(numbers("about 5% of C4 tokens"), ["5%"]);
});

test("the timing is provisional and says the script's words, in order", () => {
  assert.ok(Array.isArray(timing) && timing.every((r) => r.provisional === true));
  const said = timing.map((r) => r.text).join(" "), script = film.segments.flatMap((s) => s.lines).join(" ");
  assert.equal(said, script);
  for (let i = 1; i < timing.length; i++) assert.ok(timing[i].start >= timing[i - 1].end, `row ${i} overlaps`);
});

test("no label meets the caption area while a sentence is spoken", async () => {
  // The captions follow the sentences, so each sentence's span is a cue.
  const film6 = { slug: SLUG, scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) };
  const hits = (b, A) => b[0] < A.x1 && b[2] > A.x0 && b[1] < A.y1 && b[3] > A.y0;
  const bad = [];
  for (const cue of film6.cues) for (let t = cue.a; t < cue.b; t += 0.1) {
    for (const l of await labelsAt(film6, t)) if (hits(l.box, CAPTION_AREA)) bad.push(`${t.toFixed(1)}s ${l.box.map(Math.round)}`);
  }
  assert.deepEqual(bad.slice(0, 6), []);
});

test("the label check finds this film's labels (control: a band at the top catches some)", async () => {
  const film6 = { slug: SLUG, scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) };
  let n = 0;
  for (const cue of film6.cues) for (const l of await labelsAt(film6, (cue.a + cue.b) / 2)) if (l.box[1] < 308) n++;
  assert.ok(n > 10, `${n} labels found near the top`);
});
