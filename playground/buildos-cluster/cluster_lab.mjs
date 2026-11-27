// cluster_lab.mjs: pure ESM browser/Node runtime for /playground/buildos-cluster/
// Zero Node imports, zero CDN fetches, fail-closed WebCrypto SHA-256 verification and
// strict import-policy enforcement (0 imports on all 3 Zero-C BuildOS modules; only no-op print_* stubs on Titan RSI).

export const EXPECTED_SCHEMA = "buildos-cluster-lab/1";
export const EXPECTED_MODULES = 4;
export const EXPECTED_ATTACKS = 16;
export const EXPECTED_WASM_BYTES = 136145;

export const RSI_KEYS = [
  "initial_score", "final_score", "compound_gain_x", "net_gain", "total_joules",
  "gain_per_joule", "accepted_edits", "total_evals", "goodhart_traps_total",
  "goodhart_traps_blocked", "regressions", "monotonic_ok", "pareto_hash",
  "ctrl1_goodhart_rolled_back", "ctrl2_nonpos_budget_trapped", "failures",
];

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

export async function sha256Hex(bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPinnedManifest(rawBytes, expectedSha256) {
  const actualSha = await sha256Hex(rawBytes);
  if (actualSha !== String(expectedSha256 || "").toLowerCase()) {
    throw new Error(`cluster_manifest.json SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha}`);
  }
  const data = JSON.parse(new TextDecoder("utf-8").decode(rawBytes));
  if (data.schema !== EXPECTED_SCHEMA) {
    throw new Error(`Unexpected manifest schema: ${data.schema}`);
  }
  if (!Array.isArray(data.modules) || data.modules.length !== EXPECTED_MODULES) {
    throw new Error(`Expected ${EXPECTED_MODULES} WASM modules, got ${data.modules?.length}`);
  }
  if (!Array.isArray(data.attacks) || data.attacks.length !== EXPECTED_ATTACKS) {
    throw new Error(`Expected ${EXPECTED_ATTACKS} attack vectors, got ${data.attacks?.length}`);
  }
  if (data.total_wasm_bytes !== EXPECTED_WASM_BYTES) {
    throw new Error(`Expected ${EXPECTED_WASM_BYTES} WASM bytes, got ${data.total_wasm_bytes}`);
  }
  return data;
}

export async function verifyAndInstantiateModule(rawBytes, spec) {
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
  const mod = await WebAssembly.compile(buf);
  const imps = WebAssembly.Module.imports(mod);
  if (spec.strict_zero_imports) {
    if (imps.length !== 0) {
      throw new Error(`${spec.file} must have strictly 0 host imports, got ${imps.length}`);
    }
    const inst = await WebAssembly.instantiate(mod);
    return inst.exports;
  }
  if (!imps.every((i) => i.module === "env" && i.name.startsWith("print_"))) {
    throw new Error(`${spec.file} attempted unauthorized non-print host import`);
  }
  const inst = await WebAssembly.instantiate(mod, { env: NOOP_ENV });
  return inst.exports;
}

function decodeF64Vec(ex, hdr, keys) {
  const dv = new DataView(ex.memory.buffer);
  const ptr = dv.getUint32(hdr, true);
  const len = dv.getUint32(hdr + 4, true);
  if (len !== keys.length) throw new Error(`Expected ${keys.length} f64 metrics, got ${len}`);
  const arr = new Float64Array(ex.memory.buffer, ptr, len);
  const out = {};
  for (let i = 0; i < keys.length; i++) out[keys[i]] = arr[i];
  return out;
}

export function runNominalModule(modId, ex) {
  const t0 = performance.now();
  if (modId === "cluster_v21") {
    const count = Number(ex.main());
    const rc = Number(ex.buildos_v21_cluster_run(0n));
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = count === 20 && rc === 1;
    return { modId, ok, rc, ms, summary: `buildos_v21_cluster_run(0n) -> ${rc} (4 pillars, 7 Ed25519 checks, count=${count})` };
  }
  if (modId === "bft_ledger") {
    const count = Number(ex.main());
    const rc = Number(ex.bft_consensus_run(0n));
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = count === 24 && rc === 1;
    return { modId, ok, rc, ms, summary: `bft_consensus_run(0n) -> ${rc} (4 validators, 3/4 quorum, 3 blocks committed)` };
  }
  if (modId === "zk_pedersen") {
    const count = Number(ex.main());
    const rc = Number(ex.zk_pedersen_run(0n));
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = count === 26 && rc === 1;
    return { modId, ok, rc, ms, summary: `zk_pedersen_run(0n) -> ${rc} (1000 = 625 + 375 balanced Pedersen/Schnorr ZK verified)` };
  }
  if (modId === "titan_rsi") {
    const m = decodeF64Vec(ex, ex.run_titan_rsi_pareto_wasm(), RSI_KEYS);
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = m.monotonic_ok === 1 && m.regressions === 0 && m.goodhart_traps_blocked === 40
      && m.pareto_hash === 1468869863 && m.failures === 0 && m.compound_gain_x > 3.01;
    return {
      modId, ok, rc: m.failures, ms, metrics: m,
      summary: `run_titan_rsi_pareto_wasm() -> ${m.compound_gain_x.toFixed(3)}x gain (${m.initial_score.toFixed(2)} to ${m.final_score.toFixed(2)}), 40/40 Goodhart rollbacks, hash=${m.pareto_hash}`,
    };
  }
  throw new Error(`Unknown module ID: ${modId}`);
}

export function runAttackVector(atk, ex) {
  const t0 = performance.now();
  let rc;
  if (atk.kind === "cluster_mode") rc = Number(ex.buildos_v21_cluster_run(BigInt(atk.arg)));
  else if (atk.kind === "bft_mode") rc = Number(ex.bft_consensus_run(BigInt(atk.arg)));
  else if (atk.kind === "zk_mode") rc = Number(ex.zk_pedersen_run(BigInt(atk.arg)));
  else if (atk.kind === "rsi_valve") rc = Number(ex.anti_goodhart_valve(...atk.args));
  else throw new Error(`Unknown attack kind: ${atk.kind}`);
  const ms = +(performance.now() - t0).toFixed(3);
  const blocked = rc === atk.expected_rc;
  return { id: atk.id, module_id: atk.module_id, rc, expected_rc: atk.expected_rc, blocked, ms };
}

export function renderAttackRows(attacks) {
  return attacks.map((a) => `        <tr data-atk-row="${esc(a.id)}" data-module="${esc(a.module_id)}">
          <td class="mono">${esc(a.id)}</td>
          <td><strong>${esc(a.module_label)}</strong></td>
          <td>${esc(a.label)}</td>
          <td class="mono">${esc(a.call_expr)}</td>
          <td class="mono" data-atk-rc="${esc(a.id)}">${a.expected_rc} (staged)</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (/data-copy\s*=/.test(html)) throw new Error("Forbidden [data-copy] attribute present");
  if (/https?:\/\/(cdn\.|unpkg\.|jsdelivr|fonts\.googleapis)/i.test(html)) throw new Error("Forbidden CDN URL present");
  if (/[A-Za-z]:\\|\/Users\//i.test(html)) throw new Error("Forbidden local path leaked in HTML");
  for (const m of manifest.modules) {
    if (!html.includes(m.file)) throw new Error(`Missing WASM filename ${m.file}`);
  }
}

async function initBrowser() {
  const meta = document.querySelector('meta[name="cluster-manifest-sha256"]');
  const statusEl = document.querySelector("#cl-status");
  const logEl = document.querySelector("#cl-log");
  if (!meta || !statusEl || !logEl) return;

  const expectedSha = meta.getAttribute("content") || "";
  let manifest;
  try {
    const resp = await fetch("./cluster_manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching cluster_manifest.json`);
    const raw = new Uint8Array(await resp.arrayBuffer());
    manifest = await verifyPinnedManifest(raw, expectedSha);
  } catch (err) {
    statusEl.textContent = `FAIL-CLOSED: ${err.message}`;
    document.documentElement.dataset.clusterReady = "error";
    return;
  }

  const cache = new Map();
  async function loadFresh(modId) {
    const spec = manifest.modules.find((m) => m.id === modId);
    if (!spec) throw new Error(`Unknown module ${modId}`);
    if (!cache.has(modId)) {
      const r = await fetch(`./wasm/${spec.file}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${spec.file}`);
      cache.set(modId, new Uint8Array(await r.arrayBuffer()));
    }
    return verifyAndInstantiateModule(cache.get(modId), spec);
  }

  const modSel = document.querySelector("#cl-module");
  const atkSel = document.querySelector("#cl-attack");
  const runAllBtn = document.querySelector("#cl-run-all");
  const runAtkBtn = document.querySelector("#cl-run-attack");
  const runAllAtksBtn = document.querySelector("#cl-run-all-attacks");
  const state = { nominalRuns: 0, attackRuns: 0, lastNominal: {}, lastAttacks: {} };
  window.__CL_STATE = state;

  async function execNominal(ids) {
    const lines = [];
    let passed = 0;
    for (const id of ids) {
      const ex = await loadFresh(id);
      const res = runNominalModule(id, ex);
      state.lastNominal[id] = res;
      if (res.ok) passed++;
      const el = document.querySelector(`[data-mod-out="${id}"]`);
      if (el) el.textContent = `LIVE ${res.ok ? "PASS" : "FAIL"} (${res.ms} ms): ${res.summary}`;
      lines.push(`[${res.ok ? "PASS" : "FAIL"}] ${id} (${res.ms} ms): ${res.summary}`);
    }
    state.nominalRuns++;
    statusEl.textContent = `Live WASM run complete: ${passed}/${ids.length} modules verified in browser memory (WebCrypto SHA-256 pinned).`;
    logEl.textContent = lines.join("\n");
  }

  async function execAttacks(list) {
    const lines = [];
    let blocked = 0;
    for (const atk of list) {
      const ex = await loadFresh(atk.module_id);
      const res = runAttackVector(atk, ex);
      state.lastAttacks[atk.id] = res;
      if (res.blocked) blocked++;
      const cell = document.querySelector(`[data-atk-rc="${atk.id}"]`);
      if (cell) cell.textContent = `${res.rc} (${res.blocked ? "BLOCKED" : "MISMATCH"}, ${res.ms} ms)`;
      lines.push(`[${res.blocked ? "BLOCKED" : "FAIL"}] ${atk.id} (${atk.module_id}): rc=${res.rc} expected=${atk.expected_rc} (${res.ms} ms)`);
    }
    state.attackRuns++;
    statusEl.textContent = `Fail-closed attack run complete: ${blocked}/${list.length} live attacks trapped in browser WASM.`;
    logEl.textContent = lines.join("\n");
  }

  modSel.addEventListener("change", () => {
    const v = modSel.value;
    let shown = 0;
    for (const tr of document.querySelectorAll("tr[data-atk-row]")) {
      const hide = v !== "all" && tr.dataset.module !== v;
      tr.hidden = hide;
      if (!hide) shown++;
    }
    statusEl.textContent = `Target filter active: ${v === "all" ? "all 4 WASM modules" : v} (${shown}/${manifest.attacks.length} attack rows visible).`;
  });

  atkSel.addEventListener("change", () => {
    const atk = manifest.attacks.find((a) => a.id === atkSel.value) || manifest.attacks[0];
    statusEl.textContent = `Selected attack vector: ${atk.id} (${atk.module_label}, expected rc=${atk.expected_rc}).`;
  });

  runAllBtn.addEventListener("click", () => execNominal(modSel.value === "all" ? manifest.modules.map((m) => m.id) : [modSel.value]));
  runAtkBtn.addEventListener("click", () => execAttacks([manifest.attacks.find((a) => a.id === atkSel.value) || manifest.attacks[0]]));
  runAllAtksBtn.addEventListener("click", () => execAttacks(modSel.value === "all" ? manifest.attacks : manifest.attacks.filter((a) => a.module_id === modSel.value)));
  for (const b of document.querySelectorAll("button[data-run-mod]")) b.addEventListener("click", () => execNominal([b.dataset.runMod]));
  for (const b of document.querySelectorAll("button[data-atk-mod]")) b.addEventListener("click", () => execAttacks(manifest.attacks.filter((a) => a.module_id === b.dataset.atkMod)));

  statusEl.textContent = `Manifest verified via WebCrypto SHA-256 (${expectedSha.slice(0, 16)}...). Ready to execute 4 live WASM binaries (132.95 KB).`;
  document.documentElement.dataset.clusterReady = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBrowser);
  else initBrowser();
}
