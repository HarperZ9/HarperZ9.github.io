// verify-cli.mjs: the headless re-run. Rebuilds the First Integral report from the same modules
// the browser uses and prints the canonical report JSON followed by its SHA-256, byte-for-byte
// stable across runs, so CI can assert MATCH without a browser. Node >= 18 (globalThis.crypto).
//
// Usage:
//   node system/showcase/verify-cli.mjs [seed] [system]
//   node system/showcase/verify-cli.mjs 1 kepler
// Output: the canonical JSON on line 1, then "sha256 <64 hex>" on line 2. Two runs byte-equal.
// ASCII only; no em or en dashes.
import { buildReport } from "./report.js";

async function main() {
  const seed = process.argv[2] || "1";
  const system = process.argv[3] || "kepler";
  const { canonical, sha256 } = await buildReport({ seed, system });
  process.stdout.write(canonical + "\n");
  process.stdout.write("sha256 " + sha256 + "\n");
}

main().catch((e) => {
  process.stderr.write("verify-cli failed: " + String((e && e.stack) || e) + "\n");
  process.exit(1);
});
