import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runFullBench } from '../playground/wasm-bench/bench.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const benchDir = path.join(root, 'playground', 'wasm-bench');
const manifestPath = path.join(benchDir, 'playground_wasm_18pack_manifest.json');

test('playground/wasm-bench executes all 18 pure-OSI MIT BuildLang .wasm modules with SHA-256 and tamper controls', async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.total_module_count, 18);
  assert.equal(manifest.license, 'MIT');

  const loadBytes = async (relPath) => new Uint8Array(readFileSync(path.join(benchDir, relPath)));
  const sha256Hex = async (bytes) => createHash('sha256').update(bytes).digest('hex');

  const res = await runFullBench(manifest, loadBytes, sha256Hex);
  assert.equal(res.ok, true, 'expected full 18-module WASM bench + controls to pass');
  assert.equal(res.passed_count, 18);
  assert.equal(res.total_count, 18);
  assert.equal(res.total_bytes, 88123);
  assert.ok(res.total_bytes < 100 * 1024, 'total 18-module pack must stay under 100 KB');
  assert.equal(res.magic_control.rejected_fail_closed, true);
  assert.equal(res.manifest_sha_control.rejected_fail_closed, true);

  const html = readFileSync(path.join(benchDir, 'index.html'), 'utf8');
  assert.ok(html.includes('id="bench-rows"'));
  assert.ok(html.includes('./bench.mjs'));
  assert.ok(!html.includes('\u2014') && !html.includes('\u2013'), 'no em/en dashes allowed');
});
