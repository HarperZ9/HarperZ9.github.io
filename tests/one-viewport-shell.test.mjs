import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("site-universe-manifest covers entire website with valid paths", () => {
  const manifestPath = path.join(ROOT, "data", "site-universe-manifest.json");
  assert.ok(fs.existsSync(manifestPath), "data/site-universe-manifest.json must exist");
  const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(m.schema, "site-universe-manifest/1");
  assert.ok(m.total >= 600, `expected >= 600 pages, got ${m.total}`);
  assert.equal(m.items.length, m.total);
  assert.ok(m.categories.length >= 10, `expected >= 10 categories, got ${m.categories.length}`);
  for (const it of m.items) {
    assert.ok(it.p.startsWith("/"), `path must start with /: ${it.p}`);
    const diskPath = path.join(ROOT, it.p.slice(1));
    assert.ok(fs.existsSync(diskPath), `missing page on disk: ${it.p}`);
  }
});

test("studio.html wires one-viewport-shell.js with creative-chassis cache key", () => {
  const html = fs.readFileSync(path.join(ROOT, "studio.html"), "utf8");
  assert.match(html, /system\/one-viewport-shell\.js\?v=20260902-creative-chassis/);
});
