// SPDX-FileCopyrightText: 2026 Zain Dana Harper and the Portfolio Site contributors
// SPDX-License-Identifier: MIT
//
// Zero-dependency browser and Node ES module for /playground/datasets/.
// Verifies the pinned SHA-256 of datasets_manifest.json before hydrating interactive
// category (15 BuildDB V6 categories), group, and search filters.

export const GROUP_LABELS = {
  "kernels-certs": "Kernels and Certs",
  "os-bench-sbom": "OS, Bench and SBOM",
  "rlvr-signals-papers": "RLVR, Signals and Papers",
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

export async function verifyPinnedDatasets(rawBytes, expectedSha256) {
  const actual = await sha256Hex(rawBytes);
  if (actual !== expectedSha256) {
    const err = new Error(`manifest SHA-256 mismatch: expected ${expectedSha256}, got ${actual}`);
    err.code = "sha256_mismatch";
    throw err;
  }
  const text = typeof rawBytes === "string" ? rawBytes : new TextDecoder().decode(rawBytes);
  const data = JSON.parse(text);
  if (data.schema !== "open-mit-datasets-explorer/2") {
    const err = new Error(`unexpected manifest schema: ${data.schema}`);
    err.code = "bad_schema";
    throw err;
  }
  if (!Array.isArray(data.record_categories) || data.record_categories.length !== 15) {
    const err = new Error(`expected 15 record categories, got ${data.record_categories?.length}`);
    err.code = "bad_category_count";
    throw err;
  }
  return { sha256: actual, data };
}

export function filterCategories(categories, { category = "all", group = "all", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  return categories.filter((c) => {
    if (category !== "all" && c.id !== category) return false;
    if (group !== "all" && c.group !== group) return false;
    if (q) {
      const hay = [c.id, c.label, c.group, c.description, String(c.receipt_id)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function renderCategoryRows(categories) {
  return categories.map((c) => `        <tr data-cat="${esc(c.id)}" data-group="${esc(c.group)}">
          <th scope="row">${esc(c.label)}<span class="ds-sub">${esc(c.id)} | ${esc(GROUP_LABELS[c.group] || c.group)}</span></th>
          <td class="mono">${c.rows}</td>
          <td class="mono">${c.share_pct.toFixed(2)}%</td>
          <td class="mono">#${c.receipt_id}</td>
          <td>${esc(c.description)}</td>
        </tr>`).join("\n");
}

export function renderRlvrRows(rlvrCats) {
  return rlvrCats.map((r) => `        <tr data-rlvr="${esc(r.id)}">
          <th scope="row" class="mono">${esc(r.id)}</th>
          <td class="mono">${r.total}</td>
          <td class="mono">${r.is_v9_new ? "V9 new" : "V8+V9"}</td>
        </tr>`).join("\n");
}

export function renderGpuBatchRows(batches) {
  return batches.map((b) => `        <tr data-gpu-batch="${esc(b.id)}">
          <th scope="row" class="mono">${esc(b.id)}</th>
          <td class="mono">${b.kernels}</td>
          <td class="mono">${b.shaders}</td>
          <td>${esc(b.scope)}</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, data) {
  const catRows = (html.match(/<tr data-cat="/g) || []).length;
  const rlvrRows = (html.match(/<tr data-rlvr="/g) || []).length;
  const gpuRows = (html.match(/<tr data-gpu-batch="/g) || []).length;
  if (catRows !== data.record_categories.length) throw new Error(`cat rows ${catRows} != ${data.record_categories.length}`);
  if (rlvrRows !== data.rlvr_v9.categories.length) throw new Error(`rlvr rows ${rlvrRows} != ${data.rlvr_v9.categories.length}`);
  if (gpuRows !== data.gpu_200pack.batches.length) throw new Error(`gpu rows ${gpuRows} != ${data.gpu_200pack.batches.length}`);
  for (const c of data.record_categories) {
    if (!html.includes(`data-cat="${c.id}"`)) throw new Error(`missing category ${c.id}`);
  }
  return { ok: true, catRows, rlvrRows, gpuRows };
}

async function hydrate(doc) {
  const q = (sel) => doc.querySelector(sel);
  const status = q("#ds-status");
  const digest = q("#ds-digest");
  const catSel = q("#ds-category");
  const searchIn = q("#ds-search");
  const resetBtn = q("#ds-reset");
  const emptyNote = q("#ds-empty");
  const fail = (msg) => { status.textContent = `FAIL CLOSED: ${msg}`; doc.documentElement.dataset.datasetsReady = "fail"; };
  try {
    const res = await fetch(new URL("datasets_manifest.json", new URL("./", doc.baseURI)));
    if (!res.ok) throw new Error(`fetch datasets_manifest.json failed (${res.status})`);
    const raw = await res.arrayBuffer();
    const pinned = (q('meta[name="datasets-manifest-sha256"]') || {}).content || "";
    const { sha256, data } = await verifyPinnedDatasets(raw, pinned);
    const rowsById = new Map([...doc.querySelectorAll("tr[data-cat]")].map((tr) => [tr.dataset.cat, tr]));
    digest.textContent = `Manifest SHA-256: ${sha256.slice(0, 23)}... | BuildDB V6 (${data.builddb_v6.total_rows} rows) + RLVR v9 (${data.rlvr_v9.total_tasks} tasks) + ${data.gpu_200pack.total_shaders} GPU shaders`;

    let activeGroup = "all";
    const apply = () => {
      const shown = filterCategories(data.record_categories, { category: catSel.value, group: activeGroup, query: searchIn.value });
      const shownIds = new Set(shown.map((c) => c.id));
      for (const [id, tr] of rowsById.entries()) tr.hidden = !shownIds.has(id);
      const rowSum = shown.reduce((n, c) => n + c.rows, 0);
      status.textContent = `Showing ${shown.length}/15 BuildDB V6 record categories (${rowSum}/${data.builddb_v6.total_rows} pure-MIT rows, 0 non-MIT) | Category: ${catSel.value}`;
      emptyNote.hidden = shown.length > 0;
      for (const btn of doc.querySelectorAll("button.ds-pill")) {
        const active = btn.dataset.group === activeGroup;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.dataset.active = active ? "1" : "0";
      }
      doc.documentElement.dataset.datasetsVisible = String(shown.length);
    };

    for (const btn of doc.querySelectorAll("button.ds-pill")) {
      btn.addEventListener("click", () => { activeGroup = btn.dataset.group; apply(); });
    }
    catSel.addEventListener("change", apply);
    searchIn.addEventListener("input", apply);
    resetBtn.addEventListener("click", () => {
      activeGroup = "all";
      catSel.value = "all";
      searchIn.value = "";
      apply();
    });
    apply();
    doc.documentElement.dataset.datasetsReady = "1";
  } catch (err) {
    fail(String(err.message || err));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate(document));
  else hydrate(document);
}
