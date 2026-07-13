import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Content-parity gate: EVERY vendored .mjs under system/lib/ must equal its studio-libs source.
// We WALK the vendored tree rather than hardcode a list, so the gate stays complete as files are
// added/removed by sync-to-site.mjs: no silent drift can reach the live GitHub-Pages surface.
const SITE_LIB = dirname(fileURLToPath(import.meta.url));

function findPublicReposRoot() {
  const explicit = process.env.PUBLIC_REPOS_ROOT;
  if (explicit) {
    const candidate = resolve(explicit);
    if (!existsSync(join(candidate, "studio-libs"))) {
      throw new Error("PUBLIC_REPOS_ROOT does not contain studio-libs");
    }
    return candidate;
  }

  for (const start of [SITE_LIB, process.cwd()]) {
    let cursor = resolve(start);
    while (true) {
      for (const candidate of [cursor, join(cursor, "public")]) {
        if (existsSync(join(candidate, "studio-libs"))) return candidate;
      }
      const parent = dirname(cursor);
      if (parent === cursor) break;
      cursor = parent;
    }
  }
  return null;
}

const PUBLIC_REPOS_ROOT = findPublicReposRoot();
const SOURCE = PUBLIC_REPOS_ROOT && join(PUBLIC_REPOS_ROOT, "studio-libs");
const normalized = (text) => text.replace(/\r\n/g, "\n");
const SITE_EXTENSION_PREFIXES = new Set(["sense-core/features.mjs"]);

function vendoredMjs(dir, base = dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...vendoredMjs(full, base));
    // The two gate files themselves are site-local, not vendored from studio-libs.
    // (reconcile-parity.test.mjs covers the vendored reconcile .js tree.)
    else if (ent.name.endsWith(".mjs") && ent.name !== "parity.test.mjs" && ent.name !== "reconcile-parity.test.mjs") {
      out.push(relative(base, full).replace(/\\/g, "/"));
    }
  }
  return out;
}

const files = vendoredMjs(SITE_LIB);

test("the core vendored libraries are present", () => {
  assert.ok(files.includes("sense-core/index.mjs"), "sense-core/index.mjs vendored");
  assert.ok(files.includes("render-nd/index.mjs"), "render-nd/index.mjs vendored");
  assert.ok(files.length >= 6, `expected >= 6 vendored .mjs, found ${files.length}`);
});

for (const f of files) {
  test(`vendored ${f} === studio-libs source`, { skip: SOURCE ? false : "studio-libs source checkout unavailable" }, () => {
    const vendored = normalized(readFileSync(`${SITE_LIB}/${f}`, "utf8"));
    const source = normalized(readFileSync(`${SOURCE}/${f}`, "utf8"));
    if (SITE_EXTENSION_PREFIXES.has(f)) {
      assert.ok(vendored.startsWith(source), `${f} no longer preserves its studio-libs source prefix`);
    } else {
      assert.equal(vendored, source, `${f} drifted from studio-libs source -- re-run sync-to-site.mjs`);
    }
  });
}
