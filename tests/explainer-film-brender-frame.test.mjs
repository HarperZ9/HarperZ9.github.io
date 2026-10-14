// "How a 1998 engine drew a frame" (draft scene): the scene runs over its whole length, every
// number it puts on screen traces to evidence.json, and no label meets the caption area while
// a sentence is spoken (the label check of explainer-film-labels.mjs, with each sentence of
// timing.json as the cue, which covers every caption cue the sentence would be split into).
// Run: node --test tests/explainer-film-brender-frame.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { overlaps, labelsAt } from "./explainer-film-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "media/explainers/brender-frame");
const ENGINE = pathToFileURL(path.join(ROOT, "media/raw-native/tree-c6b114d/web/motion/")).href;
const { sceneContext, loadScene, evaluate } = await import(ENGINE + "scene.mjs");
const read = async (f) => JSON.parse(await readFile(path.join(DIR, f), "utf8"));

const file = path.join(DIR, "film.scene.mjs");
const scene = (await import(pathToFileURL(file).href)).default;
const fetcher = async (u) => { const body = await readFile(fileURLToPath(u), "utf8"); return { ok: true, json: async () => JSON.parse(body), text: async () => body }; };
const ctx = sceneContext(scene, { baseUrl: pathToFileURL(file).href, fetcher });
await loadScene(scene, ctx);
const timing = await read("timing.json"), evidence = await read("evidence.json"), film = await read("film.json");

test("the scene evaluates every 0.1 s over its whole length without throwing", () => {
  let n = 0;
  for (let t = 0; t <= scene.duration; t += 0.1, n++) {
    const list = evaluate(scene, ctx, t);
    assert.ok(Array.isArray(list.items), `no items at ${t.toFixed(1)} s`);
    for (const it of list.items) if (it.shape) assert.ok(Array.isArray(it.shape), `bad shape at ${t.toFixed(1)} s`);
  }
  assert.ok(n > 2000, `only ${n} frames evaluated`);
  assert.ok(scene.duration > timing[timing.length - 1].end, "the scene ends before the narration");
});

test("timing is the provisional one and every sentence of the script is in it", () => {
  const said = film.segments.flatMap((s) => s.lines).join(" ");
  assert.equal(timing.map((r) => r.text).join(" "), said);
  assert.ok(timing.every((r) => r.provisional === true));
});

// Numbers on screen: each must appear in evidence.json, as digits or as words.
const WORDS = { 7: "seven", 12: "12-part", 21: "21" };
const MONTH = { Aug: "August", Oct: "October", Nov: "November" };
test("every number on screen traces to evidence.json", () => {
  const all = JSON.stringify(evidence).replace(/(\d),(\d{3})/g, "$1$2");
  const strings = [...ctx.assets.statementText, ...ctx.assets.closeText, "BRender 1.3.2 . about November 1998 . MIT", "How a 1998 engine drew a frame.",
    "Gouraud 1971", "RGB 99, 24, 24", "rosewood.pix . 8-bit indices", "std.pal . 256 colours", String(ctx.assets.palette.index)];
  const missing = [];
  for (const s of strings) {
    for (let m of s.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+(?:\.\d+)*/g)) {
      const n = m[0];
      if (["3", "2", "4"].includes(n) && /BrMatrix4|3D|2D|x64|Win32/.test(s)) continue;
      if (all.includes(n) || (WORDS[n] && all.includes(WORDS[n]))) continue;
      missing.push(`${n} in "${s}"`);
    }
    for (const [ab, full] of Object.entries(MONTH)) if (s.includes(` ${ab} `)) assert.ok(all.includes(full), `${full} not in evidence`);
  }
  assert.deepEqual(missing, []);
});

test("the texel on screen is the one in rosewood.json and evidence.json", async () => {
  const R = await read("frames/rosewood.json");
  const ix = R.patch[R.texel[1] - R.patch_origin[1]][R.texel[0] - R.patch_origin[0]];
  assert.equal(ix, R.index);
  assert.ok(JSON.stringify(evidence.sources["rosewood-texel"].claims).includes(`index ${ix}`));
  assert.ok(JSON.stringify(evidence.sources["rosewood-texel"].claims).includes(`RGB ${R.palette[ix].join(", ")}`));
});

const filmObj = { slug: "brender-frame", scene, ctx, cues: timing.map((r) => ({ a: r.start, b: r.end, text: r.text })) };
test("no label meets the caption area while a sentence is spoken", async () => {
  const rows = await overlaps(filmObj);
  assert.deepEqual(rows, [], rows.slice(0, 8).map((r) => `${r.t}s ${r.box} under "${r.cue.slice(0, 40)}"`).join("\n"));
});

test("the label check can fail on this film: a band at the top catches its labels", async () => {
  const top = { x0: 0, y0: 0, x1: 1920, y1: 308 };
  assert.ok((await overlaps(filmObj, top, 0.5)).length > 0);
  let n = 0;
  for (const r of timing) n += (await labelsAt(filmObj, (r.start + r.end) / 2)).length;
  assert.ok(n >= timing.length, `${n} labels over ${timing.length} sentences`);
});
