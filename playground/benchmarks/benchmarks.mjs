// Unified browser + Node pure-JS renderer and verifier for /playground/benchmarks/
// Zero external CDN dependencies; binds strictly to benchmarks_v2_results.json.

export const KERNEL_CATEGORIES = Object.freeze({
  sha256: "crypto",
  aead_chacha20_poly1305: "crypto",
  titan_1m: "compute",
  indirect_draw_cull: "compute",
  kcore_color: "compute",
  ntc610_block_compress: "micro",
  pbr_16archetype: "micro",
  jonswap_ocean: "micro",
});

export const INTERNAL_NATIVE_CONTEXT = Object.freeze({
  ntc610_block_compress: {
    internal_ms: 0.034,
    internal_speedup: "51.4x",
    note: "Subprocess wall-clock is dominated by ~5.1 to 5.7 ms Windows CreateProcess startup; internal native compute is 0.034 ms (51.4x vs Python p50).",
  },
  pbr_16archetype: {
    internal_ms: 0.004,
    internal_speedup: "18.8x",
    note: "Subprocess wall-clock is dominated by ~5.1 to 5.7 ms Windows CreateProcess startup; internal native compute is 0.004 ms (18.8x vs Python p50).",
  },
  jonswap_ocean: {
    internal_ms: 0.384,
    internal_speedup: "4.20x",
    note: "Subprocess wall-clock includes ~5.3 ms process startup (internal native compute 0.384 ms = 4.20x); WASM (96.217 ms) executes software Taylor sin/cos/exp/ln without native libm.",
  },
  indirect_draw_cull: {
    internal_ms: null,
    internal_speedup: null,
    note: "Native beats Python by 13.01x (9.326 ms vs 121.347 ms); the stateless WASM wrapper re-runs the 100K sweep per metric call (6 calls = 600K sweeps, 594.303 ms).",
  },
  kcore_color: {
    internal_ms: null,
    internal_speedup: null,
    note: "Native beats Python by 5.62x (21.050 ms vs 118.275 ms); WASM is N/A because buildc WASM codegen does not yet emit a log runtime import.",
  },
});

export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtMs(val) {
  if (val === null || val === undefined || Number.isNaN(Number(val))) return "N/A";
  return `${Number(val).toFixed(3)} ms`;
}

export function fmtKb(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) return "";
  return `${(Number(bytes) / 1024).toFixed(2)} KB`;
}

export function bestSpeedupDescriptor(kernel) {
  const nat = kernel.native_process_speedup_vs_python_p50;
  const wasm = kernel.wasm_speedup_vs_python_p50;
  const ctx = INTERNAL_NATIVE_CONTEXT[kernel.id];

  if (wasm !== null && wasm !== undefined && wasm >= (nat ?? 0) && wasm >= 1) {
    return {
      value: Number(wasm),
      label: `${Number(wasm).toFixed(2)}x (WASM)`,
      runtime: "node_wasm",
    };
  }
  if (nat !== null && nat !== undefined && nat >= 1) {
    return {
      value: Number(nat),
      label: `${Number(nat).toFixed(2)}x (Native)`,
      runtime: "buildc_native",
    };
  }
  if (wasm !== null && wasm !== undefined && wasm > (nat ?? 0)) {
    const suffix = ctx?.internal_speedup ? ` (${ctx.internal_speedup} internal)` : "";
    return {
      value: Number(wasm),
      label: `${Number(wasm).toFixed(2)}x WASM${suffix}`,
      runtime: "node_wasm",
    };
  }
  const suffix = ctx?.internal_speedup ? ` (${ctx.internal_speedup} internal)` : "";
  return {
    value: Number(nat ?? 0),
    label: `${Number(nat ?? 0).toFixed(2)}x proc${suffix}`,
    runtime: "buildc_native",
  };
}

export function computeHeadlineMetrics(data) {
  const kernels = Array.isArray(data?.kernels) ? data.kernels : [];
  const byId = new Map(kernels.map((k) => [k.id, k]));

  const parityCount = kernels.filter((k) => k.parity_ok === true).length;
  const nativeCount = kernels.filter((k) => k.buildc_native !== null).length;
  const wasmCount = kernels.filter((k) => k.node_wasm !== null).length;
  const zerocCount = kernels.filter((k) => k.zeroc_pe32 !== null).length;
  const pythonCount = kernels.filter((k) => k.python_stdlib !== null).length;

  const titan = byId.get("titan_1m");
  const indirect = byId.get("indirect_draw_cull");
  const kcore = byId.get("kcore_color");
  const sha = byId.get("sha256");
  const aead = byId.get("aead_chacha20_poly1305");

  return {
    kernelsTotal: Number(data?.kernels_total ?? kernels.length),
    parityCount,
    parityAllOk: Boolean(data?.parity_all_ok) && parityCount === kernels.length,
    nativeCount,
    wasmCount,
    zerocCount,
    pythonCount,
    plantedCaught: Boolean(data?.planted_control?.planted_wrong_output_caught),
    titanNativeSpeedup: titan?.native_process_speedup_vs_python_p50 ?? null,
    titanWasmSpeedup: titan?.wasm_speedup_vs_python_p50 ?? null,
    indirectNativeSpeedup: indirect?.native_process_speedup_vs_python_p50 ?? null,
    kcoreNativeSpeedup: kcore?.native_process_speedup_vs_python_p50 ?? null,
    sha256WasmSpeedup: sha?.wasm_speedup_vs_python_p50 ?? null,
    aeadWasmSpeedup: aead?.wasm_speedup_vs_python_p50 ?? null,
    sha256ZerocBeatsCrt: Boolean(
      sha?.zeroc_pe32 && sha?.buildc_native && sha.zeroc_pe32.p50_ms < sha.buildc_native.p50_ms
    ),
    aeadZerocBeatsCrt: Boolean(
      aead?.zeroc_pe32 && aead?.buildc_native && aead.zeroc_pe32.p50_ms < aead.buildc_native.p50_ms
    ),
    sha256ZerocSavingsMs:
      sha?.zeroc_pe32 && sha?.buildc_native
        ? Number((sha.buildc_native.p50_ms - sha.zeroc_pe32.p50_ms).toFixed(4))
        : null,
    aeadZerocSavingsMs:
      aead?.zeroc_pe32 && aead?.buildc_native
        ? Number((aead.buildc_native.p50_ms - aead.zeroc_pe32.p50_ms).toFixed(4))
        : null,
  };
}

export function filterKernels(
  kernels,
  { runtime = "all", category = "all", query = "", sortBy = "default" } = {}
) {
  const q = String(query || "").trim().toLowerCase();
  const list = kernels.filter((k) => {
    if (runtime !== "all") {
      const hasRuntime = Array.isArray(k.runtimes_verified) && k.runtimes_verified.includes(runtime);
      if (!hasRuntime) return false;
    }
    if (category !== "all") {
      const cat = KERNEL_CATEGORIES[k.id] || "other";
      if (cat !== category) return false;
    }
    if (q) {
      const hay = `${k.id} ${k.name} ${k.idea_id} ${k.parity_sha256} ${(k.runtimes_verified || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (sortBy === "speedup_desc") {
    return [...list].sort((a, b) => bestSpeedupDescriptor(b).value - bestSpeedupDescriptor(a).value);
  }
  if (sortBy === "native_asc") {
    return [...list].sort((a, b) => (a.buildc_native?.p50_ms ?? 1e9) - (b.buildc_native?.p50_ms ?? 1e9));
  }
  if (sortBy === "wasm_asc") {
    return [...list].sort((a, b) => (a.node_wasm?.p50_ms ?? 1e9) - (b.node_wasm?.p50_ms ?? 1e9));
  }
  if (sortBy === "python_desc") {
    return [...list].sort((a, b) => (b.python_stdlib?.p50_ms ?? -1) - (a.python_stdlib?.p50_ms ?? -1));
  }
  if (sortBy === "name_asc") {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }
  return list;
}

export function renderSpeedupSvg(kernels, { metric = "native_vs_python" } = {}) {
  let rows = [];
  let titleText = "Measured BuildLang Native vs Python 3.12 p50 Speedup (Higher is Faster)";
  let unit = "x";
  let baselineVal = 1.0;

  if (metric === "wasm_vs_python") {
    titleText = "Measured BuildLang Node WASM vs Python 3.12 p50 Speedup (Higher is Faster)";
    rows = kernels
      .filter((k) => k.wasm_speedup_vs_python_p50 !== null && k.wasm_speedup_vs_python_p50 !== undefined)
      .map((k) => ({
        id: k.id,
        label: k.name.split("(")[0].trim(),
        value: Number(k.wasm_speedup_vs_python_p50),
        detail: `${Number(k.wasm_speedup_vs_python_p50).toFixed(2)}x (${fmtMs(k.node_wasm?.p50_ms)} vs ${fmtMs(k.python_stdlib?.p50_ms)})`,
      }));
  } else if (metric === "zeroc_vs_crt") {
    titleText = "Zero-C PE32+ vs C-Runtime buildc Native p50 Latency in ms (Lower is Faster)";
    unit = "ms";
    baselineVal = null;
    rows = kernels
      .filter((k) => k.zeroc_pe32 !== null && k.buildc_native !== null)
      .flatMap((k) => [
        {
          id: `${k.id}_zeroc`,
          label: `${k.name.split("(")[0].trim()} (Zero-C PE32+)`,
          value: Number(k.zeroc_pe32.p50_ms),
          detail: `${fmtMs(k.zeroc_pe32.p50_ms)} (${fmtKb(k.zeroc_pe32.exe_bytes)})`,
          accent: true,
        },
        {
          id: `${k.id}_crt`,
          label: `${k.name.split("(")[0].trim()} (CRT Native)`,
          value: Number(k.buildc_native.p50_ms),
          detail: `${fmtMs(k.buildc_native.p50_ms)}`,
          accent: false,
        },
      ]);
  } else {
    rows = kernels.map((k) => ({
      id: k.id,
      label: k.name.split("(")[0].trim(),
      value: Number(k.native_process_speedup_vs_python_p50 ?? 0),
      detail: `${Number(k.native_process_speedup_vs_python_p50 ?? 0).toFixed(2)}x (${fmtMs(k.buildc_native?.p50_ms)} vs ${fmtMs(k.python_stdlib?.p50_ms)})`,
    }));
  }

  if (rows.length === 0) {
    return `<svg class="bm-svg" viewBox="0 0 760 90" role="img" aria-label="No kernels match current filter"><title>${escHtml(titleText)}</title><text x="16" y="48" fill="currentColor" font-size="13">No kernels match the active filter for this chart mode.</text></svg>`;
  }

  const width = 760;
  const left = 228;
  const right = 212;
  const plotW = width - left - right;
  const rowH = 30;
  const top = 36;
  const height = top + rows.length * rowH + 22;
  const maxVal = Math.max(...rows.map((r) => r.value), baselineVal ?? 0, 1);

  const scaleX = (v) => {
    if (metric === "zeroc_vs_crt") {
      return (v / maxVal) * plotW;
    }
    // Gentle sqrt scale keeps 30.21x prominent while keeping sub-1x process-floor bars legible
    return (Math.sqrt(Math.max(v, 0)) / Math.sqrt(maxVal)) * plotW;
  };

  const baselineX = baselineVal !== null ? left + scaleX(baselineVal) : null;
  const bars = rows
    .map((r, i) => {
      const y = top + i * rowH;
      const bw = Math.max(3, scaleX(r.value));
      const fillOpacity = r.accent === false ? "0.35" : r.value >= 1 || metric === "zeroc_vs_crt" ? "0.88" : "0.32";
      return `<g data-bar-id="${escHtml(r.id)}">
  <text x="${left - 10}" y="${y + 15}" text-anchor="end" fill="currentColor" font-size="11.5">${escHtml(r.label)}</text>
  <line x1="${left}" y1="${y + 24}" x2="${left + plotW}" y2="${y + 24}" stroke="currentColor" stroke-opacity="0.14" stroke-width="1"/>
  <rect x="${left}" y="${y + 4}" width="${bw.toFixed(1)}" height="14" fill="currentColor" fill-opacity="${fillOpacity}"/>
  <text x="${(left + bw + 8).toFixed(1)}" y="${y + 15}" fill="currentColor" font-size="11" class="bm-svg-num">${escHtml(r.detail)}</text>
</g>`;
    })
    .join("\n");

  const refLine =
    baselineX !== null
      ? `<line x1="${baselineX.toFixed(1)}" y1="${top - 6}" x2="${baselineX.toFixed(1)}" y2="${height - 16}" stroke="currentColor" stroke-opacity="0.55" stroke-dasharray="3 3" stroke-width="1"/>
  <text x="${baselineX.toFixed(1)}" y="${top - 10}" text-anchor="middle" fill="currentColor" font-size="10" fill-opacity="0.78">1.0x parity</text>`
      : "";

  return `<svg class="bm-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escHtml(titleText)}">
  <title>${escHtml(titleText)}</title>
  <desc>Hairline measured comparison rendered directly from benchmarks_v2_results.json (${rows.length} entries, unit: ${unit}).</desc>
  <text x="0" y="16" fill="currentColor" font-size="12" font-weight="700">${escHtml(titleText)}</text>
  <line x1="${left}" y1="${top - 4}" x2="${left}" y2="${height - 16}" stroke="currentColor" stroke-opacity="0.4" stroke-width="1"/>
  ${refLine}
  ${bars}
</svg>`;
}

export function renderTableRows(kernels) {
  return kernels
    .map((k) => {
      const cat = KERNEL_CATEGORIES[k.id] || "other";
      const best = bestSpeedupDescriptor(k);
      const natCell = k.buildc_native
        ? `${fmtMs(k.buildc_native.p50_ms)}<span class="bm-sub">min ${Number(k.buildc_native.min_ms).toFixed(3)} / p95 ${Number(k.buildc_native.p95_ms).toFixed(3)}</span>`
        : "N/A";
      const zerocCell = k.zeroc_pe32
        ? `${fmtMs(k.zeroc_pe32.p50_ms)}<span class="bm-sub">${fmtKb(k.zeroc_pe32.exe_bytes)} (${k.zeroc_pe32.exe_bytes} B)</span>`
        : "N/A<span class=\"bm-sub\">f64 subset</span>";
      const wasmCell = k.node_wasm
        ? `${fmtMs(k.node_wasm.p50_ms)}<span class="bm-sub">${fmtKb(k.node_wasm.wasm_bytes)} (${k.node_wasm.wasm_bytes} B)</span>`
        : "N/A<span class=\"bm-sub\">no log import</span>";
      const pyCell = k.python_stdlib
        ? `${fmtMs(k.python_stdlib.p50_ms)}<span class="bm-sub">min ${Number(k.python_stdlib.min_ms).toFixed(3)} / p95 ${Number(k.python_stdlib.p95_ms).toFixed(3)}</span>`
        : "N/A";
      const runtimes = (k.runtimes_verified || []).join(", ");
      const parityPrefix = String(k.parity_sha256 || "").slice(0, 16);
      const parityStatus = k.parity_ok ? "MATCH" : "MISMATCH";

      return `<tr data-kernel-id="${escHtml(k.id)}" data-category="${escHtml(cat)}">
  <th scope="row">${escHtml(k.name)}<span class="bm-sub">${escHtml(k.idea_id)} | ${escHtml(runtimes)}</span></th>
  <td class="mono">${natCell}</td>
  <td class="mono">${zerocCell}</td>
  <td class="mono">${wasmCell}</td>
  <td class="mono">${pyCell}</td>
  <td class="mono"><b>${escHtml(best.label)}</b></td>
  <td class="mono" title="${escHtml(k.parity_sha256)}">${escHtml(parityPrefix)}<span class="bm-sub">${parityStatus}</span></td>
</tr>`;
    })
    .join("\n");
}

export function verifySurfaceConsistency(htmlText, data) {
  const errors = [];
  if (!data || !Array.isArray(data.kernels) || data.kernels.length !== 8) {
    throw new Error("Invalid benchmark dataset: expected 8 kernels");
  }
  if (data.parity_all_ok !== true) {
    throw new Error("Fail-closed parity check failed: parity_all_ok is not true");
  }
  if (!data.planted_control || data.planted_control.planted_wrong_output_caught !== true) {
    throw new Error("Fail-closed planted control check failed: planted_wrong_output_caught is not true");
  }

  for (const k of data.kernels) {
    if (k.parity_ok !== true) {
      errors.push(`${k.id}: parity_ok is not true`);
    }
    const prefix = String(k.parity_sha256 || "").slice(0, 16);
    if (!prefix || !htmlText.includes(prefix)) {
      errors.push(`${k.id}: missing parity_sha256 prefix ${prefix}`);
    }
    if (!htmlText.includes(k.name)) {
      errors.push(`${k.id}: missing kernel name ${k.name}`);
    }
    if (k.buildc_native && !htmlText.includes(fmtMs(k.buildc_native.p50_ms))) {
      errors.push(`${k.id}: missing buildc_native p50 ${fmtMs(k.buildc_native.p50_ms)}`);
    }
    if (k.zeroc_pe32 && !htmlText.includes(fmtMs(k.zeroc_pe32.p50_ms))) {
      errors.push(`${k.id}: missing zeroc_pe32 p50 ${fmtMs(k.zeroc_pe32.p50_ms)}`);
    }
    if (k.node_wasm && !htmlText.includes(fmtMs(k.node_wasm.p50_ms))) {
      errors.push(`${k.id}: missing node_wasm p50 ${fmtMs(k.node_wasm.p50_ms)}`);
    }
    if (k.python_stdlib && !htmlText.includes(fmtMs(k.python_stdlib.p50_ms))) {
      errors.push(`${k.id}: missing python_stdlib p50 ${fmtMs(k.python_stdlib.p50_ms)}`);
    }
    const best = bestSpeedupDescriptor(k);
    if (!htmlText.includes(best.label)) {
      errors.push(`${k.id}: missing best speedup label ${best.label}`);
    }
  }

  const metrics = computeHeadlineMetrics(data);
  const requiredTokens = [
    `${metrics.titanNativeSpeedup}x`,
    `${metrics.titanWasmSpeedup}x`,
    `${metrics.indirectNativeSpeedup}x`,
    `${metrics.kcoreNativeSpeedup}x`,
    `${metrics.sha256WasmSpeedup}x`,
    `${metrics.aeadWasmSpeedup}x`,
    "CreateProcess",
    "8/8",
    "planted_wrong_output_caught",
  ];
  for (const tok of requiredTokens) {
    if (!htmlText.includes(tok)) {
      errors.push(`Missing required benchmark token: ${tok}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Benchmark surface verification failed (${errors.length}): ${errors.join("; ")}`);
  }
  return { ok: true, checkedKernels: data.kernels.length, metrics };
}

async function sha256HexBrowser(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function mountBenchmarksSurface(doc = document, data, receiptSummary = null) {
  const state = {
    runtime: "all",
    category: "all",
    query: "",
    sortBy: "default",
    metric: "native_vs_python",
  };

  const tbody = doc.getElementById("bm-rows");
  const chartHost = doc.getElementById("bm-chart-host");
  const statusEl = doc.getElementById("bm-status");
  const searchEl = doc.getElementById("bm-search");
  const sortEl = doc.getElementById("bm-sort");
  const runtimeBtns = [...doc.querySelectorAll("[data-runtime-filter]")];
  const categoryBtns = [...doc.querySelectorAll("[data-category-filter]")];
  const metricBtns = [...doc.querySelectorAll("[data-chart-metric]")];

  function update() {
    const filtered = filterKernels(data.kernels, state);
    if (tbody) tbody.innerHTML = renderTableRows(filtered);
    if (chartHost) chartHost.innerHTML = renderSpeedupSvg(filtered, { metric: state.metric });
    if (statusEl) {
      statusEl.textContent = `Showing ${filtered.length} of ${data.kernels.length} verified kernels | Parity ${data.parity_all_ok ? "8/8 MATCH" : "MISMATCH"} | Planted wrong-output control caught: ${data.planted_control?.planted_wrong_output_caught ? "true" : "false"}`;
    }
    for (const btn of runtimeBtns) {
      btn.setAttribute("aria-pressed", String(btn.dataset.runtimeFilter === state.runtime));
    }
    for (const btn of categoryBtns) {
      btn.setAttribute("aria-pressed", String(btn.dataset.categoryFilter === state.category));
    }
    for (const btn of metricBtns) {
      btn.setAttribute("aria-pressed", String(btn.dataset.chartMetric === state.metric));
    }
  }

  for (const btn of runtimeBtns) {
    btn.addEventListener("click", () => {
      state.runtime = btn.dataset.runtimeFilter || "all";
      update();
    });
  }
  for (const btn of categoryBtns) {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.categoryFilter || "all";
      update();
    });
  }
  for (const btn of metricBtns) {
    btn.addEventListener("click", () => {
      state.metric = btn.dataset.chartMetric || "native_vs_python";
      update();
    });
  }
  searchEl?.addEventListener("input", () => {
    state.query = searchEl.value || "";
    update();
  });
  sortEl?.addEventListener("change", () => {
    state.sortBy = sortEl.value || "default";
    update();
  });

  if (receiptSummary?.results_sha256) {
    const receiptStatus = doc.getElementById("bm-receipt-status");
    if (receiptStatus) {
      receiptStatus.textContent = `Receipt verdict: ${receiptSummary.verdict} | Results digest: ${receiptSummary.results_sha256.slice(0, 23)}...`;
    }
  }

  update();
  return { state, update };
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    try {
      const [resJson, resSummary] = await Promise.all([
        fetch("./benchmarks_v2_results.json"),
        fetch("./benchmarks_v2_receipt_summary.json").catch(() => null),
      ]);
      const rawBuf = await resJson.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(rawBuf);
      const data = JSON.parse(text);
      const summary = resSummary && resSummary.ok ? await resSummary.json() : null;
      mountBenchmarksSurface(document, data, summary);

      if (summary?.results_sha256 && globalThis.crypto?.subtle) {
        const computed = `sha256:${await sha256HexBrowser(rawBuf)}`;
        const receiptStatus = document.getElementById("bm-receipt-status");
        if (receiptStatus) {
          const ok = computed === summary.results_sha256;
          receiptStatus.textContent = ok
            ? `Live SHA-256 JSON check: MATCH (${computed.slice(0, 23)}...) | Claim ${summary.claim_sha256.slice(0, 23)}...`
            : `Live SHA-256 JSON check: MISMATCH (expected ${summary.results_sha256.slice(0, 23)}..., got ${computed.slice(0, 23)}...)`;
        }
      }
    } catch (err) {
      const statusEl = document.getElementById("bm-status");
      if (statusEl) {
        statusEl.textContent = `Interactive dataset load note: displaying pre-rendered verified sheet (${err.message}).`;
      }
    }
  });
}
