import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUCKETS = ["creative", "research", "platforms", "writing", "about"];

test("compressed 6-surface JSON bundles and legacy route map are complete and valid", () => {
  let total = 0;
  for (const b of BUCKETS) {
    const p = path.join(ROOT, "data", "compressed", `${b}.json`);
    assert.ok(fs.existsSync(p), `missing compressed bucket ${b}.json`);
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.equal(data.schema, "site-compressed/1");
    assert.equal(data.bucket, b);
    assert.equal(data.items.length, data.count);
    assert.ok(data.count > 0, `bucket ${b} must not be empty`);
    total += data.count;
  }
  assert.ok(total >= 600, `expected >= 600 compressed entries across 5 buckets, got ${total}`);

  const mapPath = path.join(ROOT, "data", "compressed", "legacy-route-map.json");
  assert.ok(fs.existsSync(mapPath), "missing legacy-route-map.json");
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  assert.equal(map.schema, "site-legacy-routes/1");
  assert.ok(map.count >= 600, `expected >= 600 mapped legacy routes, got ${map.count}`);
});

test("studio.html wires native 10-domain studio-unified-bar.js with creative-chassis key", () => {
  const html = fs.readFileSync(path.join(ROOT, "studio.html"), "utf8");
  assert.match(html, /system\/studio-unified-bar\.js\?v=20260902-creative-chassis/);
});
