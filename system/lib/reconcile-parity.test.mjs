import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Content-parity gate for the vendored reconcile engine: EVERY vendored .js under
// system/lib/reconcile/ must equal its sibling reconcile source. The main
// parity gate (parity.test.mjs) walks .mjs only, so the vendored .js tree would drift
// silently without this. Set PUBLIC_REPOS_ROOT when the repositories do not share
// the default sibling layout; re-vendor with: node tools/sync-reconcile.mjs
const SITE_LIB = dirname(fileURLToPath(import.meta.url));
const SITE_RECONCILE = join(SITE_LIB, "reconcile");

function findPublicReposRoot() {
  const explicit = process.env.PUBLIC_REPOS_ROOT;
  if (explicit) {
    const candidate = resolve(explicit);
    if (!existsSync(join(candidate, "reconcile", "src"))) {
      throw new Error("PUBLIC_REPOS_ROOT does not contain reconcile/src");
    }
    return candidate;
  }

  for (const start of [SITE_LIB, process.cwd()]) {
    let cursor = resolve(start);
    while (true) {
      for (const candidate of [cursor, join(cursor, "public")]) {
        if (existsSync(join(candidate, "reconcile", "src"))) return candidate;
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  return null;
}

const PUBLIC_REPOS_ROOT = findPublicReposRoot();
const SOURCE = PUBLIC_REPOS_ROOT && join(PUBLIC_REPOS_ROOT, "reconcile", "src");
const normalized = (text) => text.replace(/\r\n/g, "\n");

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
  test(`vendored reconcile/${f} === reconcile source`, { skip: SOURCE ? false : "reconcile source checkout unavailable" }, () => {
    const vendored = readFileSync(`${SITE_RECONCILE}/${f}`, "utf8");
    const source = readFileSync(`${SOURCE}/${f}`, "utf8");
    assert.equal(normalized(vendored), normalized(source), `${f} drifted from reconcile source -- re-run tools/sync-reconcile.mjs`);
  });
}
