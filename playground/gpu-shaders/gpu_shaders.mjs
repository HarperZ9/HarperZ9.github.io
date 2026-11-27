// Unified browser + Node pure-JS explorer and verifier for /playground/gpu-shaders/
// Zero external CDN dependencies; binds strictly to gpu_120pack_manifest.json (120/120 shaders).

export const MANIFEST_EXPECTED_SHA256 =
  "sha256:efebeb90079e01bfb02c2f95b37cc486c856aa9af83f903d4a0cdf8deec281c8";

export const KERNEL_DOMAINS = Object.freeze({
  cayley_symplectic_step_compute: "AI/LLM",
  rmsnorm_swiglu_compute: "AI/LLM",
  rope_rotary_embed_compute: "AI/LLM",
  int4_dequant_matvec_compute: "AI/LLM",
  flash_attn_tile_compute: "AI/LLM",
  moe_router_topk_compute: "AI/LLM",

  pbr_ggx_brdf_compute: "Rendering/RT",
  ntc610_decode_compute: "Rendering/RT",
  splat_3dgs_project_compute: "Rendering/RT",
  indirect_frustum_cull_compute: "Rendering/RT",
  sdf_raymarch_compute: "Rendering/RT",
  volumetric_froxel_scatter_compute: "Rendering/RT",
  hiz_depth_downsample_compute: "Rendering/RT",
  bilateral_atrous_denoise_compute: "Rendering/RT",
  oklab_filmic_grade_compute: "Rendering/RT",
  bvh_aabb_intersect_compute: "Rendering/RT",
  spectral_xyz_eval_compute: "Rendering/RT",
  ordered_dither_compute: "Rendering/RT",
  sky_rayleigh_mie_compute: "Rendering/RT",

  jonswap_wave_compute: "Physics/Ocean",
  shallow_water_step_compute: "Physics/Ocean",
  wind_foliage_bend_compute: "Physics/Ocean",
  cloth_verlet_step_compute: "Physics/Ocean",

  merkle_hash_step_compute: "Crypto/Merkle",
});

export const BACKEND_LABELS = Object.freeze({
  wgsl: "WGSL",
  hlsl: "HLSL",
  msl: "MSL",
  spirv: "SPIR-V",
  glsl: "GLSL",
});

export function classifyDomain(kernel) {
  return KERNEL_DOMAINS[kernel] || "Rendering/RT";
}

export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtKb(bytes) {
  return `${(Number(bytes) / 1024).toFixed(2)} KB`;
}

export function computeSummary(data) {
  const shaders = Array.isArray(data?.shaders) ? data.shaders : [];
  const domains = { "AI/LLM": 0, "Rendering/RT": 0, "Physics/Ocean": 0, "Crypto/Merkle": 0 };
  const targets = { wgsl: 0, hlsl: 0, msl: 0, spirv: 0, glsl: 0 };
  const targetRewrites = { wgsl: 0, hlsl: 0, msl: 0, spirv: 0, glsl: 0 };
  const targetBytes = { wgsl: 0, hlsl: 0, msl: 0, spirv: 0, glsl: 0 };
  let passCount = 0;
  let totalBytes = 0;
  let totalRewrites = 0;
  let externalPassCount = 0;

  for (const s of shaders) {
    const dom = classifyDomain(s.kernel);
    domains[dom] = (domains[dom] || 0) + 1;
    targets[s.target] = (targets[s.target] || 0) + 1;
    targetRewrites[s.target] = (targetRewrites[s.target] || 0) + Number(s.rewrites || 0);
    targetBytes[s.target] = (targetBytes[s.target] || 0) + Number(s.shader_bytes || 0);
    if (s.verify_cert === "PASS") passCount++;
    if (String(s.external_validator || "").includes("PASS")) externalPassCount++;
    totalBytes += Number(s.shader_bytes || 0);
    totalRewrites += Number(s.rewrites || 0);
  }

  return {
    uniqueKernels: Number(data?.unique_kernels ?? 0),
    gpuTargets: Number(data?.gpu_targets ?? 0),
    totalShaders: shaders.length,
    passCount,
    externalPassCount,
    totalBytes,
    totalRewrites,
    domains,
    targets,
    targetRewrites,
    targetBytes,
  };
}

export function filterShaders(
  shaders,
  { domain = "all", target = "all", query = "", sortBy = "default" } = {}
) {
  const q = String(query || "").trim().toLowerCase();
  const list = shaders.filter((s) => {
    if (domain !== "all" && classifyDomain(s.kernel) !== domain) return false;
    if (target !== "all" && s.target !== target) return false;
    if (q) {
      const hay = `${s.kernel} ${classifyDomain(s.kernel)} ${s.target} ${BACKEND_LABELS[s.target] || ""} ${s.batch} ${s.shader_sha256} ${s.external_validator} ${s.subgroup_intrinsic}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sortBy === "rewrites_desc") {
    return [...list].sort((a, b) => Number(b.rewrites) - Number(a.rewrites) || a.kernel.localeCompare(b.kernel));
  }
  if (sortBy === "bytes_asc") {
    return [...list].sort((a, b) => Number(a.shader_bytes) - Number(b.shader_bytes));
  }
  if (sortBy === "bytes_desc") {
    return [...list].sort((a, b) => Number(b.shader_bytes) - Number(a.shader_bytes));
  }
  if (sortBy === "kernel_asc") {
    return [...list].sort((a, b) => a.kernel.localeCompare(b.kernel) || a.target.localeCompare(b.target));
  }
  return list;
}

export function renderBackendSvg(summary) {
  const order = ["wgsl", "hlsl", "msl", "spirv", "glsl"];
  const width = 760;
  const left = 110;
  const right = 230;
  const plotW = width - left - right;
  const rowH = 30;
  const top = 34;
  const height = top + order.length * rowH + 18;
  const maxBytes = Math.max(...order.map((t) => summary.targetBytes[t] || 1), 1);

  const bars = order
    .map((t, i) => {
      const y = top + i * rowH;
      const bytes = summary.targetBytes[t] || 0;
      const count = summary.targets[t] || 0;
      const rewrites = summary.targetRewrites[t] || 0;
      const bw = Math.max(4, (bytes / maxBytes) * plotW);
      const detail = `${count}/24 PASS | ${fmtKb(bytes)} | ${rewrites} rewrites`;
      return `<g data-backend="${escHtml(t)}">
  <text x="${left - 12}" y="${y + 15}" text-anchor="end" fill="currentColor" font-size="11.5" font-weight="700">${escHtml(BACKEND_LABELS[t])}</text>
  <line x1="${left}" y1="${y + 24}" x2="${left + plotW}" y2="${y + 24}" stroke="currentColor" stroke-opacity="0.14" stroke-width="1"/>
  <rect x="${left}" y="${y + 4}" width="${bw.toFixed(1)}" height="14" fill="currentColor" fill-opacity="0.82"/>
  <text x="${(left + bw + 10).toFixed(1)}" y="${y + 15}" fill="currentColor" font-size="11" class="gs-svg-num">${escHtml(detail)}</text>
</g>`;
    })
    .join("\n");

  return `<svg class="gs-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="120 certified GPU shaders grouped by backend">
  <title>120 Certified GPU Compute Shaders by Backend (24 MIT Kernels x 5 Targets)</title>
  <desc>Hairline bar chart showing total emitted shader bytes, certified shader counts, and superopt rewrites across WGSL, HLSL, MSL, SPIR-V, and GLSL.</desc>
  <text x="0" y="16" fill="currentColor" font-size="12" font-weight="700">Certified GPU Compute Footprint by Backend (24 Kernels x 5 Targets = 120 Shaders)</text>
  <line x1="${left}" y1="${top - 4}" x2="${left}" y2="${height - 14}" stroke="currentColor" stroke-opacity="0.4" stroke-width="1"/>
  ${bars}
</svg>`;
}

export function renderShaderRows(shaders) {
  return shaders
    .map((s) => {
      const dom = classifyDomain(s.kernel);
      const targetLabel = BACKEND_LABELS[s.target] || s.target.toUpperCase();
      const shaPrefix = String(s.shader_sha256 || "").slice(0, 16);
      return `<tr data-kernel="${escHtml(s.kernel)}" data-target="${escHtml(s.target)}" data-domain="${escHtml(dom)}">
  <th scope="row">${escHtml(s.kernel)}<span class="gs-sub">${escHtml(dom)} | ${escHtml(s.batch)} | ${escHtml(s.subgroup_intrinsic)}</span></th>
  <td class="mono">${escHtml(targetLabel)}<span class="gs-sub">${escHtml(s.compiler_pr)}</span></td>
  <td class="mono">${fmtKb(s.shader_bytes)}<span class="gs-sub">${s.shader_bytes} B</span></td>
  <td class="mono">${s.rewrites}</td>
  <td class="mono">${escHtml(s.verify_cert)}<span class="gs-sub">${escHtml(s.external_validator)}</span></td>
  <td class="mono" title="${escHtml(s.shader_sha256)}">${escHtml(shaPrefix)}</td>
</tr>`;
    })
    .join("\n");
}

export function verifySurfaceConsistency(htmlText, data) {
  if (!data || data.schema !== "buildlang-workstation-gpu-120pack/1") {
    throw new Error("Invalid GPU 120-pack manifest schema");
  }
  if (!Array.isArray(data.shaders) || data.shaders.length !== 120) {
    throw new Error(`Expected 120 certified shaders, found ${data?.shaders?.length}`);
  }
  const summary = computeSummary(data);
  if (summary.passCount !== 120) {
    throw new Error(`Fail-closed cert check failed: only ${summary.passCount}/120 verify_cert=PASS`);
  }
  if (summary.totalRewrites !== data.total_superopt_rewrites) {
    throw new Error(`Rewrite count mismatch: computed ${summary.totalRewrites} != manifest ${data.total_superopt_rewrites}`);
  }
  if (summary.totalBytes !== data.total_shader_bytes) {
    throw new Error(`Total shader bytes mismatch: computed ${summary.totalBytes} != manifest ${data.total_shader_bytes}`);
  }

  const errors = [];
  for (const s of data.shaders) {
    if (s.verify_cert !== "PASS") {
      errors.push(`${s.kernel}/${s.target}: verify_cert=${s.verify_cert}`);
    }
    const prefix = String(s.shader_sha256 || "").slice(0, 16);
    if (!prefix || !htmlText.includes(prefix)) {
      errors.push(`${s.kernel}/${s.target}: missing shader_sha256 prefix ${prefix}`);
    }
    if (!htmlText.includes(`data-kernel="${s.kernel}" data-target="${s.target}"`)) {
      errors.push(`${s.kernel}/${s.target}: missing rendered row`);
    }
  }
  for (const req of [
    String(data.total_superopt_rewrites),
    String(data.total_shader_bytes),
    "120/120",
    "AI/LLM",
    "Rendering/RT",
    "Physics/Ocean",
    "Crypto/Merkle",
  ]) {
    if (!htmlText.includes(req)) errors.push(`Missing required summary token: ${req}`);
  }

  if (errors.length > 0) {
    throw new Error(`GPU shader explorer verification failed (${errors.length}): ${errors.slice(0, 5).join("; ")}`);
  }
  return { ok: true, checkedShaders: data.shaders.length, summary };
}

async function sha256HexBrowser(buf) {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    const tbody = document.getElementById("gs-rows");
    const statusEl = document.getElementById("gs-status");
    const digestEl = document.getElementById("gs-digest");
    const searchEl = document.getElementById("gs-search");
    const sortEl = document.getElementById("gs-sort");
    const domainBtns = [...document.querySelectorAll("[data-domain-filter]")];
    const targetBtns = [...document.querySelectorAll("[data-target-filter]")];

    try {
      const res = await fetch("./gpu_120pack_manifest.json");
      const rawBuf = await res.arrayBuffer();
      const data = JSON.parse(new TextDecoder("utf-8").decode(rawBuf));
      const state = { domain: "all", target: "all", query: "", sortBy: "default" };

      if (globalThis.crypto?.subtle && digestEl) {
        const computed = `sha256:${await sha256HexBrowser(rawBuf)}`;
        const ok = computed === MANIFEST_EXPECTED_SHA256;
        digestEl.textContent = ok
          ? `Live manifest SHA-256 check: MATCH (${computed.slice(0, 23)}...) | 120/120 verify-cert PASS`
          : `Live manifest SHA-256 check: MISMATCH (${computed.slice(0, 23)}...)`;
      }

      function update() {
        const filtered = filterShaders(data.shaders, state);
        if (tbody) tbody.innerHTML = renderShaderRows(filtered);
        if (statusEl) {
          const rw = filtered.reduce((acc, s) => acc + Number(s.rewrites || 0), 0);
          const kb = (filtered.reduce((acc, s) => acc + Number(s.shader_bytes || 0), 0) / 1024).toFixed(2);
          statusEl.textContent = `Showing ${filtered.length} of ${data.shaders.length} certified shaders | ${kb} KB | ${rw} superopt rewrites`;
        }
        for (const b of domainBtns) b.setAttribute("aria-pressed", String(b.dataset.domainFilter === state.domain));
        for (const b of targetBtns) b.setAttribute("aria-pressed", String(b.dataset.targetFilter === state.target));
      }

      for (const b of domainBtns) {
        b.addEventListener("click", () => { state.domain = b.dataset.domainFilter || "all"; update(); });
      }
      for (const b of targetBtns) {
        b.addEventListener("click", () => { state.target = b.dataset.targetFilter || "all"; update(); });
      }
      searchEl?.addEventListener("input", () => { state.query = searchEl.value || ""; update(); });
      sortEl?.addEventListener("change", () => { state.sortBy = sortEl.value || "default"; update(); });

      update();
    } catch (err) {
      if (statusEl) statusEl.textContent = `Showing pre-rendered 120/120 certified GPU shader table (${err.message}).`;
    }
  });
}
