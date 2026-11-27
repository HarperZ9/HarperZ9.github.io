// Unified browser + Node pure-JS explorer and verifier for /playground/sbom/
// Zero external CDN dependencies; binds strictly to harper-ecosystem-15repos.cdx.json (15 repos, 556 components).

export const BOM_EXPECTED_SHA256 =
  "sha256:3389dee14e4ec9b90c93f732f5273e80b342a313e10167390a510a23d0ef7811";

export const FLAGSHIP_REPOS = Object.freeze([
  "buildlang",
  "superframe",
  "flywheel",
  "cmmns",
  "HarperZ9.github.io",
]);

export const MCP_REPOS = Object.freeze([
  "articulate",
  "index",
  "forum",
  "crucible",
  "plexus",
  "calibrate-pro",
  "gather",
  "chorus",
  "mneme",
  "learn",
]);

export const FORBIDDEN_LICENSES = Object.freeze([
  "SSPL-1.0",
  "BUSL-1.1",
  "Elastic-2.0",
  "Commons-Clause",
  "LicenseRef-Planted-Forbidden",
]);

export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function extractLicense(comp) {
  const first = comp?.licenses?.[0];
  if (!first) return "NOASSERTION";
  return String(first.license?.id || first.license?.name || first.expression || "NOASSERTION");
}

export function repoTier(repoName) {
  if (FLAGSHIP_REPOS.includes(repoName)) return "flagship";
  if (MCP_REPOS.includes(repoName)) return "mcp_server";
  return "other";
}

export function buildNormalizedInventory(bom) {
  const components = Array.isArray(bom?.components) ? bom.components : [];
  const deps = Array.isArray(bom?.dependencies) ? bom.dependencies : [];

  const appByRef = new Map();
  for (const c of components) {
    if (c.type === "application") {
      appByRef.set(c["bom-ref"], c.name);
    }
  }

  const refToRepo = new Map();
  for (const d of deps) {
    const parentName = appByRef.get(d.ref);
    if (!parentName) continue;
    refToRepo.set(d.ref, parentName);
    for (const childRef of d.dependsOn || []) {
      if (!refToRepo.has(childRef)) refToRepo.set(childRef, parentName);
    }
  }

  return components.map((c) => {
    const repo = c.type === "application" ? c.name : (refToRepo.get(c["bom-ref"]) || "ecosystem");
    return {
      bom_ref: c["bom-ref"] || "",
      name: c.name || "",
      version: c.version || "",
      type: c.type || "library",
      purl: c.purl || "",
      license: extractLicense(c),
      repo,
      tier: repoTier(repo),
    };
  });
}

export function computeSbomSummary(bom) {
  const items = buildNormalizedInventory(bom);
  const reposMap = new Map();
  const licenseCounts = new Map();

  for (const item of items) {
    licenseCounts.set(item.license, (licenseCounts.get(item.license) || 0) + 1);
    if (!reposMap.has(item.repo)) {
      reposMap.set(item.repo, {
        repo: item.repo,
        tier: item.tier,
        version: "",
        license: "",
        total_components: 0,
        libraries: 0,
      });
    }
    const r = reposMap.get(item.repo);
    r.total_components += 1;
    if (item.type === "application") {
      r.version = item.version;
      r.license = item.license;
    } else {
      r.libraries += 1;
    }
  }

  const repoOrder = [...FLAGSHIP_REPOS, ...MCP_REPOS];
  const repos = repoOrder
    .filter((name) => reposMap.has(name))
    .map((name) => reposMap.get(name));

  const licensesSorted = [...licenseCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    bomFormat: bom?.bomFormat || "",
    specVersion: bom?.specVersion || "",
    totalComponents: items.length,
    totalRepos: repos.length,
    flagshipCount: repos.filter((r) => r.tier === "flagship").length,
    mcpCount: repos.filter((r) => r.tier === "mcp_server").length,
    repos,
    licensesSorted,
    items,
  };
}

export function filterComponents(
  items,
  { tier = "all", repo = "all", license = "all", type = "all", query = "" } = {}
) {
  const q = String(query || "").trim().toLowerCase();
  return items.filter((it) => {
    if (tier !== "all" && it.tier !== tier) return false;
    if (repo !== "all" && it.repo !== repo) return false;
    if (license !== "all" && it.license !== license) return false;
    if (type !== "all" && it.type !== type) return false;
    if (q) {
      const hay = `${it.name} ${it.version} ${it.repo} ${it.tier} ${it.license} ${it.purl}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function renderLicenseSvg(summary) {
  const top = summary.licensesSorted.slice(0, 8);
  const total = Math.max(summary.totalComponents, 1);
  const width = 760;
  const left = 210;
  const right = 130;
  const plotW = width - left - right;
  const rowH = 26;
  const topPad = 34;
  const height = topPad + top.length * rowH + 18;
  const maxCount = Math.max(...top.map(([, n]) => n), 1);

  const bars = top
    .map(([lic, count], i) => {
      const y = topPad + i * rowH;
      const bw = Math.max(4, (count / maxCount) * plotW);
      const pct = ((count / total) * 100).toFixed(1);
      return `<g data-license="${escHtml(lic)}">
  <text x="${left - 10}" y="${y + 14}" text-anchor="end" fill="currentColor" font-size="11">${escHtml(lic)}</text>
  <line x1="${left}" y1="${y + 21}" x2="${left + plotW}" y2="${y + 21}" stroke="currentColor" stroke-opacity="0.14" stroke-width="1"/>
  <rect x="${left}" y="${y + 4}" width="${bw.toFixed(1)}" height="12" fill="currentColor" fill-opacity="0.82"/>
  <text x="${(left + bw + 8).toFixed(1)}" y="${y + 14}" fill="currentColor" font-size="10.8" class="sb-svg-num">${count} (${pct}%)</text>
</g>`;
    })
    .join("\n");

  return `<svg class="sb-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="License composition across 556 components">
  <title>SPDX License Composition Across 15 Public Repositories (556 Components)</title>
  <desc>Hairline bar chart showing top SPDX license counts across all 556 components in harper-ecosystem-15repos.cdx.json.</desc>
  <text x="0" y="16" fill="currentColor" font-size="12" font-weight="700">SPDX License Composition Across 15 Public Repositories (${summary.totalComponents} Components)</text>
  <line x1="${left}" y1="${topPad - 4}" x2="${left}" y2="${height - 14}" stroke="currentColor" stroke-opacity="0.4" stroke-width="1"/>
  ${bars}
</svg>`;
}

export function renderRepoRows(summary) {
  return summary.repos
    .map((r) => {
      const tierLabel = r.tier === "flagship" ? "Flagship" : "Official MCP";
      return `<tr data-repo-row="${escHtml(r.repo)}" data-tier="${escHtml(r.tier)}">
  <th scope="row"><a href="https://github.com/HarperZ9/${escHtml(r.repo)}" rel="noopener">HarperZ9/${escHtml(r.repo)}</a></th>
  <td class="mono">${escHtml(tierLabel)}</td>
  <td class="mono">${escHtml(r.version)}</td>
  <td class="mono">${escHtml(r.license)}</td>
  <td class="mono">${r.total_components}</td>
  <td class="mono">${r.libraries}</td>
</tr>`;
    })
    .join("\n");
}

export function renderComponentRows(items, limit = 150) {
  const slice = limit > 0 ? items.slice(0, limit) : items;
  return slice
    .map(
      (it) => `<tr data-comp-repo="${escHtml(it.repo)}" data-comp-lic="${escHtml(it.license)}">
  <th scope="row">${escHtml(it.name)}<span class="sb-sub">${escHtml(it.purl || it.bom_ref)}</span></th>
  <td class="mono">${escHtml(it.version)}</td>
  <td class="mono">${escHtml(it.repo)}</td>
  <td class="mono">${escHtml(it.type)}</td>
  <td class="mono">${escHtml(it.license)}</td>
</tr>`
    )
    .join("\n");
}

export function verifySbomSurface(htmlText, bom, { expectedSha256 = BOM_EXPECTED_SHA256, actualSha256 } = {}) {
  if (actualSha256 && actualSha256 !== expectedSha256) {
    throw new Error(`Fail-closed BOM SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }
  if (!bom || bom.bomFormat !== "CycloneDX" || bom.specVersion !== "1.5") {
    throw new Error(`Invalid CycloneDX BOM header: ${bom?.bomFormat} ${bom?.specVersion}`);
  }
  const summary = computeSbomSummary(bom);
  if (summary.totalRepos !== 15 || summary.flagshipCount !== 5 || summary.mcpCount !== 10) {
    throw new Error(`Repo coverage mismatch: total=${summary.totalRepos} flagships=${summary.flagshipCount} mcp=${summary.mcpCount}`);
  }
  if (summary.totalComponents !== 556) {
    throw new Error(`Expected 556 unified components, found ${summary.totalComponents}`);
  }

  // Fail-closed forbidden license policy check across all 556 components
  const forbiddenHits = summary.items.filter((it) => FORBIDDEN_LICENSES.includes(it.license));
  if (forbiddenHits.length > 0) {
    throw new Error(
      `Fail-closed forbidden license detected (${forbiddenHits.length}): ${forbiddenHits[0].name}@${forbiddenHits[0].version} (${forbiddenHits[0].license})`
    );
  }

  const errors = [];
  for (const r of summary.repos) {
    if (!htmlText.includes(`data-repo-row="${r.repo}"`)) {
      errors.push(`Missing repo row for ${r.repo}`);
    }
  }
  for (const req of ["556", "15/15", "CycloneDX 1.5", "SPDX 2.3"]) {
    if (!htmlText.includes(req)) errors.push(`Missing required SBOM token: ${req}`);
  }
  if (errors.length > 0) {
    throw new Error(`SBOM surface consistency failed (${errors.length}): ${errors.join("; ")}`);
  }
  return { ok: true, repos: summary.totalRepos, components: summary.totalComponents, summary };
}

async function sha256HexBrowser(buf) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    const tbody = document.getElementById("sb-comp-rows");
    const statusEl = document.getElementById("sb-status");
    const digestEl = document.getElementById("sb-digest");
    const repoSelect = document.getElementById("sb-repo");
    const licSelect = document.getElementById("sb-license");
    const typeSelect = document.getElementById("sb-type");
    const searchEl = document.getElementById("sb-search");
    const tierBtns = [...document.querySelectorAll("[data-tier-filter]")];

    try {
      const res = await fetch("./harper-ecosystem-15repos.cdx.json");
      const rawBuf = await res.arrayBuffer();
      const bom = JSON.parse(new TextDecoder("utf-8").decode(rawBuf));
      const summary = computeSbomSummary(bom);
      const state = { tier: "all", repo: "all", license: "all", type: "all", query: "" };

      if (globalThis.crypto?.subtle && digestEl) {
        const computed = `sha256:${await sha256HexBrowser(rawBuf)}`;
        const ok = computed === BOM_EXPECTED_SHA256;
        digestEl.textContent = ok
          ? `Live BOM SHA-256 check: MATCH (${computed.slice(0, 23)}...) | 15/15 repos | 556 components`
          : `Live BOM SHA-256 check: MISMATCH (${computed.slice(0, 23)}...)`;
      }

      function update() {
        const filtered = filterComponents(summary.items, state);
        if (tbody) tbody.innerHTML = renderComponentRows(filtered, 200);
        if (statusEl) {
          const shown = Math.min(filtered.length, 200);
          statusEl.textContent = `Matched ${filtered.length} of ${summary.totalComponents} components (displaying ${shown}) across 15 public repositories`;
        }
        for (const b of tierBtns) b.setAttribute("aria-pressed", String(b.dataset.tierFilter === state.tier));
      }

      for (const b of tierBtns) {
        b.addEventListener("click", () => { state.tier = b.dataset.tierFilter || "all"; update(); });
      }
      repoSelect?.addEventListener("change", () => { state.repo = repoSelect.value || "all"; update(); });
      licSelect?.addEventListener("change", () => { state.license = licSelect.value || "all"; update(); });
      typeSelect?.addEventListener("change", () => { state.type = typeSelect.value || "all"; update(); });
      searchEl?.addEventListener("input", () => { state.query = searchEl.value || ""; update(); });

      update();
    } catch (err) {
      if (statusEl) statusEl.textContent = `Displaying pre-rendered 15-repo SBOM summary (${err.message}).`;
    }
  });
}
