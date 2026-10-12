// No caption cue covers an on-screen label in the five explainer films.
// Run: node --test tests/explainer-film-labels.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { FILMS, CAPTION_AREA, loadFilm, labelsAt, overlaps } from "./explainer-film-labels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = pathToFileURL(path.join(ROOT, "media/raw-native/web-23ec93f/motion/")).href;
const { text } = await import(ENGINE + "text.mjs");
const { circle } = await import(ENGINE + "path.mjs");
const films = Object.fromEntries(await Promise.all(FILMS.map(async (s) => [s, await loadFilm(s)])));

for (const slug of FILMS) {
  test(`${slug}: no label meets the caption area while a cue shows`, async () => {
    const rows = await overlaps(films[slug]);
    assert.deepEqual(rows, [], rows.slice(0, 5).map((r) => `${r.t}s ${r.box} under "${r.cue}"`).join("\n"));
  });
}

test("the check can fail on these films: the same labels meet a band at the top of the frame", async () => {
  // Control: every film puts labels near the top, so a caption area there must catch some.
  const top = { x0: 0, y0: 0, x1: 1920, y1: 308 };
  for (const slug of FILMS) assert.ok((await overlaps(films[slug], top, 0.5)).length > 0, `${slug}: nothing found at the top`);
});

test("the detector finds labels in every film", async () => {
  for (const slug of FILMS) {
    const f = films[slug];
    let n = 0;
    for (const c of f.cues) n += (await labelsAt(f, (c.a + c.b) / 2)).length;
    assert.ok(n >= f.cues.length, `${slug}: ${n} labels over ${f.cues.length} cue midpoints`);
  }
});

// A small stand-in film: one cue from 1 s to 3 s, and one item drawn by `draw`.
async function standIn(draw) {
  const atlas = JSON.parse(await readFile(path.join(ROOT, "media/explainers/motion/hanken-500.json"), "utf8"));
  const scene = { duration: 4, frame: () => ({ camera: { x: 960, y: 540, zoom: 1 }, items: [draw(atlas)] }) };
  return { slug: "stand-in", scene, ctx: { params: {} }, cues: [{ a: 1, b: 3, text: "a cue" }] };
}

test("controls: a label low in the frame fails; the same label higher passes", async () => {
  const low = await standIn((atlas) => ({ shape: text("a label in the lower third", { atlas, size: 30, x: 960, y: 980, anchor: "center" }).shape, fill: "#fff" }));
  const high = await standIn((atlas) => ({ shape: text("a label in the lower third", { atlas, size: 30, x: 960, y: 700, anchor: "center" }).shape, fill: "#fff" }));
  const faint = await standIn((atlas) => ({ shape: text("a faded label", { atlas, size: 30, x: 960, y: 980, anchor: "center" }).shape, fill: "#fff", opacity: 0.02 }));
  assert.ok((await overlaps(low)).length > 0);
  assert.equal((await overlaps(high)).length, 0);
  assert.equal((await overlaps(faint)).length, 0);
});

test("controls: text bent along an arc is a label; rings and dots are not", async () => {
  const bent = await standIn((atlas) => {
    const run = text("the cheapest check ships", { atlas, size: 36, x: 0, y: 0 });
    const shape = run.shape.map((c) => {
      const p = c.pts, o = new Float32Array(p.length);
      for (let i = 0; i < p.length; i += 2) { const a = Math.PI * 0.75 - (p[i] / run.width) * Math.PI * 0.5, r = 420 + p[i + 1]; o[i] = 960 + Math.cos(a) * r; o[i + 1] = 500 + Math.sin(a) * r; }
      return { pts: o, closed: c.closed };
    });
    return { shape, fill: "#fff" };
  });
  const rings = await standIn(() => ({ shape: [40, 60, 80, 100].flatMap((r) => circle(960, 900, r, 48)), fill: "#fff" }));
  const dots = await standIn(() => ({ shape: Array.from({ length: 40 }, (_, i) => circle(500 + i * 24, 900, 8, 24)).flat(), fill: "#fff" }));
  assert.ok((await overlaps(bent)).length > 0, "bent text was not found");
  assert.equal((await overlaps(rings)).length, 0, "rings were taken for text");
  assert.equal((await overlaps(dots)).length, 0, "dots were taken for text");
});

test("the caption area matches the measured Chrome caption box", () => {
  // Two-line cue, controls faded: x 0.227 to 0.776, y 0.869 to 1.0 of the frame; controls shown at 1280 px: y from 0.734.
  assert.ok(CAPTION_AREA.x0 <= 0.227 * 1920 && CAPTION_AREA.x1 >= 0.776 * 1920);
  assert.ok(CAPTION_AREA.y0 <= 0.734 * 1080 && CAPTION_AREA.y1 >= 1080);
});
