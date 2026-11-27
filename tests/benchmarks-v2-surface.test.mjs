import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  bestSpeedupDescriptor,
  computeHeadlineMetrics,
  filterKernels,
  fmtKb,
  fmtMs,
  renderSpeedupSvg,
  renderTableRows,
  verifySurfaceConsistency,
} from "../playground/benchmarks/benchmarks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const BENCH_DIR = path.join(ROOT, "playground", "benchmarks");

const resultsPath = path.join(BENCH_DIR, "benchmarks_v2_results.json");
const summaryPath = path.join(BENCH_DIR, "benchmarks_v2_receipt_summary.json");
const htmlPath = path.join(BENCH_DIR, "index.html");
const modulePath = path.join(BENCH_DIR, "benchmarks.mjs");

const rawResults = readFileSync(resultsPath);
const results = JSON.parse(rawResults.toString("utf8"));
const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const modSrc = readFileSync(modulePath, "utf8");

test("benchmarks_v2_results.json matches sealed receipt SHA-256 exactly", () => {
  const digest = `sha256:${createHash("sha256").update(rawResults).digest("hex")}`;
  assert.equal(digest, summary.results_sha256);
  assert.equal(rawResults.length, summary.results_bytes);
  assert.equal(summary.verdict, "MATCH");
  assert.equal(results.schema, "wave82e-cross-runtime-benchmarks-v2/1");
  assert.equal(results.license, "MIT");
  assert.equal(results.kernels_total, 8);
  assert.equal(results.parity_all_ok, true);
  assert.equal(results.planted_control.planted_wrong_output_caught, true);
});

test("every displayed figure in /playground/benchmarks/index.html matches benchmarks_v2_results.json", () => {
  const verdict = verifySurfaceConsistency(html, results);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.checkedKernels, 8);

  const m = computeHeadlineMetrics(results);
  assert.equal(m.titanNativeSpeedup, 30.21);
  assert.equal(m.titanWasmSpeedup, 27.46);
  assert.equal(m.indirectNativeSpeedup, 13.01);
  assert.equal(m.kcoreNativeSpeedup, 5.62);
  assert.equal(m.sha256WasmSpeedup, 7.51);
  assert.equal(m.aeadWasmSpeedup, 4.55);
  assert.equal(m.sha256ZerocBeatsCrt, true);
  assert.equal(m.aeadZerocBeatsCrt, true);
  assert.equal(m.nativeCount, 8);
  assert.equal(m.wasmCount, 7);
  assert.equal(m.zerocCount, 2);
  assert.equal(m.pythonCount, 8);
  assert.equal(m.parityCount, 8);

  // Verify every binary byte count and formatted KB size appears faithfully
  for (const k of results.kernels) {
    if (k.zeroc_pe32) {
      assert.ok(html.includes(fmtKb(k.zeroc_pe32.exe_bytes)), `${k.id} Zero-C KB size missing`);
      assert.ok(html.includes(`${k.zeroc_pe32.exe_bytes} B`), `${k.id} Zero-C byte size missing`);
    }
    if (k.node_wasm) {
      assert.ok(html.includes(fmtKb(k.node_wasm.wasm_bytes)), `${k.id} WASM KB size missing`);
      assert.ok(html.includes(`${k.node_wasm.wasm_bytes} B`), `${k.id} WASM byte size missing`);
    }
    if (k.buildc_native) {
      assert.ok(html.includes(fmtMs(k.buildc_native.p50_ms)), `${k.id} native p50 missing`);
    }
    if (k.python_stdlib) {
      assert.ok(html.includes(fmtMs(k.python_stdlib.p50_ms)), `${k.id} python p50 missing`);
    }
    const best = bestSpeedupDescriptor(k);
    assert.ok(html.includes(best.label), `${k.id} speedup label ${best.label} missing`);
  }
});

test("interactive filter, sort, table, and SVG generators work across all modes", () => {
  const zerocOnly = filterKernels(results.kernels, { runtime: "zeroc_pe32" });
  assert.equal(zerocOnly.length, 2);
  assert.deepEqual(
    zerocOnly.map((k) => k.id),
    ["sha256", "aead_chacha20_poly1305"]
  );

  const wasmOnly = filterKernels(results.kernels, { runtime: "node_wasm" });
  assert.equal(wasmOnly.length, 7);

  const computeOnly = filterKernels(results.kernels, { category: "compute", sortBy: "speedup_desc" });
  assert.deepEqual(
    computeOnly.map((k) => k.id),
    ["titan_1m", "indirect_draw_cull", "kcore_color"]
  );

  const searchHit = filterKernels(results.kernels, { query: "407884a0a576fa41" });
  assert.equal(searchHit.length, 1);
  assert.equal(searchHit[0].id, "titan_1m");

  const svgNative = renderSpeedupSvg(results.kernels, { metric: "native_vs_python" });
  assert.ok(svgNative.includes("<svg"));
  assert.ok(svgNative.includes("30.21x"));
  assert.ok(svgNative.includes("13.01x"));

  const svgWasm = renderSpeedupSvg(results.kernels, { metric: "wasm_vs_python" });
  assert.ok(svgWasm.includes("27.46x"));
  assert.ok(svgWasm.includes("7.51x"));
  assert.ok(svgWasm.includes("4.55x"));

  const svgZeroc = renderSpeedupSvg(results.kernels, { metric: "zeroc_vs_crt" });
  assert.ok(svgZeroc.includes("4.724 ms"));
  assert.ok(svgZeroc.includes("5.706 ms"));
  assert.ok(svgZeroc.includes("5.430 ms"));
  assert.ok(svgZeroc.includes("6.998 ms"));

  const rowsHtml = renderTableRows(results.kernels);
  assert.equal((rowsHtml.match(/data-kernel-id="/g) || []).length, 8);
});

test("fail-closed planted negative controls catch tampered latency, SHA-256, or parity flag", () => {
  // Control 1: tampered Titan-1M p50_ms
  const tamperedLatency = structuredClone(results);
  tamperedLatency.kernels.find((k) => k.id === "titan_1m").buildc_native.p50_ms = 1.234;
  assert.throws(() => verifySurfaceConsistency(html, tamperedLatency), /missing buildc_native p50/);

  // Control 2: tampered parity SHA-256
  const tamperedSha = structuredClone(results);
  tamperedSha.kernels[0].parity_sha256 = "0000000000000000" + tamperedSha.kernels[0].parity_sha256.slice(16);
  assert.throws(() => verifySurfaceConsistency(html, tamperedSha), /missing parity_sha256 prefix/);

  // Control 3: parity_all_ok flipped to false
  const tamperedParity = structuredClone(results);
  tamperedParity.parity_all_ok = false;
  assert.throws(() => verifySurfaceConsistency(html, tamperedParity), /parity_all_ok/);

  // Control 4: planted_wrong_output_caught flipped to false
  const tamperedControl = structuredClone(results);
  tamperedControl.planted_control.planted_wrong_output_caught = false;
  assert.throws(() => verifySurfaceConsistency(html, tamperedControl), /planted_wrong_output_caught/);
});

test("DESIGN-RULES.md One Shell Measured Drafting Sheet and strict public hygiene", () => {
  // One Shell + Measured Drafting Sheet contract
  assert.ok(html.includes('href="/world/ui/shell/shell.css'));
  assert.ok(html.includes('href="/studies/studies.css'));
  assert.ok(html.includes('class="reading ds-sheet"'));
  assert.ok(html.includes('class="o-hand o-said"'));
  assert.ok(html.includes('id="o-menu"'));
  assert.ok(html.includes('class="ds-prov"'));
  assert.ok(!html.includes('class="gw-backdrop"'));

  // Zero external CDN calls
  const cdnRegex = /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|stackpath\.bootstrapcdn)/i;
  assert.ok(!cdnRegex.test(html), "External CDN link found in index.html");
  assert.ok(!cdnRegex.test(modSrc), "External CDN link found in benchmarks.mjs");

  // Strict hygiene across all staged public files
  const summaryText = readFileSync(summaryPath, "utf8");
  for (const [label, text] of [
    ["index.html", html],
    ["benchmarks.mjs", modSrc],
    ["benchmarks_v2_receipt_summary.json", summaryText],
  ]) {
    assert.ok(!text.includes("\u2014"), `${label}: em dash found`);
    assert.ok(!text.includes("\u2013"), `${label}: en dash found`);
    assert.ok(!/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(text), `${label}: local path found`);
    assert.ok(!/zentropy|DS-08|isomorph/i.test(text), `${label}: forbidden token found`);
  }

  // Honest CreateProcess ~5 ms disclosure present
  assert.ok(html.includes("CreateProcess"));
  assert.ok(html.includes("~4.7 to 5.7 ms"));
});
