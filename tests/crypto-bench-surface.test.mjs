import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  renderResultRows,
  runCryptoBenchSuite,
  runLoaderNegativeControls,
  verifyAndRunEntry,
} from "../playground/crypto-bench/crypto_bench.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const CRYPTO_DIR = path.join(ROOT, "playground", "crypto-bench");

const manifestPath = path.join(CRYPTO_DIR, "crypto_bench_manifest.json");
const htmlPath = path.join(CRYPTO_DIR, "index.html");
const modPath = path.join(CRYPTO_DIR, "crypto_bench.mjs");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const modSrc = readFileSync(modPath, "utf8");

const loadLocalWasm = async (relPath) => readFileSync(path.join(CRYPTO_DIR, relPath));

test("manifest SHA-256 parity and <= 35 KB bundle budget across all 4 MIT WASM binaries", () => {
  assert.equal(manifest.schema, "wave89e-crypto-bench-manifest/1");
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.module_count, 4);
  assert.equal(manifest.modules.length, 4);

  let sum = 0;
  for (const m of manifest.modules) {
    const buf = readFileSync(path.join(CRYPTO_DIR, m.wasm_path));
    const sha = createHash("sha256").update(buf).digest("hex");
    assert.equal(buf.length, m.wasm_bytes, `${m.slug}: byte count mismatch`);
    assert.equal(sha, m.wasm_sha256, `${m.slug}: SHA-256 mismatch`);
    sum += buf.length;
  }
  assert.equal(sum, manifest.total_bytes);
  assert.ok(sum <= 35 * 1024, `Total WASM bundle ${sum} B exceeds 35 KB budget`);
});

test("live WebAssembly execution of all 4/4 RFC KATs passes bit-exact in clean mode", async () => {
  const run = await runCryptoBenchSuite(manifest, loadLocalWasm, { globalTamper: false });
  assert.equal(run.all_verified, true);
  assert.equal(run.module_count, 4);
  assert.equal(run.clean_passed, 4);
  assert.equal(run.tamper_rejected, 0);
  assert.equal(run.controls.all_ok, true);

  for (const m of manifest.modules) {
    const row = run.rows.find((r) => r.slug === m.slug);
    assert.ok(row, `${m.slug} missing from run`);
    assert.equal(row.sha_ok, true);
    assert.equal(row.kat_match, true);
    assert.equal(row.output_hex, m.expected_clean, `${m.slug}: clean KAT hex mismatch`);
    assert.ok(html.includes(m.expected_clean), `${m.slug}: clean KAT missing in index.html`);
  }
});

test("live interactive 1-bit tamper mode rejects all 4/4 crypto modules fail-closed", async () => {
  const run = await runCryptoBenchSuite(manifest, loadLocalWasm, { globalTamper: true });
  assert.equal(run.all_verified, true);
  assert.equal(run.clean_passed, 0);
  assert.equal(run.tamper_rejected, 4);

  for (const m of manifest.modules) {
    const row = run.rows.find((r) => r.slug === m.slug);
    assert.equal(row.sha_ok, true);
    assert.equal(row.tamper, true);
    assert.equal(row.kat_match, false, `${m.slug}: tampered run must NOT match clean KAT`);
    assert.equal(row.fail_closed_caught, true, `${m.slug}: tamper must be caught fail-closed`);
    assert.equal(row.output_hex, m.expected_tampered, `${m.slug}: tampered hex mismatch`);
    assert.ok(html.includes(m.expected_tampered), `${m.slug}: tampered hex missing in index.html`);
  }

  const rendered = renderResultRows(manifest, new Map(run.rows.map((r) => [r.slug, r])), {
    sha256_zeroc: true,
    merkle_rfc6962: true,
    aead_chacha20_poly1305: true,
    x25519_curve25519_zeroc: true,
  });
  assert.equal((rendered.match(/REJECTED \(TAMPER CAUGHT\)/g) || []).length, 4);
});

test("planted loader controls reject corrupted WASM magic and tampered manifest SHA-256", async () => {
  const controls = await runLoaderNegativeControls(manifest, loadLocalWasm);
  assert.equal(controls.corrupted_magic_rejected, true);
  assert.equal(controls.corrupted_magic_error, "CompileError");
  assert.equal(controls.tampered_manifest_sha_rejected, true);
  assert.equal(controls.all_ok, true);

  // Also test tampered SHA-256 on x25519_curve25519_zeroc directly
  const x25519 = manifest.modules.find((m) => m.slug === "x25519_curve25519_zeroc");
  const badSha = (x25519.wasm_sha256[0] === "0" ? "1" : "0") + x25519.wasm_sha256.slice(1);
  const res = await verifyAndRunEntry({ ...x25519, wasm_sha256: badSha }, loadLocalWasm);
  assert.equal(res.sha_ok, false);
  assert.equal(res.kat_match, false);
  assert.equal(res.fail_closed_caught, true);
});

test("DESIGN-RULES.md One Shell Measured Drafting Sheet and strict public hygiene", () => {
  assert.ok(html.includes('href="/world/ui/shell/shell.css'));
  assert.ok(html.includes('href="/studies/studies.css'));
  assert.ok(html.includes('class="reading ds-sheet"'));
  assert.ok(html.includes('class="o-hand o-said"'));
  assert.ok(html.includes('id="o-menu"'));
  assert.ok(html.includes('class="ds-prov"'));
  assert.ok(!html.includes('class="gw-backdrop"'));
  assert.ok(html.includes("crypto.subtle"));
  assert.ok(html.includes("1-Bit Tamper"));

  const cdnRegex = /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|stackpath\.bootstrapcdn)/i;
  assert.ok(!cdnRegex.test(html), "External CDN link found in index.html");
  assert.ok(!cdnRegex.test(modSrc), "External CDN link found in crypto_bench.mjs");

  const manifestText = readFileSync(manifestPath, "utf8");
  for (const [label, text] of [
    ["index.html", html],
    ["crypto_bench.mjs", modSrc],
    ["crypto_bench_manifest.json", manifestText],
  ]) {
    assert.ok(!text.includes("\u2014"), `${label}: em dash found`);
    assert.ok(!text.includes("\u2013"), `${label}: en dash found`);
    assert.ok(!/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(text), `${label}: local path found`);
    assert.ok(!/zentropy|DS-08|isomorph/i.test(text), `${label}: forbidden token found`);
  }
});
