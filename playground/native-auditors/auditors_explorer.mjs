// auditors_explorer.mjs: pure ESM browser/Node runtime for /playground/native-auditors/
// Zero Node imports, zero CDN fetches, fail-closed WebCrypto SHA-256 verification
// for auditors_manifest.json indexing 22/22 native BuildLang auditors, 15/15 OSS Gold SBOM V3, and 10/10 MCP Registry.

export const EXPECTED_SCHEMA = "native-auditors-explorer/1";
export const EXPECTED_AUDITORS = 22;
export const EXPECTED_OSS_REPOS = 15;
export const EXPECTED_MCP_SERVERS = 10;

export const LANE_LABELS = {
  "core-compiler-gates": "Core & Compiler",
  "security-os-gpu": "Security, OS & GPU",
  "data-docs-governance": "Data, Docs & Governance",
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
    throw new Error(`auditors_manifest.json SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha}`);
  }
  const data = JSON.parse(new TextDecoder("utf-8").decode(rawBytes));
  if (data.schema !== EXPECTED_SCHEMA) {
    throw new Error(`Unexpected manifest schema: ${data.schema}`);
  }
  if (!Array.isArray(data.cockpit?.auditors) || data.cockpit.auditors.length !== EXPECTED_AUDITORS) {
    throw new Error(`Expected ${EXPECTED_AUDITORS} native auditors, got ${data.cockpit?.auditors?.length}`);
  }
  if (data.oss_gold_sbom_v3?.gold_standard_score !== "165/165" || data.oss_gold_sbom_v3?.stale_fsl !== 0) {
    throw new Error(`OSS Gold Standard invariant failed: score=${data.oss_gold_sbom_v3?.gold_standard_score} fsl=${data.oss_gold_sbom_v3?.stale_fsl}`);
  }
  if (!Array.isArray(data.oss_gold_sbom_v3?.repositories) || data.oss_gold_sbom_v3.repositories.length !== EXPECTED_OSS_REPOS) {
    throw new Error(`Expected ${EXPECTED_OSS_REPOS} OSS Gold repos, got ${data.oss_gold_sbom_v3?.repositories?.length}`);
  }
  if (!Array.isArray(data.mcp_registry?.servers) || data.mcp_registry.servers.length !== EXPECTED_MCP_SERVERS) {
    throw new Error(`Expected ${EXPECTED_MCP_SERVERS} MCP Registry servers, got ${data.mcp_registry?.servers?.length}`);
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

  // Control 2: Forged OSS Gold score / stale FSL leak
  const forged = structuredClone(manifest);
  forged.oss_gold_sbom_v3.stale_fsl = 1;
  const b2 = new TextEncoder().encode(JSON.stringify(forged));
  const sha2 = await sha256Hex(b2);
  let caught2 = false;
  try { await verifyPinnedManifest(b2, sha2); } catch (e) { caught2 = /OSS Gold Standard invariant/.test(e.message); }
  results.push({ id: "ctrl_forged_gold_fsl", caught: caught2, detail: "Injected stale FSL license violation trapped fail-closed" });

  // Control 3: Truncated auditor list (21/22)
  const trunc = structuredClone(manifest);
  trunc.cockpit.auditors = trunc.cockpit.auditors.slice(0, 21);
  const b3 = new TextEncoder().encode(JSON.stringify(trunc));
  const sha3 = await sha256Hex(b3);
  let caught3 = false;
  try { await verifyPinnedManifest(b3, sha3); } catch (e) { caught3 = /Expected 22 native auditors/.test(e.message); }
  results.push({ id: "ctrl_truncated_auditors", caught: caught3, detail: "Truncated 21/22 auditor list trapped fail-closed" });

  return { ok: results.every((r) => r.caught), caught: results.filter((r) => r.caught).length, total: results.length, results };
}

export function filterAuditors(auditors, { lane = "all", speed = "all", query = "" }) {
  const q = String(query || "").trim().toLowerCase();
  return auditors.filter((a) => {
    if (lane !== "all" && a.lane !== lane) return false;
    if (speed === "sub-ms" && !(a.elapsed_ms < 1.0)) return false;
    if (speed === "fast-ms" && !(a.elapsed_ms >= 1.0)) return false;
    if (q) {
      const hay = `${a.id} ${a.binary} ${a.lane} ${a.scope}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function renderAuditorRows(auditors) {
  return auditors.map((a) => `        <tr data-aud="${esc(a.id)}" data-lane="${esc(a.lane)}">
          <td class="mono"><strong>${esc(a.id)}</strong><span class="aud-sub">${esc(a.binary)}</span></td>
          <td>${esc(LANE_LABELS[a.lane] || a.lane)}</td>
          <td class="mono">${a.elapsed_ms.toFixed(3)} ms</td>
          <td class="mono">${a.binary_bytes > 0 ? `${a.binary_bytes.toLocaleString("en-US")} B` : "bridge"}</td>
          <td>${esc(a.scope)}</td>
        </tr>`).join("\n");
}

export function renderOssRows(repos) {
  return repos.map((r) => `        <tr data-oss-repo="${esc(r.slug)}">
          <td class="mono"><strong>${esc(r.repo)}</strong></td>
          <td class="mono">${esc(r.license)}</td>
          <td class="mono">${esc(r.ecosystem)} ${esc(r.version)}</td>
          <td class="mono">${r.component_count}</td>
          <td class="mono">11/11 (${esc(r.spdx_sha256.slice(0, 10))}...)</td>
        </tr>`).join("\n");
}

export function renderMcpRows(servers) {
  return servers.map((s) => `        <tr data-mcp-srv="${esc(s.slug)}">
          <td class="mono"><strong>${esc(s.mcp_name)}</strong></td>
          <td class="mono">${esc(s.registry_type)} / ${esc(s.package_identifier)}@${esc(s.package_version)}</td>
          <td class="mono">${esc(s.license_spdx)}</td>
          <td class="mono">${s.dry_run_artifact_count}</td>
          <td class="mono">2025-12-11 PASS (${esc(s.server_json_sha256.replace("sha256:", "").slice(0, 10))}...)</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  if (/data-copy\s*=/.test(html)) throw new Error("Forbidden [data-copy] attribute present");
  if (/https?:\/\/(cdn\.|unpkg\.|jsdelivr|fonts\.googleapis)/i.test(html)) throw new Error("Forbidden CDN URL present");
  if (/[A-Za-z]:\\|\/Users\//i.test(html)) throw new Error("Forbidden local path leaked in HTML");
  if (!html.includes("22/22") || !html.includes("165/165") || !html.includes("2025-12-11")) {
    throw new Error("Missing core 22/22, 165/165, or 2025-12-11 milestones in HTML");
  }
  for (const a of manifest.cockpit.auditors) {
    if (!html.includes(a.id)) throw new Error(`Missing auditor ${a.id}`);
  }
}

async function initBrowser() {
  const meta = document.querySelector('meta[name="auditors-manifest-sha256"]');
  const statusEl = document.querySelector("#aud-status");
  const tamperEl = document.querySelector("#aud-tamper-out");
  if (!meta || !statusEl || !tamperEl) return;

  const expectedSha = meta.getAttribute("content") || "";
  let raw;
  let manifest;
  try {
    const resp = await fetch("./auditors_manifest.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching auditors_manifest.json`);
    raw = new Uint8Array(await resp.arrayBuffer());
    manifest = await verifyPinnedManifest(raw, expectedSha);
  } catch (err) {
    statusEl.textContent = `FAIL-CLOSED: ${err.message}`;
    document.documentElement.dataset.audReady = "error";
    return;
  }

  const laneSel = document.querySelector("#aud-lane");
  const speedSel = document.querySelector("#aud-speed");
  const searchInp = document.querySelector("#aud-search");
  const resetBtn = document.querySelector("#aud-reset");
  const tamperBtn = document.querySelector("#aud-tamper-btn");
  const emptyEl = document.querySelector("#aud-empty");
  const pills = [...document.querySelectorAll("button.aud-pill[data-lane]")];
  const state = { lane: "all", speed: "all", query: "", tamperRuns: 0, lastTamper: null };
  window.__AUD_STATE = state;

  function applyFilters() {
    const matched = filterAuditors(manifest.cockpit.auditors, state);
    const keep = new Set(matched.map((a) => a.id));
    for (const tr of document.querySelectorAll("tr[data-aud]")) {
      tr.hidden = !keep.has(tr.dataset.aud);
    }
    if (emptyEl) emptyEl.hidden = matched.length > 0;
    const subMs = matched.filter((a) => a.elapsed_ms < 1.0).length;
    statusEl.textContent = `Showing ${matched.length}/22 live native BuildLang auditors (${subMs} sub-millisecond gates, 23 tracked binaries, 0 stale) | Lane: ${state.lane} | Speed: ${state.speed}.`;
  }

  function syncPills(val) {
    for (const b of pills) {
      const active = b.dataset.lane === val;
      b.dataset.active = active ? "1" : "0";
      b.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  for (const p of pills) {
    p.addEventListener("click", () => {
      state.lane = p.dataset.lane;
      laneSel.value = state.lane;
      syncPills(state.lane);
      applyFilters();
    });
  }

  laneSel.addEventListener("change", () => { state.lane = laneSel.value; syncPills(state.lane); applyFilters(); });
  speedSel.addEventListener("change", () => { state.speed = speedSel.value; applyFilters(); });
  searchInp.addEventListener("input", () => { state.query = searchInp.value; applyFilters(); });
  resetBtn.addEventListener("click", () => {
    state.lane = "all"; state.speed = "all"; state.query = "";
    laneSel.value = "all"; speedSel.value = "all"; searchInp.value = "";
    syncPills("all");
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
  tamperEl.textContent = `Manifest SHA-256 verified (${expectedSha.slice(0, 16)}...): 22/22 native auditors, 15/15 OSS Gold (165/165), 10/10 MCP Registry PASS.`;
  document.documentElement.dataset.audReady = "1";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBrowser);
  else initBrowser();
}
