import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

// Byte-identity gate: EVERY vendored .mjs under system/lib/ must equal its studio-libs source.
// We WALK the vendored tree rather than hardcode a list, so the gate stays complete as files are
// added/removed by sync-to-site.mjs — no silent drift can reach the live GitHub-Pages surface.
const SITE_LIB = "c:/dev/public/portfolio-site/system/lib";
const SOURCE = "c:/dev/public/studio-libs";

function vendoredMjs(dir, base = dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...vendoredMjs(full, base));
    else if (ent.name.endsWith(".mjs") && ent.name !== "parity.test.mjs") {
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
  test(`vendored ${f} === studio-libs source`, () => {
    const vendored = readFileSync(`${SITE_LIB}/${f}`, "utf8");
    const source = readFileSync(`${SOURCE}/${f}`, "utf8");
    assert.equal(vendored, source, `${f} drifted from studio-libs source — re-run sync-to-site.mjs`);
  });
}
