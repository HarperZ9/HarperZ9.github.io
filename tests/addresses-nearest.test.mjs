// The 404 page's guess, checked against rows shaped like the ledger's.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nearest } from "../scripts/addresses-nearest.mjs";

const rows = [
  { path: "/", kind: "surface" },
  { path: "/flywheel.html", kind: "surface" },
  { path: "/playground/", kind: "surface" },
  { path: "/playground/distill.html", kind: "leaf" },
  { path: "/findings/F310-kernel.html", kind: "record" },
  { path: "/old.html", kind: "redirect", to: "/older.html" },
  { path: "/older.html", kind: "redirect", to: "/flywheel.html#run" },
  { path: "/daylight.html", kind: "redirect", to: "/cmmns/install.html" },
  { path: "/withdrawn.html", kind: "gone", removed: "abc1234" },
  { path: "/to-gone.html", kind: "redirect", to: "/withdrawn.html" },
];

test("a redirect row leads to the end of its chain", () => {
  assert.deepEqual(nearest("/old.html", rows), { path: "/flywheel.html#run", why: "moved" });
  assert.deepEqual(nearest("/daylight.html", rows, ["/cmmns/"]), { path: "/cmmns/install.html", why: "moved" });
});
test("a withdrawn address offers the home and says so", () => {
  assert.deepEqual(nearest("/withdrawn.html", rows), { path: "/", why: "withdrawn" });
});
test("letter case, a missing .html and a missing slash are spelling", () => {
  assert.deepEqual(nearest("/Flywheel.HTML", rows), { path: "/flywheel.html", why: "spelling" });
  assert.deepEqual(nearest("/flywheel", rows), { path: "/flywheel.html", why: "spelling" });
  assert.deepEqual(nearest("/playground", rows), { path: "/playground/", why: "spelling" });
  assert.deepEqual(nearest("/playground/index.html", rows), { path: "/playground/", why: "spelling" });
  assert.deepEqual(nearest("/old", rows), { path: "/flywheel.html#run", why: "spelling" });
});
test("a page asked for in the wrong folder is found by its name", () => {
  assert.deepEqual(nearest("/distill.html", rows), { path: "/playground/distill.html", why: "name" });
});
test("a small slip finds the close address, a large one does not", () => {
  assert.deepEqual(nearest("/flywheal.html", rows), { path: "/flywheel.html", why: "close" });
  assert.equal(nearest("/nothing-like-any-row-on-this-site.html", rows), null);
});
test("an unknown page under a known folder offers the folder", () => {
  assert.deepEqual(nearest("/playground/some/long-gone-instrument.html", rows), { path: "/playground/", why: "folder" });
});
test("a redirect that ends at a withdrawn page is never offered", () => {
  assert.notEqual(nearest("/to-gone.html", rows)?.path, "/withdrawn.html");
});
test("the file has no imports, and the page carries its code as written", () => {
  const src = readFileSync(new URL("../scripts/addresses-nearest.mjs", import.meta.url), "utf8");
  assert.equal(/^\s*import\s/m.test(src), false);
  const code = src.slice(src.indexOf("const fold")).replace(/^export /gm, "").trim();
  const page = readFileSync(new URL("../404.html", import.meta.url), "utf8");
  assert.ok(page.includes(code), "404.html is out of date: run node scripts/build-addresses.mjs");
  assert.equal(new Function(`${code}; return nearest("/flywheel", ${JSON.stringify(rows)});`)().path, "/flywheel.html");
});
