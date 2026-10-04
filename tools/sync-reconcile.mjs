// sync-reconcile.mjs - copies the reconcile engine's browser-clean ESM sources into the
// portfolio site vendor tree (system/lib/reconcile/), plus the reconcile LICENSE.
// Mirrors studio-libs' scripts/sync-to-site.mjs. Zero external deps: node:fs and node:path only.
// The byte-parity gate lives at system/lib/reconcile-parity.test.mjs.
import { readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const RECONCILE_ROOT = "c:/dev/public/reconcile";
const RECONCILE_SRC = join(RECONCILE_ROOT, "src");
// The site checkout to write into is the first argument; there is no default, so the script never
// writes into a checkout nobody named.
//   node tools/sync-reconcile.mjs <site-checkout>
const SITE_ROOT = process.argv[2];
if (!SITE_ROOT) { console.error("usage: node tools/sync-reconcile.mjs <site-checkout>"); process.exit(2); }
const SITE_DST = join(SITE_ROOT, "system/lib/reconcile");

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

// The vendored copy ships with its licence (FSL-1.1-MIT from reconcile v0.2.0). Sync from a
// tagged checkout, and update LICENSE-NOTE.md with the version.
mkdirSync(SITE_DST, { recursive: true });
copyFileSync(join(RECONCILE_ROOT, "LICENSE"), join(SITE_DST, "LICENSE"));
console.log("  copied LICENSE -> system/lib/reconcile/LICENSE");

console.log(`\n[done] ${n} reconcile source files vendored.`);
