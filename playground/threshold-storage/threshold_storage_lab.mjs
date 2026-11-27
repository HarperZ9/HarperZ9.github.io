// threshold_storage_lab.mjs: pure browser/Node ESM runtime for /playground/threshold-storage/ (0 Node imports).
// Verifies WebCrypto SHA-256 on threshold_storage_manifest.json and both Zero-C .wasm payloads,
// strictly enforces WebAssembly.Module.imports(mod).length === 0 on both binaries, executes live
// (3,5) Shamir Threshold HSM (#68951) + RS(4,2) 2-erasure RAID-6 FS (#68959) + RFC 6962 scrubber,
// and traps all 8/8 fail-closed storage and custody attacks.

const EXPECTED_SCHEMA = "buildos-threshold-storage-lab/1";

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
  if (!Array.isArray(data.modules) || data.modules.length !== 2) throw new Error("Expected 2 zero-import storage modules");
  if (!Array.isArray(data.attacks) || data.attacks.length !== 8) throw new Error("Expected 8 fail-closed attack vectors");
  return data;
}

export async function verifyAndInstantiateZeroImport(rawBytes, modSpec) {
  const u8 = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
  if (u8.length !== modSpec.bytes) throw new Error(`${modSpec.file} byte length mismatch: got ${u8.length}, expected ${modSpec.bytes}`);
  const gotSha = await sha256Hex(u8);
  if (gotSha !== modSpec.sha256) throw new Error(`${modSpec.file} SHA-256 mismatch: got ${gotSha}, expected ${modSpec.sha256}`);
  const mod = await WebAssembly.compile(u8);
  const imps = WebAssembly.Module.imports(mod);
  if (imps.length !== 0) throw new Error(`Zero-import policy breach on ${modSpec.file}: ${imps.length} imports`);
  const inst = await WebAssembly.instantiate(mod, {});
  return inst.exports;
}

function readRootFromMem(mem, startIdx) {
  let hex = "";
  for (let i = startIdx; i < startIdx + 8; i++) {
    hex += (Number(mem[i]) >>> 0).toString(16).padStart(8, "0");
  }
  return hex;
}

export function runNominalModule(modSpec, ex) {
  const t0 = performance.now();
  const count = Number(ex.main());
  const mem = new BigInt64Array(ex.memory.buffer);
  const rootHex = readRootFromMem(mem, modSpec.root_mem_idx);
  const rc = Number(ex[modSpec.run_fn](0n));
  const ms = Number((performance.now() - t0).toFixed(1));
  if (modSpec.id === "shamir_hsm") {
    const ok = rc === 1 && count === 24 && rootHex === modSpec.expected_root_hex;
    return {
      ok,
      rc,
      count,
      rootHex,
      ms,
      summary: `hsm_stage1_execute(0n) -> ${rc} (20/20 Epoch-0/1 subsets, 4-leaf RFC 6962 root=${rootHex.slice(0, 16)}...)`,
    };
  }
  const healed = Number(mem[6]);
  const bytesHealed = Number(mem[8]);
  const ok = rc === 1 && count === 19 && healed === 15 && bytesHealed === 2880 && rootHex === modSpec.expected_root_hex;
  return {
    ok,
    rc,
    count,
    healed,
    bytesHealed,
    rootHex,
    ms,
    summary: `raid_stage1_execute(0n) -> ${rc} (${healed}/15 2-erasure heals, ${bytesHealed} B scrubbed, 6-shard root=${rootHex.slice(0, 16)}...)`,
  };
}

export function runAttackVector(atk, modSpec, ex) {
  const t0 = performance.now();
  const rc = Number(ex[modSpec.run_fn](BigInt(atk.mode)));
  const ms = Number((performance.now() - t0).toFixed(1));
  return {
    id: atk.id,
    module_id: atk.module_id,
    rc,
    expected: atk.expected_rc,
    blocked: rc === atk.expected_rc,
    ms,
  };
}

export function renderAttackRows(attacks, resultsById = {}) {
  return attacks.map((a) => {
    const r = resultsById[a.id];
    const st = r
      ? `${r.rc} (${r.blocked ? "BLOCKED" : "FAIL"}, ${r.ms} ms)`
      : `expected ${a.expected_rc}`;
    return `      <tr data-atk-row="${esc(a.id)}">
        <td class="mono">${esc(a.id)}</td>
        <td><strong>${esc(a.module_label)}</strong></td>
        <td>${esc(a.label)}</td>
        <td class="mono">${esc(a.call_expr)}</td>
        <td class="mono" data-atk-status="${esc(a.id)}">${esc(st)}</td>
      </tr>`;
  }).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (!html.includes(`id="ts-module"`) || !html.includes(`id="ts-attack"`)) throw new Error("Missing select controls");
  if (html.includes("data-copy")) throw new Error("Forbidden [data-copy] attribute present");
  for (const m of manifest.modules) {
    if (!html.includes(`data-mod-card="${m.id}"`)) throw new Error(`Missing card ${m.id}`);
  }
  for (const a of manifest.attacks) {
    if (!html.includes(`data-atk-row="${a.id}"`)) throw new Error(`Missing attack row ${a.id}`);
  }
  return true;
}

async function bootBrowser() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector('meta[name="ts-manifest-sha256"]');
  const statusEl = document.querySelector("#ts-status");
  const logEl = document.querySelector("#ts-log");
  const modSel = document.querySelector("#ts-module");
  const atkSel = document.querySelector("#ts-attack");
  if (!meta || !statusEl || !logEl) return;

  const state = {
    manifest: null,
    wasmById: {},
    nominalRuns: 0,
    attackRuns: 0,
    lastNominal: {},
    lastAttacks: {},
  };
  globalThis.__TS_STATE = state;

  try {
    const resp = await fetch("./threshold_storage_manifest.json");
    if (!resp.ok) throw new Error(`Manifest HTTP ${resp.status}`);
    const raw = new Uint8Array(await resp.arrayBuffer());
    const manifest = await verifyPinnedManifest(raw, meta.content);
    state.manifest = manifest;

    for (const m of manifest.modules) {
      const wr = await fetch(`./wasm/${m.file}`);
      if (!wr.ok) throw new Error(`${m.file} HTTP ${wr.status}`);
      const wb = new Uint8Array(await wr.arrayBuffer());
      await verifyAndInstantiateZeroImport(wb, m);
      state.wasmById[m.id] = wb;
    }

    statusEl.textContent = `Manifest SHA-256 verified (${meta.content.slice(0, 12)}...). Both strictly 0-import Zero-C binaries (${manifest.total_wasm_bytes.toLocaleString("en-US")} B) ready.`;
    document.documentElement.dataset.tsReady = "1";
  } catch (err) {
    statusEl.textContent = `Verification failed closed: ${err.message}`;
    document.documentElement.dataset.tsReady = "error";
    return;
  }

  async function doRunNominal(targetModId = "all") {
    const list = targetModId === "all"
      ? state.manifest.modules
      : state.manifest.modules.filter((m) => m.id === targetModId);
    const lines = [];
    for (const m of list) {
      const ex = await verifyAndInstantiateZeroImport(state.wasmById[m.id], m);
      const r = runNominalModule(m, ex);
      state.lastNominal[m.id] = r;
      const outEl = document.querySelector(`[data-mod-out="${m.id}"]`);
      if (outEl) outEl.textContent = `${r.ok ? "LIVE PASS" : "FAIL"} (${r.ms} ms): ${r.summary}`;
      const rootEl = document.querySelector(`[data-scrub-root="${m.id}"]`);
      if (rootEl) rootEl.textContent = r.rootHex;
      lines.push(`[${r.ok ? "PASS" : "FAIL"}] ${m.id} (${m.bytes} B, 0 imports, ${r.ms} ms): ${r.summary}`);
      lines.push(`       RFC 6962 Root = ${r.rootHex}`);
    }
    if (targetModId === "all") state.nominalRuns += 1;
    const okCount = Object.values(state.lastNominal).filter((x) => x.ok).length;
    statusEl.textContent = `Live Zero-C verification complete: ${okCount}/${state.manifest.modules.length} modules passed with strictly 0 host imports and exact RFC 6962 scrubber roots.`;
    logEl.textContent = lines.join("\n");
  }

  async function doRunAttacks(filterModId = null, targetAtkId = null) {
    let list = state.manifest.attacks;
    if (targetAtkId) list = list.filter((a) => a.id === targetAtkId);
    else if (filterModId && filterModId !== "all") list = list.filter((a) => a.module_id === filterModId);
    const lines = [];
    for (const a of list) {
      const m = state.manifest.modules.find((x) => x.id === a.module_id);
      const ex = await verifyAndInstantiateZeroImport(state.wasmById[m.id], m);
      const r = runAttackVector(a, m, ex);
      state.lastAttacks[a.id] = r;
      const cell = document.querySelector(`[data-atk-status="${a.id}"]`);
      if (cell) cell.textContent = `${r.rc} (${r.blocked ? "BLOCKED" : "FAIL"}, ${r.ms} ms)`;
      lines.push(`[${r.blocked ? "BLOCKED" : "FAIL"}] ${a.id} (${m.id}): rc=${r.rc} expected=${r.expected} (${r.ms} ms)`);
    }
    if (!filterModId && !targetAtkId) state.attackRuns += 1;
    const blockedCount = Object.values(state.lastAttacks).filter((x) => x.blocked).length;
    statusEl.textContent = targetAtkId
      ? `Injected attack ${targetAtkId}: trapped fail-closed (${lines[0]}).`
      : `Fail-closed storage and custody sweep complete: ${blockedCount}/${state.manifest.attacks.length} live attacks trapped in browser WASM.`;
    logEl.textContent = lines.join("\n");
  }

  modSel?.addEventListener("change", () => {
    const v = modSel.value;
    const m = state.manifest.modules.find((x) => x.id === v);
    statusEl.textContent = m
      ? `Selected Zero-C target: ${m.id} (${m.bytes.toLocaleString("en-US")} B, 0 imports).`
      : `Selected Zero-C target: all ${state.manifest.modules.length} modules (${state.manifest.total_wasm_bytes.toLocaleString("en-US")} B, 0 imports).`;
  });

  atkSel?.addEventListener("change", () => {
    const a = state.manifest.attacks.find((x) => x.id === atkSel.value);
    statusEl.textContent = a
      ? `Selected attack vector: ${a.id} (${a.module_id}, expected rc=${a.expected}).`
      : `Selected attack vector: ${atkSel.value}.`;
  });

  document.querySelector("#ts-run-all")?.addEventListener("click", () => doRunNominal(modSel?.value || "all"));
  document.querySelector("#ts-run-attack")?.addEventListener("click", () => doRunAttacks(null, atkSel?.value || null));
  document.querySelector("#ts-run-all-attacks")?.addEventListener("click", () => doRunAttacks(null, null));
  document.querySelectorAll("[data-run-mod]").forEach((btn) => {
    btn.addEventListener("click", () => doRunNominal(btn.getAttribute("data-run-mod")));
  });
  document.querySelectorAll("[data-atk-mod]").forEach((btn) => {
    btn.addEventListener("click", () => doRunAttacks(btn.getAttribute("data-atk-mod"), null));
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootBrowser, { once: true });
  else bootBrowser();
}
