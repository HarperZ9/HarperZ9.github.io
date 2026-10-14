// "Colour on a budget" (draft scene code): the scene runs over its whole length,
// every number on screen is in the source whose tab is on screen with it, the timing is the
// script's, and no label meets the caption area while a sentence is spoken.
// Run: node --test tests/explainer-film-colour-on-a-budget.test.mjs
// Engine: the vendored raw-native tree at media/raw-native/tree-c6b114d.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { CAPTION_AREA, labelsAt } from "./explainer-film-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUG = "colour-on-a-budget", DIR = path.join(ROOT, "media/explainers", SLUG);
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
const { LABELS, TAB_OF, COUNTED, DERIVED } = await import(pathToFileURL(path.join(DIR, "scene/lib.mjs")).href);
const P = await import(pathToFileURL(path.join(DIR, "scene/picture.mjs")).href);
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
        if (!tabs.some((id) => inSource(num, id)) && !COUNTED.has(num) && !DERIVED.has(num)) bad.push(`${t}s "${s}" (${num}) with tabs [${tabs}]`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 8), []);
  // The film's numbers all reached the screen.
  for (const n of ["320", "200", "256", "262,144", "8", "16", "65", "1973", "1993", "16,777,216", "170"]) assert.ok(seen.has(n), `never shown: ${n}`);
});

test("numbers counted from the picture or derived by arithmetic are what the scene says", () => {
  const B = P.budgets();
  assert.equal(COUNTED.get(B.N.toLocaleString("en-US")) !== undefined, true);
  assert.equal(B.N, P.distinct(P.dusk()));
  assert.equal(B.mc.palette.length, 256);
  assert.deepEqual(B.mc.steps.map((s) => s.length), [1, 2, 4, 8, 16, 32, 64, 128, 256]);
  assert.equal(B.ega.length, 16);
  assert.deepEqual([...new Set(B.bayer8.flat())].sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i));
  assert.equal(2 ** 6, 64); assert.equal(64 ** 3, 262144); assert.equal(2 ** 8, 256);
  for (const k of DERIVED.keys()) assert.ok(["64", "262,144", "256"].includes(k), `an unchecked derived number: ${k}`);
  // Median cut gives each colour about the same number of pixels (Heckbert's aim): within a factor of 2.
  const counts = B.mc.counts, mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  assert.ok(Math.max(...counts) <= 2 * mean + 1 && Math.min(...counts) >= mean / 2 - 1, `box sizes ${Math.min(...counts)} to ${Math.max(...counts)}`);
});

test("the control: a number with no matching tab is caught", () => {
  assert.equal(inSource("65", "heckbert1982"), false);
  assert.equal(inSource("65", "bouman2013"), true);
  assert.deepEqual(numbers("16,777,216 colours . 0 mismatches"), ["16,777,216", "0"]);
  assert.deepEqual(numbers("320 x 200 . one byte a pixel"), ["320", "200"]);
});

test("the timing is provisional, says the script's words in order, and holds the predict question", () => {
  assert.ok(Array.isArray(timing) && timing.every((r) => r.provisional === true));
  const said = timing.filter((r) => r.predict === undefined).map((r) => r.text).join(" "), script = film.segments.flatMap((s) => s.lines).join(" ");
  assert.equal(said, script);
  for (let i = 1; i < timing.length; i++) assert.ok(timing[i].start >= timing[i - 1].end, `row ${i} overlaps`);
  const asks = timing.filter((r) => r.predict !== undefined);
  assert.equal(asks.length, 1);
  assert.ok(timing[timing.indexOf(asks[0]) + 1].start - asks[0].end >= 2.5 - 1e-6, "no hold after the question");
  assert.ok(timing.some((r) => r.text.startsWith("In 1973, B. E. Bayer")), "the Bayer line is one sentence");
});

test("the predict question is on screen from its first word through its hold", () => {
  for (const q of timing.filter((r) => r.predict !== undefined)) for (const t of [q.start + 0.5, q.end + 1.2]) {
    const shown = evaluate(scene, ctx, t).items.some((it) => LABELS.get(it.shape) === q.text && (it.opacity ?? 1) > 0.5);
    assert.ok(shown, `${t.toFixed(1)}s: "${q.text}" not on screen`);
  }
});

test("no label meets the caption area while a sentence is spoken", async () => {
  // The captions follow the sentences, so each sentence's span is a cue.
  const film7 = { slug: SLUG, scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) };
  const hits = (b, A) => b[0] < A.x1 && b[2] > A.x0 && b[1] < A.y1 && b[3] > A.y0;
  const bad = [];
  for (const cue of film7.cues) for (let t = cue.a; t < cue.b; t += 0.1) {
    for (const l of await labelsAt(film7, t)) if (hits(l.box, CAPTION_AREA)) bad.push(`${t.toFixed(1)}s ${l.box.map(Math.round)}`);
  }
  assert.deepEqual(bad.slice(0, 6), []);
});

test("the label check finds this film's labels (control: a band at the top catches some)", async () => {
  const film7 = { slug: SLUG, scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) };
  let n = 0;
  for (const cue of film7.cues) for (const l of await labelsAt(film7, (cue.a + cue.b) / 2)) if (l.box[1] < 308) n++;
  assert.ok(n > 10, `${n} labels found near the top`);
});
