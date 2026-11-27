// buildos_v2_showcase.mjs: pure ESM browser/Node runtime for /playground/buildos-v2/
// Zero Node imports, zero CDN fetches, fail-closed WebCrypto SHA-256 verification
// for buildos_v2_manifest.json and the zero-import BuildOS-2.0 Sovereign Kernel .wasm binary.

export const EXPECTED_SCHEMA = "buildos-v2-sovereign-showcase/1";
export const EXPECTED_SUBSYSTEM_COUNT = 12;
export const EXPECTED_ATTACK_COUNT = 8;
export const EXPECTED_SOVEREIGN_ROOT = "b0169274ea5bb300813d8d409c1098cbd92cb7490dcaf3fe30865b15eddc393f";

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
    throw new Error(`buildos_v2_manifest.json SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha}`);
  }
  const data = JSON.parse(new TextDecoder("utf-8").decode(rawBytes));
  if (data.schema !== EXPECTED_SCHEMA) {
    throw new Error(`Unexpected manifest schema: ${data.schema}`);
  }
  if (!Array.isArray(data.subsystems) || data.subsystems.length !== EXPECTED_SUBSYSTEM_COUNT) {
    throw new Error(`Expected ${EXPECTED_SUBSYSTEM_COUNT} subsystems, got ${data.subsystems?.length}`);
  }
  if (!Array.isArray(data.attacks) || data.attacks.length !== EXPECTED_ATTACK_COUNT) {
    throw new Error(`Expected ${EXPECTED_ATTACK_COUNT} attacks, got ${data.attacks?.length}`);
  }
  if (data.wasm?.expected_sovereign_root !== EXPECTED_SOVEREIGN_ROOT) {
    throw new Error(`Unexpected sovereign root pin: ${data.wasm?.expected_sovereign_root}`);
  }
  return data;
}

export async function verifyAndInstantiateKernel(rawBytes, wasmSpec) {
  const buf = rawBytes instanceof Uint8Array ? bytesOrView(rawBytes) : new Uint8Array(rawBytes);
  if (buf.byteLength !== wasmSpec.bytes) {
    throw new Error(`${wasmSpec.file} byte length mismatch: expected ${wasmSpec.bytes}, got ${buf.byteLength}`);
  }
  const actualSha = await sha256Hex(buf);
  if (actualSha !== wasmSpec.sha256) {
    throw new Error(`${wasmSpec.file} SHA-256 mismatch: expected ${wasmSpec.sha256}, got ${actualSha}`);
  }
  if (!WebAssembly.validate(buf)) {
    throw new Error(`${wasmSpec.file} failed WebAssembly.validate`);
  }
  const mod = await WebAssembly.compile(buf);
  const imports = WebAssembly.Module.imports(mod);
  if (imports.length !== 0) {
    throw new Error(`${wasmSpec.file} must have 0 host imports, got ${imports.length}`);
  }
  const instance = await WebAssembly.instantiate(mod);
  return instance.exports;
}

function bytesOrView(x) {
  return x instanceof Uint8Array ? x : new Uint8Array(x);
}

export function runSovereignBoot(ex) {
  const t0 = performance.now();
  const count = Number(ex.main());
  const ms = +(performance.now() - t0).toFixed(3);
  if (count !== 22) {
    throw new Error(`Expected 22 logged words from main(), got ${count}`);
  }
  const mem = new BigInt64Array(ex.memory.buffer);
  const words = [];
  for (let i = 1; i <= count; i++) words.push(Number(mem[i]));
  const rootHex = words.slice(14, 22).map((w) => (w >>> 0).toString(16).padStart(8, "0")).join("");
  const runZero = Number(ex.buildos_v2_run(0n));
  const ok = words[0] === 1 && words[1] === 1 && words[2] === 12 && words[3] === 3
    && words[4] === 4 && words[5] === 3329 && runZero === 1 && rootHex === EXPECTED_SOVEREIGN_ROOT;
  return {
    ok,
    ms,
    status: words[0],
    committed: words[1],
    subsystems_booted: words[2],
    ed25519_checks: words[3],
    smp_cores: words[4],
    pq_modulus_q: words[5],
    witness_words: words.slice(6, 14).map((w) => `0x${(w >>> 0).toString(16).padStart(8, "0")}`),
    sovereign_root: rootHex,
    run_zero_rc: runZero,
  };
}

export function runKernelAttack(attack, ex) {
  const t0 = performance.now();
  const rc = Number(ex.buildos_v2_run(BigInt(attack.mode)));
  const ms = +(performance.now() - t0).toFixed(3);
  const blocked = rc === attack.expected_rc;
  return {
    id: attack.id,
    mode: attack.mode,
    subsystem: attack.subsystem,
    label: attack.label,
    rc,
    expected_rc: attack.expected_rc,
    blocked,
    ms,
  };
}

export function renderSubsystemRows(subsystems) {
  return subsystems.map((s) => `        <tr data-sub-row="${esc(s.id)}">
          <td class="mono">${esc(s.id)}</td>
          <td><strong>${esc(s.name)}</strong></td>
          <td class="mono">${esc(s.wasm_export)}</td>
          <td>${esc(s.mechanism)}</td>
          <td class="mono" data-sub-state="${esc(s.id)}">staged</td>
        </tr>`).join("\n");
}

export function renderAttackRows(attacks) {
  return attacks.map((a) => `        <tr data-atk-row="${esc(a.id)}">
          <td class="mono">${esc(a.id)}</td>
          <td><strong>${esc(a.subsystem)}</strong></td>
          <td>${esc(a.label)}</td>
          <td class="mono">buildos_v2_run(${a.mode}n)</td>
          <td class="mono" data-atk-rc="${esc(a.id)}">${a.expected_rc} (staged)</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (/data-copy\s*=/.test(html)) throw new Error("Forbidden [data-copy] attribute present");
  if (/https?:\/\/(cdn\.|unpkg\.|jsdelivr|fonts\.googleapis)/i.test(html)) throw new Error("Forbidden CDN URL present");
  if (/[A-Za-z]:\\|\/Users\//i.test(html)) throw new Error("Forbidden local path leaked in HTML");
  if (!html.includes(manifest.wasm.file)) throw new Error(`Missing WASM filename ${manifest.wasm.file}`);
  if (!html.includes(EXPECTED_SOVEREIGN_ROOT)) throw new Error("Missing expected 12-leaf sovereign Merkle root");
}

async function initBrowser() {
  const meta = document.querySelector('meta[name="buildos-v2-manifest-sha256"]');
  const statusEl = document.querySelector("#v2-status");
  const rootEl = document.querySelector("#v2-root");
  const logEl = document.querySelector("#v2-log");
  if (!meta || !statusEl || !rootEl || !logEl) return;

  const expectedSha = meta.getAttribute("content") || "";
  let manifest;
  try {
    const resp = await fetch("./buildos_v2_manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching buildos_v2_manifest.json`);
    const raw = new Uint8Array(await resp.arrayBuffer());
    manifest = await verifyPinnedManifest(raw, expectedSha);
  } catch (err) {
    statusEl.textContent = `FAIL-CLOSED: ${err.message}`;
    document.documentElement.dataset.v2Ready = "error";
    return;
  }

  let wasmBytes = null;
  async function loadFreshExports() {
    if (!wasmBytes) {
      const r = await fetch(`./wasm/${manifest.wasm.file}`);
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${manifest.wasm.file}`);
      wasmBytes = new Uint8Array(await r.arrayBuffer());
    }
    return verifyAndInstantiateKernel(wasmBytes, manifest.wasm);
  }

  const attackSel = document.querySelector("#v2-attack");
  const bootBtn = document.querySelector("#v2-boot-btn");
  const attackBtn = document.querySelector("#v2-attack-btn");
  const allAttacksBtn = document.querySelector("#v2-all-attacks-btn");
  const state = { bootRuns: 0, attackRuns: 0, lastBoot: null, lastAttacks: {} };
  window.__V2_STATE = state;

  async function doBoot() {
    const ex = await loadFreshExports();
    const res = runSovereignBoot(ex);
    state.lastBoot = res;
    state.bootRuns++;
    for (const s of manifest.subsystems) {
      const cell = document.querySelector(`[data-sub-state="${s.id}"]`);
      if (cell) cell.textContent = res.ok ? `BOOTED (${res.ms} ms)` : "FAIL";
    }
    rootEl.textContent = `Live 12-leaf RFC 6962 Sovereign Root: ${res.sovereign_root} (${res.ok ? "EXACT MATCH" : "MISMATCH"})`;
    statusEl.textContent = `BuildOS-2.0 live boot ${res.ok ? "PASS" : "FAIL"}: ${res.subsystems_booted}/12 subsystems, ${res.smp_cores} SMP cores, ${res.ed25519_checks} Ed25519 checks, q=${res.pq_modulus_q} (${res.ms} ms).`;
    logEl.textContent = [
      `[BOOT ${res.ok ? "PASS" : "FAIL"}] buildos_v2_sovereign_zeroc.wasm (134,198 B, 0 imports, ${res.ms} ms)`,
      `subsystems=${res.subsystems_booted}/12 smp_cores=${res.smp_cores} ed25519_checks=${res.ed25519_checks} mlkem_q=${res.pq_modulus_q} committed=${res.committed}`,
      `sovereign_root=${res.sovereign_root}`,
      `witnesses=${res.witness_words.join(" ")}`,
    ].join("\n");
  }

  async function doAttacks(list) {
    const ex = await loadFreshExports();
    const lines = [];
    let blocked = 0;
    for (const atk of list) {
      const res = runKernelAttack(atk, ex);
      state.lastAttacks[atk.id] = res;
      if (res.blocked) blocked++;
      const cell = document.querySelector(`[data-atk-rc="${atk.id}"]`);
      if (cell) cell.textContent = `${res.rc} (${res.blocked ? "BLOCKED" : "MISMATCH"}, ${res.ms} ms)`;
      lines.push(`[${res.blocked ? "BLOCKED" : "FAIL"}] mode=${atk.mode} ${atk.id} (${atk.subsystem}): rc=${res.rc} expected=${atk.expected_rc} (${res.ms} ms)`);
    }
    state.attackRuns++;
    statusEl.textContent = `Fail-closed kernel attack run complete: ${blocked}/${list.length} cross-subsystem attacks rolled back live in WASM.`;
    logEl.textContent = lines.join("\n");
  }

  bootBtn.addEventListener("click", doBoot);
  attackSel.addEventListener("change", () => {
    const atk = manifest.attacks.find((a) => a.id === attackSel.value);
    if (atk) {
      statusEl.textContent = `Selected kernel attack ${atk.id} (${atk.subsystem}, mode ${atk.mode}): ${atk.label} [expected rc=${atk.expected_rc}].`;
    }
  });
  attackBtn.addEventListener("click", async () => {
    const atk = manifest.attacks.find((a) => a.id === attackSel.value) || manifest.attacks[0];
    await doAttacks([atk]);
  });
  allAttacksBtn.addEventListener("click", async () => {
    await doAttacks(manifest.attacks);
  });

  statusEl.textContent = `Manifest verified via WebCrypto SHA-256 (${expectedSha.slice(0, 16)}...). Ready to boot BuildOS-2.0 (134,198 B, 0 host imports).`;
  document.documentElement.dataset.v2Ready = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBrowser);
  else initBrowser();
}
