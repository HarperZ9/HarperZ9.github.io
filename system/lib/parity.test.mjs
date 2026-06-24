import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SITE_LIB = "c:/dev/public/portfolio-site/system/lib";
const SOURCE = "c:/dev/public/studio-libs";

const pairs = [
  "render-nd/core/polytopes.mjs",
  "render-nd/index.mjs",
  "render-nd/backends/raster.mjs",
  "sense-core/assemble.mjs",
  "sense-core/index.mjs",
  "sense-core/features.mjs",
];

for (const f of pairs) {
  test(`vendored ${f} === studio-libs source`, () => {
    const vendored = readFileSync(`${SITE_LIB}/${f}`, "utf8");
    const source = readFileSync(`${SOURCE}/${f}`, "utf8");
    assert.equal(vendored, source);
  });
}
