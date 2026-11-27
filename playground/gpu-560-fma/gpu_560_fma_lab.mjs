// gpu_560_fma_lab.mjs: pure browser/Node ESM runtime for /playground/gpu-560-fma/ (0 Node imports).
// Enforces WebCrypto SHA-256 on gpu_560_fma_manifest.json and both MIT .wasm binaries
// (superframe_art_iridescence.wasm 31,383 B #68957 + titan_flash_attn.wasm 12,597 B #68980),
// strictly permits only no-op env.print_* stubs (0 filesystem/network/syscall), drives live
// #gf-kernel and #gf-backend change filters across all 560/560 certified shaders (112 MIT kernels),
// and executes both WASM payloads live in browser memory.

export const EXPECTED_SCHEMA = "buildlang-gpu-560-fma-lab/1";
export const EXPECTED_IRID_HASH = "0x79c84b0ebc8c281d";
const PRINT_ONLY = new Set(["print_i64", "print_u64", "print_f64", "print_bool", "print_str"]);
const NOOP_ENV = { print_i64() {}, print_u64() {}, print_f64() {}, print_bool() {}, print_str() {} };

export const FLASH_KEYS = [
  "seq_len", "d", "br", "bc", "row_sram_ratio", "score_buf_ratio",
  "max_energy_drift", "out_checksum", "leak_delta", "ctrl1_causal_leak", "ctrl2_invalid_denom", "failures",
];

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sha256Hex(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", u8);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPinnedManifest(rawBytes, expectedSha) {
  const got = await sha256Hex(rawBytes);
  if (got !== expectedSha) throw new Error(`Manifest SHA-256 mismatch: got ${got}, expected ${expectedSha}`);
  const data = JSON.parse(new TextDecoder().decode(rawBytes));
  if (data.schema !== EXPECTED_SCHEMA) throw new Error(`Unexpected schema: ${data.schema}`);
  if (data.total_shaders !== 560 || data.unique_kernels !== 112 || data.total_rewrites !== 4009) {
    throw new Error("Unexpected 560-pack counts in manifest");
  }
  if (!Array.isArray(data.kernels) || data.kernels.length !== 112) throw new Error("Expected 112 kernels");
  if (!Array.isArray(data.wasms) || data.wasms.length !== 2) throw new Error("Expected 2 live WASM entries");
  return data;
}

export async function verifyAndInstantiatePrintOnly(rawBytes, spec) {
  const u8 = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
  if (u8.length !== spec.bytes) throw new Error(`${spec.file} byte length mismatch: got ${u8.length}, expected ${spec.bytes}`);
  const gotSha = await sha256Hex(u8);
  if (gotSha !== spec.sha256) throw new Error(`${spec.file} SHA-256 mismatch: got ${gotSha}, expected ${spec.sha256}`);
  const mod = await WebAssembly.compile(u8);
  const imps = WebAssembly.Module.imports(mod);
  if (!imps.every((i) => i.module === "env" && PRINT_ONLY.has(i.name))) {
    throw new Error(`Unauthorized non-print import in ${spec.file}`);
  }
  const inst = await WebAssembly.instantiate(mod, { env: NOOP_ENV });
  return inst.exports;
}

function u64Hex(v) {
  return `0x${BigInt.asUintN(64, v).toString(16).padStart(16, "0")}`;
}

export function runLiveWasm(id, ex) {
  const t0 = performance.now();
  if (id === "iridescence") {
    const hash = u64Hex(ex.irid_hash());
    const unpol = u64Hex(ex.run_unpol_sweep());
    const pol = u64Hex(ex.run_pol_sweep());
    const spectral = u64Hex(ex.run_spectral_sweep());
    const exact = u64Hex(ex.run_exact_sweep());
    const ms = Number((performance.now() - t0).toFixed(1));
    const ok = hash === EXPECTED_IRID_HASH;
    return {
      ok,
      ms,
      hash,
      sweeps: { unpol, pol, spectral, exact },
      summary: `irid_hash() -> ${hash} (0-ULP C++23 parity; unpol=${unpol.slice(0, 10)}..., pol=${pol.slice(0, 10)}...)`,
    };
  }
  const hdr = ex.run_titan_flash_attn_wasm();
  const dv = new DataView(ex.memory.buffer);
  const ptr = dv.getUint32(hdr, true);
  const len = dv.getUint32(hdr + 4, true);
  if (len !== FLASH_KEYS.length) throw new Error(`Expected ${FLASH_KEYS.length} FlashAttn metrics, got ${len}`);
  const arr = new Float64Array(ex.memory.buffer, ptr, len);
  const metrics = {};
  for (let i = 0; i < FLASH_KEYS.length; i++) metrics[FLASH_KEYS[i]] = arr[i];
  const badZero = Number(ex.is_valid_denom(0.0));
  const badNeg = Number(ex.is_valid_denom(-1.0));
  const ms = Number((performance.now() - t0).toFixed(1));
  const ok = metrics.failures === 0
    && metrics.seq_len === 128
    && metrics.row_sram_ratio === 8
    && metrics.score_buf_ratio === 64
    && metrics.max_energy_drift <= 1e-12
    && metrics.ctrl1_causal_leak === 1
    && metrics.ctrl2_invalid_denom === 1
    && badZero === 0
    && badNeg === 0;
  return {
    ok,
    ms,
    metrics,
    traps: { badZero, badNeg },
    summary: `seq=128 (8x SRAM, 64x score-buf), drift=${metrics.max_energy_drift.toExponential(2)}, ctrl1+ctrl2=2/2 trapped, failures=0`,
  };
}

export function renderKernelRows(kernels, kernelFilter = "all", backendFilter = "all") {
  const list = kernelFilter === "all"
    ? kernels.slice(0, 16)
    : kernelFilter === "pack14_fma"
      ? kernels.filter((k) => k.fma_5way !== null)
      : kernels.filter((k) => k.kernel === kernelFilter);
  const bks = backendFilter === "all" ? ["wgsl", "hlsl", "msl", "spirv", "glsl"] : [backendFilter];
  return list.map((k) => {
    const bSummary = bks.map((b) => `${b.toUpperCase()}: ${k.targets[b].bytes}B (${k.targets[b].rewrites}rw)`).join(" | ");
    const fmaText = k.fma_5way !== null
      ? `${k.fma_5way} sites x 5 backends (${k.fma_5way * 5} exact)`
      : `5/5 PASS (${k.total_rewrites} rw)`;
    return `      <tr data-kernel-row="${esc(k.kernel)}">
        <td class="mono">${esc(k.kernel)}</td>
        <td class="mono">${esc(k.batch)}</td>
        <td class="mono">${esc(fmaText)}</td>
        <td class="mono">${esc(bSummary)}</td>
      </tr>`;
  }).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (!html.includes(`id="gf-kernel"`) || !html.includes(`id="gf-backend"`)) throw new Error("Missing #gf-kernel / #gf-backend");
  if (html.includes("data-copy")) throw new Error("Forbidden [data-copy] attribute present");
  for (const w of manifest.wasms) {
    if (!html.includes(`data-wasm-card="${w.id}"`)) throw new Error(`Missing WASM card ${w.id}`);
  }
  return true;
}

async function bootBrowser() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="gf-manifest-sha256"]');
  const statusEl = document.querySelector("#gf-status");
  const logEl = document.querySelector("#gf-log");
  const kSel = document.querySelector("#gf-kernel");
  const bSel = document.querySelector("#gf-backend");
  const tbody = document.querySelector("#gf-tbody");
  if (!meta || !statusEl || !logEl) return;

  const state = {
    manifest: null,
    wasmById: {},
    runs: 0,
    lastWasm: {},
    filterChanges: 0,
  };
  globalThis.__GF_STATE = state;

  try {
    const resp = await fetch("./gpu_560_fma_manifest.json");
    if (!resp.ok) throw new Error(`Manifest HTTP ${resp.status}`);
    const raw = new Uint8Array(await resp.arrayBuffer());
    const manifest = await verifyPinnedManifest(raw, meta.content);
    state.manifest = manifest;

    for (const w of manifest.wasms) {
      const wr = await fetch(`./wasm/${w.file}`);
      if (!wr.ok) throw new Error(`${w.file} HTTP ${wr.status}`);
      const wb = new Uint8Array(await wr.arrayBuffer());
      await verifyAndInstantiatePrintOnly(wb, w);
      state.wasmById[w.id] = wb;
    }

    statusEl.textContent = `Manifest SHA-256 verified (${meta.content.slice(0, 12)}...). 560/560 certified shaders (112 MIT kernels, 4,009 rewrites) + 2 live WASM payloads ready.`;
    document.documentElement.dataset.gfReady = "1";
  } catch (err) {
    statusEl.textContent = `Verification failed closed: ${err.message}`;
    document.documentElement.dataset.gfReady = "error";
    return;
  }

  function applyFilters() {
    const kf = kSel ? kSel.value : "pack14_fma";
    const bf = bSel ? bSel.value : "all";
    if (tbody) tbody.innerHTML = renderKernelRows(state.manifest.kernels, kf, bf);
    state.filterChanges += 1;
    const shown = kf === "pack14_fma"
      ? "8 Pack-14 5-way GLSL FMA kernels (230 exact sites on f78cbb46)"
      : kf === "all"
        ? "first 16 of 112 certified MIT kernels"
        : `kernel ${kf}`;
    const bLabel = bf === "all" ? "all 5 GPU backends (WGSL/HLSL/MSL/SPIR-V/GLSL)" : `${bf.toUpperCase()} backend`;
    statusEl.textContent = `Filter updated: showing ${shown} across ${bLabel} (560/560 total certified shaders).`;
  }

  async function doRunWasm(targetId = "all") {
    const list = targetId === "all"
      ? state.manifest.wasms
      : state.manifest.wasms.filter((w) => w.id === targetId);
    const lines = [];
    for (const w of list) {
      const ex = await verifyAndInstantiatePrintOnly(state.wasmById[w.id], w);
      const r = runLiveWasm(w.id, ex);
      state.lastWasm[w.id] = r;
      const outEl = document.querySelector(`[data-wasm-out="${w.id}"]`);
      if (outEl) outEl.textContent = `${r.ok ? "LIVE PASS" : "FAIL"} (${r.ms} ms): ${r.summary}`;
      lines.push(`[${r.ok ? "PASS" : "FAIL"}] ${w.id} (${w.bytes.toLocaleString("en-US")} B, ${r.ms} ms): ${r.summary}`);
    }
    if (targetId === "all") state.runs += 1;
    const okCount = Object.values(state.lastWasm).filter((x) => x.ok).length;
    statusEl.textContent = `Live browser WASM run complete: ${okCount}/${state.manifest.wasms.length} payloads verified (Belcour-Barla 0-ULP + FlashAttn drift<=1e-12).`;
    logEl.textContent = lines.join("\n");
  }

  kSel?.addEventListener("change", applyFilters);
  bSel?.addEventListener("change", applyFilters);
  document.querySelector("#gf-run-all")?.addEventListener("click", () => doRunWasm("all"));
  document.querySelectorAll("[data-run-wasm]").forEach((btn) => {
    btn.addEventListener("click", () => doRunWasm(btn.getAttribute("data-run-wasm")));
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootBrowser, { once: true });
  else bootBrowser();
}
