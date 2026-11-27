// renderer_showcase.mjs: pure ESM browser/Node runtime for /playground/renderer-35/
// Zero Node imports, zero CDN fetches, fail-closed WebCrypto SHA-256 verification
// for renderer_35_manifest.json and all four 0-ULP Superframe renderer .wasm binaries.

export const EXPECTED_SCHEMA = "renderer-35-parity-showcase/1";
export const EXPECTED_MODULES = 35;
export const EXPECTED_WASM_COUNT = 4;
export const EXPECTED_WASM_BYTES = 49799;

export const COHORT_LABELS = {
  "core-1-11": "Core Scene & Sky (#1-#11)",
  "pbr-bvh-12-24": "PBR, BVH & Post (#12-#24)",
  "crt-media-25-35": "CRT, Optics & Media (#25-#35)",
};

const NOOP_ENV = {
  print_i64() {},
  print_u64() {},
  print_f64() {},
  print_bool() {},
  print_str() {},
};

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function hex64(val) {
  return `0x${BigInt.asUintN(64, BigInt(val)).toString(16).padStart(16, "0")}`;
}

export async function sha256Hex(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPinnedManifest(rawBytes, expectedSha256) {
  const actualSha = await sha256Hex(rawBytes);
  if (actualSha !== String(expectedSha256 || "").toLowerCase()) {
    throw new Error(`renderer_35_manifest.json SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha}`);
  }
  const data = JSON.parse(new TextDecoder("utf-8").decode(rawBytes));
  if (data.schema !== EXPECTED_SCHEMA) {
    throw new Error(`Unexpected manifest schema: ${data.schema}`);
  }
  if (!Array.isArray(data.modules) || data.modules.length !== EXPECTED_MODULES) {
    throw new Error(`Expected ${EXPECTED_MODULES} renderer modules, got ${data.modules?.length}`);
  }
  if (!Array.isArray(data.wasm_modules) || data.wasm_modules.length !== EXPECTED_WASM_COUNT) {
    throw new Error(`Expected ${EXPECTED_WASM_COUNT} WASM binaries, got ${data.wasm_modules?.length}`);
  }
  if (data.total_wasm_bytes !== EXPECTED_WASM_BYTES) {
    throw new Error(`Expected ${EXPECTED_WASM_BYTES} WASM bytes, got ${data.total_wasm_bytes}`);
  }
  return data;
}

export async function verifyAndInstantiateRenderer(rawBytes, spec) {
  const buf = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
  if (buf.byteLength !== spec.bytes) {
    throw new Error(`${spec.file} byte length mismatch: expected ${spec.bytes}, got ${buf.byteLength}`);
  }
  const actualSha = await sha256Hex(buf);
  if (actualSha !== spec.sha256) {
    throw new Error(`${spec.file} SHA-256 mismatch: expected ${spec.sha256}, got ${actualSha}`);
  }
  if (!WebAssembly.validate(buf)) {
    throw new Error(`${spec.file} failed WebAssembly.validate`);
  }
  const { instance } = await WebAssembly.instantiate(buf, { env: NOOP_ENV });
  return instance.exports;
}

export function runRendererParity(spec, ex, mode = 0) {
  const t0 = performance.now();
  const rawHash = ex[spec.fn_name](mode);
  const hashHex = hex64(rawHash);
  const ms = +(performance.now() - t0).toFixed(3);
  if (mode === 0) {
    const ok = hashHex === spec.expected_nominal_hash;
    return { id: spec.id, mode: 0, ok, hashHex, expected: spec.expected_nominal_hash, ms };
  }
  const rejected = hashHex === spec.expected_ablation_hash && hashHex !== spec.expected_nominal_hash;
  return { id: spec.id, mode, ok: rejected, rejected, hashHex, expected: spec.expected_ablation_hash, ms };
}

export function filterModules(modules, { cohort = "all", query = "" }) {
  const q = String(query || "").trim().toLowerCase();
  return modules.filter((m) => {
    if (cohort !== "all" && m.cohort !== cohort) return false;
    if (q) {
      const hay = `${m.num} ${m.name} ${m.cohort} ${m.fnv1a_pin} ${m.summary} ${m.receipt_id || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function renderModuleRows(modules) {
  return modules.map((m) => `        <tr data-mod-num="${m.num}" data-cohort="${esc(m.cohort)}">
          <td class="mono">#${String(m.num).padStart(2, "0")}</td>
          <td class="mono"><strong>${esc(m.name)}</strong>${m.has_live_wasm ? `<span class="ren-sub">Live WASM embedded</span>` : ""}</td>
          <td class="mono">${esc(m.fnv1a_pin)}</td>
          <td class="mono">${m.receipt_id ? `#${m.receipt_id}` : "main.bld"}</td>
          <td>${esc(m.summary)}</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (/data-copy\s*=/.test(html)) throw new Error("Forbidden [data-copy] attribute present");
  if (/https?:\/\/(cdn\.|unpkg\.|jsdelivr|fonts\.googleapis)/i.test(html)) throw new Error("Forbidden CDN URL present");
  if (/[A-Za-z]:\\|\/Users\//i.test(html)) throw new Error("Forbidden local path leaked in HTML");
  for (const w of manifest.wasm_modules) {
    if (!html.includes(w.file)) throw new Error(`Missing WASM filename ${w.file}`);
  }
  if (!html.includes("art_hatch.bld") || !html.includes("0xbd556d27b9d7c43a")) {
    throw new Error("Missing Module #35 art_hatch.bld parity pin");
  }
}

async function initBrowser() {
  const meta = document.querySelector('meta[name="renderer-35-manifest-sha256"]');
  const statusEl = document.querySelector("#ren-status");
  const logEl = document.querySelector("#ren-log");
  if (!meta || !statusEl || !logEl) return;

  const expectedSha = meta.getAttribute("content") || "";
  let manifest;
  try {
    const resp = await fetch("./renderer_35_manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching renderer_35_manifest.json`);
    const raw = new Uint8Array(await resp.arrayBuffer());
    manifest = await verifyPinnedManifest(raw, expectedSha);
  } catch (err) {
    statusEl.textContent = `FAIL-CLOSED: ${err.message}`;
    document.documentElement.dataset.renReady = "error";
    return;
  }

  const cache = new Map();
  async function loadExports(spec) {
    if (!cache.has(spec.id)) {
      const r = await fetch(`./wasm/${spec.file}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${spec.file}`);
      cache.set(spec.id, new Uint8Array(await r.arrayBuffer()));
    }
    return verifyAndInstantiateRenderer(cache.get(spec.id), spec);
  }

  const cohortSel = document.querySelector("#ren-cohort");
  const searchInp = document.querySelector("#ren-search");
  const resetBtn = document.querySelector("#ren-reset");
  const runAllBtn = document.querySelector("#ren-run-all");
  const ablateAllBtn = document.querySelector("#ren-ablate-all");
  const emptyEl = document.querySelector("#ren-empty");
  const pills = [...document.querySelectorAll("button.ren-pill[data-cohort]")];
  const state = { cohort: "all", query: "", nominalRuns: 0, ablationRuns: 0, lastNominal: {}, lastAblations: {} };
  window.__REN_STATE = state;

  async function runWasmList(specs, mode) {
    const lines = [];
    let okCount = 0;
    for (const sp of specs) {
      const ex = await loadExports(sp);
      const res = runRendererParity(sp, ex, mode);
      if (mode === 0) state.lastNominal[sp.id] = res;
      else state.lastAblations[sp.id] = res;
      if (res.ok) okCount++;
      const outEl = document.querySelector(`[data-wasm-out="${sp.id}"]`);
      if (outEl) {
        outEl.textContent = mode === 0
          ? `LIVE 0-ULP ${res.ok ? "EXACT" : "DIFF"} (${res.ms} ms): ${res.hashHex}`
          : `ABLATION ${res.rejected ? "REJECTED" : "MISSED"} (${res.ms} ms): ${res.hashHex} != ${sp.expected_nominal_hash}`;
      }
      lines.push(
        mode === 0
          ? `[0-ULP ${res.ok ? "MATCH" : "FAIL"}] ${sp.id} (${res.ms} ms): ${res.hashHex} === C++23 ${sp.expected_nominal_hash}`
          : `[ABLATION ${res.rejected ? "REJECTED" : "FAIL"}] ${sp.id} (${res.ms} ms): ${res.hashHex} != pin ${sp.expected_nominal_hash}`
      );
    }
    if (mode === 0) state.nominalRuns++;
    else state.ablationRuns++;
    logEl.textContent = lines.join("\n");
  }

  function applyFilters() {
    const matched = filterModules(manifest.modules, state);
    const keep = new Set(matched.map((m) => String(m.num)));
    for (const tr of document.querySelectorAll("tr[data-mod-num]")) {
      tr.hidden = !keep.has(tr.dataset.modNum);
    }
    if (emptyEl) emptyEl.hidden = matched.length > 0;
    statusEl.textContent = `Showing ${matched.length}/35 bit-exact 0-ULP C++23 renderer modules (4 live WASM binaries = 48.63 KB pinned via SHA-256) | Cohort: ${state.cohort}.`;
  }

  function syncPills(val) {
    for (const b of pills) {
      const active = b.dataset.cohort === val;
      b.dataset.active = active ? "1" : "0";
      b.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  for (const p of pills) {
    p.addEventListener("click", () => { state.cohort = p.dataset.cohort; cohortSel.value = state.cohort; syncPills(state.cohort); applyFilters(); });
  }
  cohortSel.addEventListener("change", () => { state.cohort = cohortSel.value; syncPills(state.cohort); applyFilters(); });
  searchInp.addEventListener("input", () => { state.query = searchInp.value; applyFilters(); });
  resetBtn.addEventListener("click", () => {
    state.cohort = "all"; state.query = ""; cohortSel.value = "all"; searchInp.value = ""; syncPills("all"); applyFilters();
  });

  runAllBtn.addEventListener("click", () => runWasmList(manifest.wasm_modules, 0));
  ablateAllBtn.addEventListener("click", () => runWasmList(manifest.wasm_modules, 1));
  for (const btn of document.querySelectorAll("button[data-run-wasm]")) {
    btn.addEventListener("click", () => runWasmList(manifest.wasm_modules.filter((w) => w.id === btn.dataset.runWasm), 0));
  }
  for (const btn of document.querySelectorAll("button[data-ablate-wasm]")) {
    btn.addEventListener("click", () => runWasmList(manifest.wasm_modules.filter((w) => w.id === btn.dataset.ablateWasm), 1));
  }

  applyFilters();
  document.documentElement.dataset.renReady = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBrowser);
  else initBrowser();
}
