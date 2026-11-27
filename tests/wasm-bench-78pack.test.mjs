import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const SUITE_SCRIPT = path.join(ROOT, "playground", "wasm-bench", "pack78", "run_all_78_wasm_suite.mjs");

test("playground/wasm-bench/pack78 executes all 78 pure-OSI MIT BuildLang .wasm modules with SHA-256 and planted controls", () => {
  const stdout = execFileSync(process.execPath, [SUITE_SCRIPT], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.passed_count, 78);
  assert.equal(parsed.total_count, 78);
  assert.ok(parsed.total_bytes < 650 * 1024, `78-pack ${parsed.total_bytes} B exceeded 650 KB`);
  assert.equal(parsed.planted_controls.corrupted_magic_rejected, true);
  assert.equal(parsed.planted_controls.tampered_manifest_sha_rejected, true);
});
