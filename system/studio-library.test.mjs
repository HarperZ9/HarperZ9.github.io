// studio-library.test.mjs — the published archive as studio material.
// Run: node --test system/studio-library.test.mjs
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  LIBRARY_FILTERS, buildLibrary, filterCounts, filterWorks, parseStudioLink, studioLink,
  workLabel, workProvenance,
} from "./studio-library.js";

const work = (id, over = {}) => ({
  id, title: `Work ${id}`, kind: "single",
  full: `art/session-archive/full/${id}.jpg`, thumb: `art/session-archive/thumb/${id}.jpg`,
  dimensions: [1122, 1402],
  measure: { lightness: 0.2, chroma: 20, tone: "dark", family: "warm" },
  source_asset: { png_sha256: "a".repeat(64) },
  ...over,
});

const fixture = () => ({
  title: "Session archive",
  range: { tone_counts: { dark: 1, mid: 1, luminous: 1 } },
  works: [
    work("w001"),
    work("w002", { measure: { lightness: 0.5, chroma: 3, tone: "mid", family: "monochrome" } }),
    work("w003", { kind: "collage", measure: { lightness: 0.9, chroma: 40, tone: "luminous", family: "cool" } }),
  ],
});

test("the library keeps what the studio needs to draw and to cite", () => {
  const lib = buildLibrary(fixture());
  assert.equal(lib.count, 3);
  const w = lib.byId("w001");
  assert.equal(w.full, "art/session-archive/full/w001.jpg");
  assert.equal(w.tone, "dark");
  assert.equal(w.sha.length, 64, "the source hash travels with the material");
  assert.equal(lib.byId("nope"), null);
});

test("a work with no measurement or no pixels is not offered as material", () => {
  // Both would fail at draw time. Refusing them at catalogue time means the picker never lists a
  // work the pen surface cannot actually pick up.
  const m = fixture();
  m.works.push({ id: "w004", title: "no pixels", measure: m.works[0].measure });
  m.works.push({ id: "w005", title: "no measure", full: "art/x.jpg" });
  m.works.push({ id: "bogus", title: "bad id", full: "art/x.jpg", measure: m.works[0].measure });
  const lib = buildLibrary(m);
  assert.equal(lib.count, 3);
  for (const id of ["w004", "w005", "bogus"]) assert.equal(lib.byId(id), null);
});

test("the filters are the archive page's own bands, and they count", () => {
  const lib = buildLibrary(fixture());
  assert.deepEqual(filterWorks(lib.works, "dark").map((w) => w.id), ["w001"]);
  assert.deepEqual(filterWorks(lib.works, "monochrome").map((w) => w.id), ["w002"]);
  assert.deepEqual(filterWorks(lib.works, "collage").map((w) => w.id), ["w003"]);
  assert.equal(filterWorks(lib.works, "all").length, 3);
  // An unknown filter shows everything rather than nothing: a picker that silently empties is
  // worse than one that ignores a bad key.
  assert.equal(filterWorks(lib.works, "made-up").length, 3);
  const counts = filterCounts(lib.works);
  assert.equal(counts.all, 3);
  assert.equal(counts.luminous, 1);
  assert.equal(Object.keys(counts).length, LIBRARY_FILTERS.length);
});

test("the picker label carries the measurements the filters band on", () => {
  const lib = buildLibrary(fixture());
  assert.equal(workLabel(lib.byId("w001"), 1), "001 · Work w001 · dark, warm");
  assert.equal(workLabel(lib.byId("w003"), 42), "042 · Work w003 · luminous, cool");
});

test("provenance cites the file, not the title", () => {
  const lib = buildLibrary(fixture());
  const p = workProvenance(lib.byId("w001"));
  assert.match(p, /archive w001/);
  assert.match(p, /source aaaaaaaaaaaa/, "the source hash is named, truncated at the point of use");
});

test("the link out and the link in agree", () => {
  const url = studioLink("w042");
  assert.equal(url, "studio.html?source=plotmaps&material=archive&work=w042");
  const back = parseStudioLink(url.slice(url.indexOf("?")));
  assert.deepEqual(back, { material: "archive", work: "w042", method: null });
  assert.equal(parseStudioLink("?source=plotmaps&material=archive&work=w042&method=stipple").method, "stipple");
});

test("a malformed request never puts the pen surface on a material with no work behind it", () => {
  assert.equal(studioLink("w4"), null);
  assert.equal(studioLink("../../etc/passwd"), null);
  assert.equal(parseStudioLink("?material=archive"), null);
  assert.equal(parseStudioLink("?material=archive&work=../secret"), null);
  assert.equal(parseStudioLink("?material=plate&work=w001"), null);
  assert.equal(parseStudioLink(""), null);
});
