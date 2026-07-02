import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Byte-identity gate for the vendored reconcile engine: EVERY vendored .js under
// system/lib/reconcile/ must equal its c:/dev/public/reconcile/src source. The main
// parity gate (parity.test.mjs) walks .mjs only, so the vendored .js tree would drift
// silently without this. Same hardcoded local-path convention as parity.test.mjs;
// re-vendor with: node tools/sync-reconcile.mjs
const SITE_RECONCILE = "c:/dev/public/portfolio-site/system/lib/reconcile";
const SOURCE = "c:/dev/public/reconcile/src";

function vendoredJs(dir, base = dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...vendoredJs(full, base));
    else if (ent.name.endsWith(".js")) out.push(relative(base, full).replace(/\\/g, "/"));
  }
  return out;
}

const files = vendoredJs(SITE_RECONCILE);

test("the reconcile engine entry points are vendored", () => {
  assert.ok(files.includes("index.js"), "index.js vendored");
  assert.ok(files.includes("organs/index.js"), "organs/index.js vendored");
  assert.ok(files.length >= 16, `expected >= 16 vendored .js, found ${files.length}`);
});

for (const f of files) {
  test(`vendored reconcile/${f} === reconcile source`, () => {
    const vendored = readFileSync(`${SITE_RECONCILE}/${f}`, "utf8");
    const source = readFileSync(`${SOURCE}/${f}`, "utf8");
    assert.equal(vendored, source, `${f} drifted from reconcile source -- re-run tools/sync-reconcile.mjs`);
  });
}
