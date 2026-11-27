// pq_showcase.mjs: pure ESM browser/Node runtime for /playground/buildos-pq/
// Zero Node imports, zero CDN fetches, fail-closed WebCrypto SHA-256 verification
// for both pq_manifest.json and all four pure-OSI MIT BuildLang .wasm binaries.

export const EXPECTED_SCHEMA = "buildos-pq-showcase/1";
export const EXPECTED_MODULE_COUNT = 4;
export const EXPECTED_ATTACK_COUNT = 12;

export const MCTS_KEYS = [
  "greedy_solved", "greedy_hacked", "greedy_rate", "mcts_solved", "mcts_rate",
  "goodhart_blocked", "mcts_hacked_accepted", "total_nodes_expanded", "mean_mcts_q",
  "solve_hash", "ctrl1_goodhart_rejected", "ctrl2_budget_trapped", "failures",
];

export const RLVR_KEYS = [
  "round0_solved", "round0_rate", "final_solved", "final_rate", "monotonic_ok",
  "mean_true_prob", "mean_trap_prob", "total_cost_saved", "proof_hash",
  "total_oracle_evals", "total_verified_proofs", "total_unsound_rejected",
  "ctrl1_unsound_rejected", "ctrl2_unverified_blocked", "failures",
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
    throw new Error(`pq_manifest.json SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha}`);
  }
  const text = new TextDecoder("utf-8").decode(rawBytes);
  const data = JSON.parse(text);
  if (data.schema !== EXPECTED_SCHEMA) {
    throw new Error(`Unexpected manifest schema: ${data.schema}`);
  }
  if (!Array.isArray(data.modules) || data.modules.length !== EXPECTED_MODULE_COUNT) {
    throw new Error(`Expected ${EXPECTED_MODULE_COUNT} WASM modules, got ${data.modules?.length}`);
  }
  if (!Array.isArray(data.attacks) || data.attacks.length !== EXPECTED_ATTACK_COUNT) {
    throw new Error(`Expected ${EXPECTED_ATTACK_COUNT} attack vectors, got ${data.attacks?.length}`);
  }
  return data;
}

export async function verifyAndInstantiateWasm(rawBytes, modSpec) {
  const buf = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
  if (buf.byteLength !== modSpec.bytes) {
    throw new Error(`${modSpec.file} byte length mismatch: expected ${modSpec.bytes}, got ${buf.byteLength}`);
  }
  const actualSha = await sha256Hex(buf);
  if (actualSha !== modSpec.sha256) {
    throw new Error(`${modSpec.file} SHA-256 mismatch: expected ${modSpec.sha256}, got ${actualSha}`);
  }
  if (!WebAssembly.validate(buf)) {
    throw new Error(`${modSpec.file} failed WebAssembly.validate`);
  }
  const importsObj = modSpec.imports_count > 0 ? { env: NOOP_ENV } : {};
  const { instance } = await WebAssembly.instantiate(buf, importsObj);
  return instance.exports;
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
  if (modId === "pq_hybrid_kem") {
    const rc = Number(ex.pq_hybrid_kem_run(0n));
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = rc === 1;
    return { modId, ok, rc, ms, summary: `pq_hybrid_kem_run(0n) -> ${rc} (ML-KEM-512 + X25519 + ChaCha20-Poly1305 committed)` };
  }
  if (modId === "enclave_attest") {
    const rc = Number(ex.enclave_attest_run(0n));
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = rc === 1;
    return { modId, ok, rc, ms, summary: `enclave_attest_run(0n) -> ${rc} (HKDF seal + zero-egress + Ed25519 quote attested)` };
  }
  if (modId === "mcts_goodhart") {
    const m = decodeF64Vec(ex, ex.run_titan_mcts_wasm(), MCTS_KEYS);
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = m.mcts_solved === 120 && m.goodhart_blocked === 90 && m.mcts_hacked_accepted === 0
      && m.solve_hash === 143053981 && m.failures === 0;
    return {
      modId, ok, rc: m.failures, ms, metrics: m,
      summary: `run_titan_mcts_wasm() -> ${m.mcts_solved}/120 solved (greedy ${m.greedy_solved}/120), ${m.goodhart_blocked}/90 Goodhart traps blocked, hash=${m.solve_hash}`,
    };
  }
  if (modId === "rlvr_synthesizer") {
    const m = decodeF64Vec(ex, ex.run_titan_rlvr_wasm(), RLVR_KEYS);
    const ms = +(performance.now() - t0).toFixed(3);
    const ok = m.round0_solved === 2 && m.final_solved === 16 && m.monotonic_ok === 1
      && m.proof_hash === 3868613143 && m.failures === 0;
    return {
      modId, ok, rc: m.failures, ms, metrics: m,
      summary: `run_titan_rlvr_wasm() -> ${m.round0_solved}/16 to ${m.final_solved}/16 solved (${m.total_verified_proofs} proofs, ${m.total_unsound_rejected} traps rejected), hash=${m.proof_hash}`,
    };
  }
  throw new Error(`Unknown module ID: ${modId}`);
}

export function runAttackVector(attack, ex) {
  const t0 = performance.now();
  let rc;
  if (attack.kind === "pq_mode") {
    rc = Number(ex.pq_hybrid_kem_run(BigInt(attack.arg)));
  } else if (attack.kind === "enclave_mode") {
    rc = Number(ex.enclave_attest_run(BigInt(attack.arg)));
  } else if (attack.kind === "mcts_valve") {
    rc = Number(ex.eval_goodhart_valve(attack.prm, attack.oracle));
  } else if (attack.kind === "mcts_budget") {
    rc = Number(ex.validate_mcts_budget(attack.budget));
  } else if (attack.kind === "rlvr_gate") {
    rc = Number(ex.verified_policy_update_gate(attack.oracle, attack.proxy));
  } else if (attack.kind === "rlvr_rule") {
    rc = Number(ex.verify_candidate_oracle(attack.task, attack.rule));
  } else {
    throw new Error(`Unknown attack kind: ${attack.kind}`);
  }
  const ms = +(performance.now() - t0).toFixed(3);
  const blocked = rc === attack.expected_rc;
  return {
    id: attack.id,
    module_id: attack.module_id,
    label: attack.label,
    rc,
    expected_rc: attack.expected_rc,
    blocked,
    ms,
  };
}

export function renderAttackTableRows(attacks) {
  return attacks.map((a) => `        <tr data-attack-row="${esc(a.id)}" data-module="${esc(a.module_id)}">
          <td class="mono">${esc(a.id)}</td>
          <td><strong>${esc(a.module_label)}</strong></td>
          <td>${esc(a.label)}</td>
          <td class="mono">${esc(a.call_expr)}</td>
          <td class="mono" data-attack-rc="${esc(a.id)}">${esc(String(a.expected_rc))} (staged)</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (/data-copy\s*=/.test(html)) throw new Error("Forbidden [data-copy] attribute present");
  if (/https?:\/\/(cdn\.|unpkg\.|jsdelivr|fonts\.googleapis)/i.test(html)) throw new Error("Forbidden CDN URL present");
  if (/[A-Za-z]:\\|\/Users\//i.test(html)) throw new Error("Forbidden local path leaked in HTML");
  for (const m of manifest.modules) {
    if (!html.includes(m.file)) throw new Error(`Missing module filename ${m.file} in HTML`);
  }
}

async function initBrowser() {
  const meta = document.querySelector('meta[name="pq-manifest-sha256"]');
  const statusEl = document.querySelector("#pq-status");
  const logEl = document.querySelector("#pq-log");
  if (!meta || !statusEl || !logEl) return;

  const expectedSha = meta.getAttribute("content") || "";
  let manifest;
  try {
    const resp = await fetch("./pq_manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching pq_manifest.json`);
    const raw = new Uint8Array(await resp.arrayBuffer());
    manifest = await verifyPinnedManifest(raw, expectedSha);
  } catch (err) {
    statusEl.textContent = `FAIL-CLOSED: ${err.message}`;
    document.documentElement.dataset.pqReady = "error";
    return;
  }

  const exportsMap = new Map();
  const wasmCache = new Map();

  async function ensureLoaded(modId) {
    const modSpec = manifest.modules.find((m) => m.id === modId);
    if (!modSpec) throw new Error(`Unknown module ${modId}`);
    if (!wasmCache.has(modId)) {
      const r = await fetch(`./wasm/${modSpec.file}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${modSpec.file}`);
      const raw = new Uint8Array(await r.arrayBuffer());
      const ex = await verifyAndInstantiateWasm(raw, modSpec);
      wasmCache.set(modId, raw);
      exportsMap.set(modId, ex);
    } else if (modId === "mcts_goodhart" || modId === "rlvr_synthesizer") {
      const ex = await verifyAndInstantiateWasm(wasmCache.get(modId), modSpec);
      exportsMap.set(modId, ex);
    }
    return exportsMap.get(modId);
  }

  const moduleSel = document.querySelector("#pq-module");
  const attackSel = document.querySelector("#pq-attack");
  const runAllBtn = document.querySelector("#pq-run-all");
  const runAttackBtn = document.querySelector("#pq-run-attack");
  const runAllAttacksBtn = document.querySelector("#pq-run-all-attacks");
  const state = { nominalRuns: 0, attackRuns: 0, lastNominal: {}, lastAttacks: {} };
  window.__PQ_STATE = state;

  async function executeNominal(modIds) {
    const lines = [];
    let passed = 0;
    for (const id of modIds) {
      const ex = await ensureLoaded(id);
      const res = runNominalModule(id, ex);
      state.lastNominal[id] = res;
      if (res.ok) passed++;
      const outEl = document.querySelector(`[data-mod-out="${id}"]`);
      if (outEl) outEl.textContent = `LIVE ${res.ok ? "PASS" : "FAIL"} (${res.ms} ms): ${res.summary}`;
      lines.push(`[${res.ok ? "PASS" : "FAIL"}] ${id} (${res.ms} ms): ${res.summary}`);
    }
    state.nominalRuns++;
    statusEl.textContent = `Live WASM run complete: ${passed}/${modIds.length} modules verified in browser memory (SHA-256 pinned).`;
    logEl.textContent = lines.join("\n");
  }

  async function executeAttacks(attacks) {
    const lines = [];
    let blocked = 0;
    for (const atk of attacks) {
      const ex = await ensureLoaded(atk.module_id);
      const res = runAttackVector(atk, ex);
      state.lastAttacks[atk.id] = res;
      if (res.blocked) blocked++;
      const cell = document.querySelector(`[data-attack-rc="${atk.id}"]`);
      if (cell) cell.textContent = `${res.rc} (${res.blocked ? "BLOCKED" : "MISMATCH"}, ${res.ms} ms)`;
      lines.push(`[${res.blocked ? "BLOCKED" : "FAIL"}] ${atk.id} (${atk.module_id}): rc=${res.rc} expected=${res.expected_rc} (${res.ms} ms)`);
    }
    state.attackRuns++;
    statusEl.textContent = `Fail-closed attack run complete: ${blocked}/${attacks.length} live attacks trapped by in-browser WASM.`;
    logEl.textContent = lines.join("\n");
  }

  function applyModuleFilter() {
    const val = moduleSel.value;
    let visible = 0;
    for (const tr of document.querySelectorAll("tr[data-attack-row]")) {
      const hide = val !== "all" && tr.dataset.module !== val;
      tr.hidden = hide;
      if (!hide) visible++;
    }
    statusEl.textContent = `Module filter: ${val} (${visible}/${manifest.attacks.length} fail-closed attack vectors shown).`;
  }

  moduleSel.addEventListener("change", applyModuleFilter);
  attackSel.addEventListener("change", () => {
    const atk = manifest.attacks.find((a) => a.id === attackSel.value);
    if (atk) {
      statusEl.textContent = `Selected attack ${atk.id} (${atk.module_label}): ${atk.label} [expected rc=${atk.expected_rc}].`;
    }
  });

  runAllBtn.addEventListener("click", async () => {
    const sel = moduleSel.value;
    const ids = sel === "all" ? manifest.modules.map((m) => m.id) : [sel];
    await executeNominal(ids);
  });

  runAttackBtn.addEventListener("click", async () => {
    const atk = manifest.attacks.find((a) => a.id === attackSel.value) || manifest.attacks[0];
    await executeAttacks([atk]);
  });

  runAllAttacksBtn.addEventListener("click", async () => {
    const sel = moduleSel.value;
    const list = sel === "all" ? manifest.attacks : manifest.attacks.filter((a) => a.module_id === sel);
    await executeAttacks(list);
  });

  for (const btn of document.querySelectorAll("button[data-run-mod]")) {
    btn.addEventListener("click", async () => {
      await executeNominal([btn.dataset.runMod]);
    });
  }

  for (const btn of document.querySelectorAll("button[data-attack-mod]")) {
    btn.addEventListener("click", async () => {
      const list = manifest.attacks.filter((a) => a.module_id === btn.dataset.attackMod);
      await executeAttacks(list);
    });
  }

  statusEl.textContent = `Manifest verified via WebCrypto SHA-256 (${expectedSha.slice(0, 16)}...). Ready to execute 4 pure-MIT WASM binaries (87.73 KB total).`;
  document.documentElement.dataset.pqReady = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBrowser);
  else initBrowser();
}
