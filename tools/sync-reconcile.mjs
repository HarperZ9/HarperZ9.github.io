// sync-reconcile.mjs - copies the reconcile engine's browser-clean ESM sources into the
// portfolio site vendor tree (system/lib/reconcile/), plus the reconcile LICENSE.
// Mirrors studio-libs' scripts/sync-to-site.mjs. Zero external deps: node:fs and node:path only.
// The byte-parity gate lives at system/lib/reconcile-parity.test.mjs.
import { readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const RECONCILE_ROOT = "c:/dev/public/reconcile";
const RECONCILE_SRC = join(RECONCILE_ROOT, "src");
const SITE_DST = "c:/dev/public/portfolio-site/system/lib/reconcile";

function syncDir(srcDir, dstDir) {
  let entries;
  try {
    entries = readdirSync(srcDir, { withFileTypes: true });
  } catch {
    console.error(`  [skip] cannot read ${srcDir}`);
    return 0;
  }
  let copied = 0;
  for (const ent of entries) {
    if (ent.isDirectory()) {
      copied += syncDir(join(srcDir, ent.name), join(dstDir, ent.name));
    } else if (ent.isFile()) {
      // Only copy .js sources (the engine is browser-clean ESM, all-relative imports).
      if (extname(ent.name) !== ".js") continue;
      mkdirSync(dstDir, { recursive: true });
      const src = join(srcDir, ent.name);
      const dst = join(dstDir, ent.name);
      copyFileSync(src, dst);
      console.log(`  copied ${relative(RECONCILE_ROOT, src)} -> system/lib/reconcile/${relative(SITE_DST, dst).replace(/\\/g, "/")}`);
      copied++;
    }
  }
  return copied;
}

console.log("[sync] reconcile engine");
const n = syncDir(RECONCILE_SRC, SITE_DST);

// The vendored copy ships with its license (reconcile is AGPL-3.0-or-later; the site
// repo is public on GitHub Pages, so source availability holds).
mkdirSync(SITE_DST, { recursive: true });
copyFileSync(join(RECONCILE_ROOT, "LICENSE"), join(SITE_DST, "LICENSE"));
console.log("  copied LICENSE -> system/lib/reconcile/LICENSE");

console.log(`\n[done] ${n} reconcile source files vendored.`);
