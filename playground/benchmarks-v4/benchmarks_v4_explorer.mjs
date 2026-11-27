// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Zero-dependency browser and Node ES module for /playground/benchmarks-v4/.
// Verifies the pinned SHA-256 of benchmarks_v4_manifest.json before hydrating interactive
// category, tier, and search filters across all 20 workloads and 57 runtime cells.

export const CATEGORY_LABELS = {
  "crypto-tls": "Crypto and TLS",
  "buildos-zeroc": "Zero-C BuildOS",
  "ai-surpass": "AI and Surpass",
  "graphics-graph": "Graphics and Graph",
};

export const TIER_LABELS = {
  v2_canonical: "V2 canonical",
  v3_frontier: "V3 frontier",
  v4_frontier: "V4 frontier",
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sha256Hex(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPinnedBenchmarks(rawBytes, expectedSha256) {
  const actual = await sha256Hex(rawBytes);
  if (actual !== expectedSha256) {
    const err = new Error(`manifest SHA-256 mismatch: expected ${expectedSha256}, got ${actual}`);
    err.code = "sha256_mismatch";
    throw err;
  }
  const text = typeof rawBytes === "string" ? rawBytes : new TextDecoder().decode(rawBytes);
  const data = JSON.parse(text);
  if (data.schema !== "benchmarks-v4-explorer/1") {
    const err = new Error(`unexpected manifest schema: ${data.schema}`);
    err.code = "bad_schema";
    throw err;
  }
  if (!Array.isArray(data.workloads) || data.workloads.length !== 20) {
    const err = new Error(`expected 20 workloads, got ${data.workloads?.length}`);
    err.code = "bad_workload_count";
    throw err;
  }
  return { sha256: actual, data };
}

export function filterWorkloads(workloads, { category = "all", tier = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return workloads.filter((w) => {
    if (category !== "all" && w.category !== category) return false;
    if (tier !== "all" && w.tier !== tier) return false;
    if (q) {
      const hay = [w.id, w.name, w.category, w.tier, w.idea_id, w.parity_sha256].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function fmtMs(val) {
  return typeof val === "number" ? `${val.toFixed(2)} ms` : "n/a";
}

export function fmtSpeedup(val) {
  return typeof val === "number" ? `${val.toFixed(2)}x` : "n/a";
}

export function renderWorkloadRows(workloads) {
  return workloads.map((w) => `        <tr data-workload="${esc(w.id)}" data-category="${esc(w.category)}" data-tier="${esc(w.tier)}">
          <th scope="row">${esc(w.name)}<span class="bv-sub">${esc(w.id)} | ${esc(CATEGORY_LABELS[w.category] || w.category)} | ${esc(TIER_LABELS[w.tier] || w.tier)}</span></th>
          <td class="mono">${fmtMs(w.python_p50_ms)}</td>
          <td class="mono">${fmtMs(w.native_p50_ms)}<span class="bv-sub">${fmtSpeedup(w.native_speedup)}</span></td>
          <td class="mono">${fmtMs(w.wasm_p50_ms)}<span class="bv-sub">${fmtSpeedup(w.wasm_speedup)}</span></td>
          <td class="mono">${fmtMs(w.zeroc_pe_p50_ms)}<span class="bv-sub">${w.runtime_count} cells</span></td>
          <td class="mono" title="${esc(w.parity_sha256)}">PASS ${esc(w.parity_sha256.slice(0, 8))}</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, data) {
  const rows = (html.match(/<tr data-workload="/g) || []).length;
  if (rows !== data.workloads.length) throw new Error(`workload rows ${rows} != ${data.workloads.length}`);
  for (const w of data.workloads) {
    if (!html.includes(`data-workload="${w.id}"`)) throw new Error(`missing workload ${w.id}`);
  }
  return { ok: true, rows };
}

async function hydrate(doc) {
  const q = (sel) => doc.querySelector(sel);
  const status = q("#bv-status");
  const digest = q("#bv-digest");
  const tierSel = q("#bv-tier");
  const searchIn = q("#bv-search");
  const resetBtn = q("#bv-reset");
  const emptyNote = q("#bv-empty");
  const fail = (msg) => { status.textContent = `FAIL CLOSED: ${msg}`; doc.documentElement.dataset.benchReady = "fail"; };
  try {
    const res = await fetch(new URL("benchmarks_v4_manifest.json", new URL("./", doc.baseURI)));
    if (!res.ok) throw new Error(`fetch benchmarks_v4_manifest.json failed (${res.status})`);
    const raw = await res.arrayBuffer();
    const pinned = (q('meta[name="benchmarks-v4-sha256"]') || {}).content || "";
    const { sha256, data } = await verifyPinnedBenchmarks(raw, pinned);
    const rowsById = new Map([...doc.querySelectorAll("tr[data-workload]")].map((tr) => [tr.dataset.workload, tr]));
    digest.textContent = `Manifest SHA-256: ${sha256.slice(0, 23)}... | ${data.summary.total_workloads} workloads, ${data.summary.total_measured_runtime_cells} runtime cells, receipt #${data.receipt_catalogue_id}`;

    let activeCat = "all";
    const apply = () => {
      const shown = filterWorkloads(data.workloads, { category: activeCat, tier: tierSel.value, query: searchIn.value });
      const shownIds = new Set(shown.map((w) => w.id));
      for (const [id, tr] of rowsById.entries()) tr.hidden = !shownIds.has(id);
      const cells = shown.reduce((n, w) => n + w.runtime_count, 0);
      status.textContent = `Showing ${shown.length}/${data.workloads.length} workloads (${cells}/${data.summary.total_measured_runtime_cells} runtime cells) | Tier: ${tierSel.value} | Parity: ${shown.length}/${shown.length} PASS`;
      emptyNote.hidden = shown.length > 0;
      for (const btn of doc.querySelectorAll("button.bv-pill")) {
        const active = btn.dataset.category === activeCat;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.dataset.active = active ? "1" : "0";
      }
      doc.documentElement.dataset.benchVisible = String(shown.length);
    };

    for (const btn of doc.querySelectorAll("button.bv-pill")) {
      btn.addEventListener("click", () => { activeCat = btn.dataset.category; apply(); });
    }
    tierSel.addEventListener("change", apply);
    searchIn.addEventListener("input", apply);
    resetBtn.addEventListener("click", () => {
      activeCat = "all";
      tierSel.value = "all";
      searchIn.value = "";
      apply();
    });
    apply();
    doc.documentElement.dataset.benchReady = "1";
  } catch (err) {
    fail(String(err.message || err));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate(document));
  else hydrate(document);
}
