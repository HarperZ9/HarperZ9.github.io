// gpu_explorer.mjs: pure ESM browser/Node runtime for /playground/gpu-compute/
// Zero Node imports, zero CDN fetches, fail-closed WebCrypto SHA-256 verification
// for gpu_explorer_manifest.json indexing 560 certified 5-backend BuildLang shaders.

export const EXPECTED_SCHEMA = "gpu-compute-explorer/1";
export const EXPECTED_KERNELS = 112;
export const EXPECTED_SHADERS = 560;
export const EXPECTED_REWRITES = 4009;
export const EXPECTED_BYTES = 2329296;
export const TARGETS = ["wgsl", "hlsl", "msl", "spirv", "glsl"];

export const DOMAIN_LABELS = {
  "rendering-pbr": "Rendering & PBR",
  "titan-ai-rlvr": "Titan AI & RLVR",
  "physics-sci-frontier": "Physics, Sci & Frontier",
};

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sha256Hex(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPinnedManifest(rawBytes, expectedSha256) {
  const actualSha = await sha256Hex(rawBytes);
  if (actualSha !== String(expectedSha256 || "").toLowerCase()) {
    throw new Error(`gpu_explorer_manifest.json SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha}`);
  }
  const data = JSON.parse(new TextDecoder("utf-8").decode(rawBytes));
  if (data.schema !== EXPECTED_SCHEMA) {
    throw new Error(`Unexpected manifest schema: ${data.schema}`);
  }
  if (data.unique_kernels !== EXPECTED_KERNELS || !Array.isArray(data.kernels) || data.kernels.length !== EXPECTED_KERNELS) {
    throw new Error(`Expected ${EXPECTED_KERNELS} kernels, got ${data.kernels?.length}`);
  }
  if (data.total_certified_shaders !== EXPECTED_SHADERS) {
    throw new Error(`Expected ${EXPECTED_SHADERS} certified shaders, got ${data.total_certified_shaders}`);
  }
  if (data.total_superopt_rewrites !== EXPECTED_REWRITES || data.total_shader_bytes !== EXPECTED_BYTES) {
    throw new Error(`Manifest totals mismatch: rewrites=${data.total_superopt_rewrites} bytes=${data.total_shader_bytes}`);
  }
  for (const k of data.kernels) {
    for (const t of TARGETS) {
      const e = k.backends?.[t];
      if (!e || e.verify_cert !== "PASS" || !/^[0-9a-f]{64}$/.test(e.cert_sha256 || "")) {
        throw new Error(`Invalid cert entry for ${k.kernel}/${t}`);
      }
    }
  }
  return data;
}

export async function runFailClosedSelfTest(rawBytes, expectedSha256, manifest) {
  const results = [];
  // Control 1: 1-byte manifest tamper
  const b1 = new Uint8Array(rawBytes);
  b1[0] ^= 0x20;
  let caught1 = false;
  try { await verifyPinnedManifest(b1, expectedSha256); } catch (e) { caught1 = /SHA-256 mismatch/.test(e.message); }
  results.push({ id: "ctrl_manifest_tamper", caught: caught1, detail: "1-byte manifest flip trapped by WebCrypto SHA-256" });

  // Control 2: Forged cert digest inside valid JSON
  const forgedCert = structuredClone(manifest);
  forgedCert.kernels[0].backends.wgsl.cert_sha256 = "deadbeef";
  const b2 = new TextEncoder().encode(JSON.stringify(forgedCert));
  const sha2 = await sha256Hex(b2);
  let caught2 = false;
  try { await verifyPinnedManifest(b2, sha2); } catch (e) { caught2 = /Invalid cert entry/.test(e.message); }
  results.push({ id: "ctrl_cert_digest", caught: caught2, detail: "Forged shader cert SHA-256 trapped fail-closed" });

  // Control 3: Truncated kernel list with matching digest
  const trunc = structuredClone(manifest);
  trunc.kernels = trunc.kernels.slice(0, 111);
  const b3 = new TextEncoder().encode(JSON.stringify(trunc));
  const sha3 = await sha256Hex(b3);
  let caught3 = false;
  try { await verifyPinnedManifest(b3, sha3); } catch (e) { caught3 = /Expected 112 kernels/.test(e.message); }
  results.push({ id: "ctrl_truncated_pack", caught: caught3, detail: "Truncated 111/112 kernel manifest trapped fail-closed" });

  return { ok: results.every((r) => r.caught), caught: results.filter((r) => r.caught).length, total: results.length, results };
}

export function filterKernels(kernels, { domain = "all", batch = "all", backend = "all", query = "" }) {
  const q = String(query || "").trim().toLowerCase();
  return kernels.filter((k) => {
    if (domain !== "all" && k.domain !== domain) return false;
    if (batch !== "all" && k.batch !== batch) return false;
    if (backend !== "all" && !k.backends[backend]) return false;
    if (q) {
      const hay = `${k.kernel} ${k.batch} ${k.domain} ${k.subgroup_intrinsic} ${k.validator_summary}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function renderKernelRows(kernels, backend = "all") {
  return kernels.map((k) => {
    const rw = backend === "all" ? k.total_rewrites : k.backends[backend].rewrites;
    const bytes = backend === "all" ? k.total_bytes : k.backends[backend].shader_bytes;
    const sha = backend === "all" ? k.backends.wgsl.cert_sha256.slice(0, 12) : k.backends[backend].cert_sha256.slice(0, 12);
    const val = backend === "all" ? k.validator_summary : k.backends[backend].external_validator;
    return `        <tr data-kernel="${esc(k.kernel)}" data-domain="${esc(k.domain)}" data-batch="${esc(k.batch)}">
          <td class="mono"><strong>${esc(k.kernel)}</strong><span class="gpu-sub">${esc(k.batch)}</span></td>
          <td>${esc(DOMAIN_LABELS[k.domain] || k.domain)}</td>
          <td class="mono" data-k-rw="${esc(k.kernel)}">${rw}</td>
          <td class="mono" data-k-bytes="${esc(k.kernel)}">${bytes.toLocaleString("en-US")} B</td>
          <td class="mono" data-k-val="${esc(k.kernel)}">PASS (${esc(sha)}...)<span class="gpu-sub">${esc(val)}</span></td>
        </tr>`;
  }).join("\n");
}

export function renderBatchRows(batches) {
  return batches.map((b) => `        <tr data-batch-row="${esc(b.id)}">
          <td class="mono"><strong>${esc(b.id)}</strong></td>
          <td>${esc(DOMAIN_LABELS[b.domain] || b.domain)}</td>
          <td class="mono">${b.kernels}</td>
          <td class="mono">${b.shaders}</td>
          <td class="mono">${b.rewrites}</td>
          <td class="mono">${b.bytes.toLocaleString("en-US")} B</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (/data-copy\s*=/.test(html)) throw new Error("Forbidden [data-copy] attribute present");
  if (/https?:\/\/(cdn\.|unpkg\.|jsdelivr|fonts\.googleapis)/i.test(html)) throw new Error("Forbidden CDN URL present");
  if (/[A-Za-z]:\\|\/Users\/|\.\.\/2026-11/i.test(html)) throw new Error("Forbidden local path leaked in HTML");
  if (!html.includes("560") || !html.includes("4,009")) throw new Error("Missing key 560-shader / 4,009-rewrite totals");
  for (const b of manifest.batches) {
    if (!html.includes(b.id)) throw new Error(`Missing batch ID ${b.id}`);
  }
}

async function initBrowser() {
  const meta = document.querySelector('meta[name="gpu-manifest-sha256"]');
  const statusEl = document.querySelector("#gpu-status");
  const tamperEl = document.querySelector("#gpu-tamper-out");
  if (!meta || !statusEl || !tamperEl) return;

  const expectedSha = meta.getAttribute("content") || "";
  let raw;
  let manifest;
  try {
    const resp = await fetch("./gpu_explorer_manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching gpu_explorer_manifest.json`);
    raw = new Uint8Array(await resp.arrayBuffer());
    manifest = await verifyPinnedManifest(raw, expectedSha);
  } catch (err) {
    statusEl.textContent = `FAIL-CLOSED: ${err.message}`;
    document.documentElement.dataset.gpuReady = "error";
    return;
  }

  const byName = new Map(manifest.kernels.map((k) => [k.kernel, k]));
  const batchSel = document.querySelector("#gpu-batch");
  const backendSel = document.querySelector("#gpu-backend");
  const searchInp = document.querySelector("#gpu-search");
  const resetBtn = document.querySelector("#gpu-reset");
  const tamperBtn = document.querySelector("#gpu-tamper-btn");
  const emptyEl = document.querySelector("#gpu-empty");
  const pills = [...document.querySelectorAll("button.gpu-pill[data-domain]")];
  const state = { domain: "all", batch: "all", backend: "all", query: "", tamperRuns: 0, lastTamper: null };
  window.__GPU_STATE = state;

  function applyFilters() {
    const matched = filterKernels(manifest.kernels, state);
    const keep = new Set(matched.map((k) => k.kernel));
    const bk = state.backend;
    let shaderCount = 0;
    let rwSum = 0;
    let byteSum = 0;
    for (const tr of document.querySelectorAll("tr[data-kernel]")) {
      const name = tr.dataset.kernel;
      const show = keep.has(name);
      tr.hidden = !show;
      if (show) {
        const k = byName.get(name);
        const rw = bk === "all" ? k.total_rewrites : k.backends[bk].rewrites;
        const bytes = bk === "all" ? k.total_bytes : k.backends[bk].shader_bytes;
        const sha = bk === "all" ? k.backends.wgsl.cert_sha256.slice(0, 12) : k.backends[bk].cert_sha256.slice(0, 12);
        const val = bk === "all" ? k.validator_summary : k.backends[bk].external_validator;
        shaderCount += bk === "all" ? 5 : 1;
        rwSum += rw;
        byteSum += bytes;
        const rwCell = tr.querySelector("[data-k-rw]");
        const bCell = tr.querySelector("[data-k-bytes]");
        const vCell = tr.querySelector("[data-k-val]");
        if (rwCell) rwCell.textContent = String(rw);
        if (bCell) bCell.textContent = `${bytes.toLocaleString("en-US")} B`;
        if (vCell) vCell.innerHTML = `PASS (${esc(sha)}...)<span class="gpu-sub">${esc(val)}</span>`;
      }
    }
    if (emptyEl) emptyEl.hidden = matched.length > 0;
    const bkLabel = bk === "all" ? "all 5 backends" : bk.toUpperCase();
    statusEl.textContent = `Showing ${matched.length}/112 pure-MIT kernels (${shaderCount} certified shaders on ${bkLabel}, batch: ${state.batch}, ${rwSum.toLocaleString("en-US")} Superopt V6 rewrites, ${byteSum.toLocaleString("en-US")} B).`;
  }

  for (const p of pills) {
    p.addEventListener("click", () => {
      state.domain = p.dataset.domain;
      for (const b of pills) {
        const active = b === p;
        b.dataset.active = active ? "1" : "0";
        b.setAttribute("aria-pressed", active ? "true" : "false");
      }
      applyFilters();
    });
  }

  batchSel.addEventListener("change", () => { state.batch = batchSel.value; applyFilters(); });
  backendSel.addEventListener("change", () => { state.backend = backendSel.value; applyFilters(); });
  searchInp.addEventListener("input", () => { state.query = searchInp.value; applyFilters(); });
  resetBtn.addEventListener("click", () => {
    state.domain = "all"; state.batch = "all"; state.backend = "all"; state.query = "";
    batchSel.value = "all"; backendSel.value = "all"; searchInp.value = "";
    for (const b of pills) {
      const active = b.dataset.domain === "all";
      b.dataset.active = active ? "1" : "0";
      b.setAttribute("aria-pressed", active ? "true" : "false");
    }
    applyFilters();
  });

  tamperBtn.addEventListener("click", async () => {
    const res = await runFailClosedSelfTest(raw, expectedSha, manifest);
    state.tamperRuns++;
    state.lastTamper = res;
    tamperEl.textContent = `Live WebCrypto fail-closed tamper test: ${res.caught}/${res.total} planted controls blocked (` +
      res.results.map((r) => `${r.id}=${r.caught ? "BLOCKED" : "FAIL"}`).join(", ") + `).`;
  });

  applyFilters();
  tamperEl.textContent = `Manifest SHA-256 verified (${expectedSha.slice(0, 16)}...): 560/560 certified shaders, 0 cert failures. Click "Run Fail-Closed Tamper Test" to verify 3 live controls.`;
  document.documentElement.dataset.gpuReady = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBrowser);
  else initBrowser();
}
