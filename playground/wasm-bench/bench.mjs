// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
//
// Wave 74A: Unified Browser + Node Live Verification Bench for 18 BuildLang WASM Modules.
// Zero external dependencies, zero CDN calls, zero runtime glue.

export const WASM_ENV = {
  print_i64() {},
  print_u64() {},
  print_f64() {},
  print_bool() {},
  print_str() {},
};

export function checkModuleAssertions(slug, ex) {
  switch (slug) {
    case "buoy_ocean_field": {
      const hs = ex.jonswap_hs_rec(2.40, 10.5);
      const maxAk = ex.gerstner_max_ak(2.40, 10.5);
      const csum = ex.gerstner_eval_checksum(2.40, 10.5, 12.0);
      const vOk = ex.validate_buoy(2.40, 10.5, maxAk);
      const vNeg = ex.validate_buoy(-1.2, 10.5, 0.12);
      const vBrk = ex.validate_buoy(2.40, 10.5, 1.35);
      const ok = Math.abs(hs - 2.40) < 1e-4 && vOk === 1 && vNeg === -1 && vBrk === -2 && Number.isFinite(csum);
      return { ok, metric: `Hs=${hs.toFixed(3)}m max_ak=${maxAk.toFixed(4)}`, control: `neg=${vNeg}, brk=${vBrk}` };
    }
    case "metamer_divergence": {
      const dxyz = ex.metamer_d65_delta_xyz();
      const deAlt = ex.metamer_alt_delta_e76();
      const rms = ex.metamer_spec_rms();
      const rc = ex.metamer_guard(dxyz, rms, deAlt);
      const ok = dxyz < 1e-9 && deAlt > 1.0 && rms > 0.01 && rc === -401;
      return { ok, metric: `dXYZ=${dxyz.toExponential(1)} dE76=${deAlt.toFixed(2)}`, control: `guard=${rc}` };
    }
    case "console_shader_stack": {
      const csum = ex.shader_frame_checksum();
      const maxCh = ex.shader_max_chan();
      const vOk = ex.validate_radiance(0.5, 0.5, 0.5);
      const vNeg = ex.validate_radiance(-0.15, 0.4, 0.5);
      const vNan = ex.validate_radiance(0.4, Number.NaN, 0.5);
      const ok = Number.isFinite(csum) && maxCh <= 1.0 && vOk === 1 && vNeg === -1 && vNan === -2;
      return { ok, metric: `csum=${csum.toFixed(3)} max=${maxCh.toFixed(3)}`, control: `neg=${vNeg}, nan=${vNan}` };
    }
    case "midcentury_synthesis_grid": {
      const area = ex.grid_total_area_mm2();
      const cleanRc = ex.grid_validate(0);
      const colRc = ex.grid_validate(1);
      const aspRc = ex.grid_validate(2);
      const ok = area > 1000.0 && cleanRc === 1 && colRc === -1 && aspRc === -2;
      return { ok, metric: `area=${area.toFixed(1)}mm2`, control: `col=${colRc}, asp=${aspRc}` };
    }
    case "confidence_word_calib": {
      const b3 = ex.confidence_band(0.004, 0.03, 1);
      const b0 = ex.confidence_band(0.450, 0.40, 1);
      const rcClean = ex.audit_claim(0.004, 0.03, 1, 3, 0);
      const rcOver = ex.audit_claim(0.04, 0.22, 1, 1, 1);
      const rcInv = ex.audit_claim(1.50, -0.10, 1, 0, 0);
      const ok = b3 === 3 && b0 === 0 && rcClean === 0 && rcOver !== 0 && rcInv !== 0;
      return { ok, metric: `bands=[${b3}..${b0}]`, control: `over=${rcOver}, inv=${rcInv}` };
    }
    case "living_type_bezier": {
      const c144 = ex.optical_contrast(144.0);
      const kern = ex.kern_av_em();
      const cleanHits = ex.count_bezier_self_intersections(0.0, 0.0, 0.0, 0.9, 0.8, 0.9, 0.8, 0.0);
      const bowHits = ex.count_bezier_self_intersections(0.0, 0.0, 2.5, 1.5, -1.5, 1.5, 1.0, 0.0);
      const ok = c144 > 1.0 && Number.isFinite(kern) && cleanHits === 0 && bowHits > 0;
      return { ok, metric: `c144=${c144.toFixed(3)} kern=${kern.toFixed(4)}`, control: `bowtie=${bowHits}` };
    }
    case "honest_exit_valve": {
      const hackA = ex.arm_metric(0, 0);
      const hackC = ex.arm_metric(2, 0);
      const reseats = ex.arm_reseats(2, 600);
      const rcC = ex.audit_arm_safety(2);
      const rcBad = ex.audit_arm_safety(3);
      const ok = hackA > 0.95 && hackC === 0.0 && reseats === 300 && rcC === 0 && rcBad === -101;
      return { ok, metric: `hackC=0 reseats=${reseats}`, control: `bad=${rcBad}` };
    }
    case "catastrophe_surge": {
      const csum = ex.surge_3shock_checksum();
      const ru30 = ex.eval_shock(1, 105.0, 1);
      const su30 = ex.eval_shock(0, 105.0, 1);
      const rcOk = ex.check_conservation(75.0, 75.0);
      const rcLeak = ex.check_conservation(80.0, 75.0);
      const ok = Number.isFinite(csum) && ru30 === 0.0 && su30 > 30.0 && rcOk === 0 && rcLeak === -101;
      return { ok, metric: `surge=${su30.toFixed(1)} ration=${ru30.toFixed(1)}`, control: `leak=${rcLeak}` };
    }
    case "blackout_commons": {
      const rec15 = ex.verify_all_15_blackouts(67, 77, 78, 83);
      const q4 = ex.check_quorum(4);
      const q3 = ex.check_quorum(3);
      const ok = rec15 === 15 && q4 === 0 && q3 === -201;
      return { ok, metric: `recovered=${rec15}/15`, control: `quorum3=${q3}` };
    }
    case "community_homeostasis": {
      const ise1 = ex.sim_feedback(1, 0.22, 0.015, 180, 1);
      const ise10 = ex.sim_feedback(10, 0.22, 0.015, 180, 1);
      const rcClean = ex.check_stability(10, 0.22, 0.015);
      const rcRun = ex.check_stability(10, 0.95, 0.12);
      const ok = ise10 > ise1 && rcClean === 0 && rcRun === -301;
      return { ok, metric: `ISE_ratio=${(ise10 / ise1).toFixed(2)}x`, control: `runaway=${rcRun}` };
    }
    case "disclosure_penalty": {
      const pAud = ex.simulate_regime(1.0, 0.0, 0.15, 0.35, 1.2, 0.02);
      const pZero = ex.simulate_regime(1.0, 0.25, 0.0, 0.0, 1.0, 0.02);
      const okVal = ex.check_prob_bounds(pAud);
      const okBad = ex.check_prob_bounds(1.25);
      const ok = pAud > 0.5 && pZero < 0.02 && okVal === 1 && okBad === 0;
      return { ok, metric: `p_aud=${pAud.toFixed(3)} p_zero=${pZero.toFixed(3)}`, control: `oob=${okBad}` };
    }
    case "tree_wind_root_rot": {
      const sfAdapt = ex.solve_tree_metric(25.0, 18.0, 12.0, 0.28, 1.0e10, 62000.0, 1.0, 0.0, 3);
      const sfRot = ex.solve_tree_metric(25.0, 18.0, 12.0, 0.28, 1.0e10, 62000.0, 0.0, 0.45, 3);
      const rcNeg = ex.validate_tree(-10.0, 1.0e10, 62000.0, 0.0);
      const rcZero = ex.validate_tree(25.0, 1.0e10, 0.0, 0.0);
      const ok = sfAdapt > sfRot && rcNeg === -201 && rcZero === -202;
      return { ok, metric: `SF_adapt=${sfAdapt.toFixed(2)} SF_rot=${sfRot.toFixed(2)}`, control: `neg=${rcNeg}, z=${rcZero}` };
    }
    case "moat_egraph_cert_compress": {
      const rawS = ex.egraph_compress_metric(0);
      const compS = ex.egraph_compress_metric(1);
      const drift = ex.egraph_compress_metric(4);
      const ph = ex.egraph_compress_metric(5) >>> 0;
      const badR = ex.egraph_compress_metric(6);
      const red = ex.egraph_reduction_pct();
      const ok = rawS === 64 && compS === 8 && drift === 0 && badR === 1 && red === 87.5;
      return { ok, metric: `64->${compS} (${red.toFixed(1)}%) hash=${ph}`, control: `rule99=${badR}` };
    }
    case "moat_zerocopy_cap_ipc": {
      const deliv = ex.ipc_run_metric(0);
      const drops = ex.ipc_run_metric(1);
      const match = ex.ipc_run_metric(4);
      const forge = ex.ipc_run_metric(7);
      const ov = ex.ipc_run_metric(8);
      const ok = deliv === 4096 && drops === 0 && match === 1 && forge === 1 && ov === 2;
      return { ok, metric: `msgs=${deliv} drops=${drops}`, control: `forge=${forge}, ov=${ov}` };
    }
    case "moat_three_plate": {
      const tp = ex.three_plate_sweep(0);
      const tn = ex.three_plate_sweep(1);
      const fp = ex.three_plate_sweep(2);
      const fn = ex.three_plate_sweep(3);
      const bypass = ex.verify_three_plate(1, 1, 0);
      const ok = tp === 32 && tn === 32 && fp === 0 && fn === 0 && bypass === -801;
      return { ok, metric: `tp=${tp} tn=${tn} fp=${fp}`, control: `bypass=${bypass}` };
    }
    case "moat_ntc_block": {
      const ratio = ex.ntc_comp_ratio();
      const psnr = ex.ntc_eval_tile(0);
      const rcOob = ex.validate_latent(310, 0.25);
      const rcNan = ex.validate_latent(128, Number.NaN);
      const ok = ratio >= 5.0 && psnr >= 40.0 && rcOob === -1 && rcNan === -2;
      return { ok, metric: `${ratio.toFixed(2)}x PSNR=${psnr.toFixed(2)}dB`, control: `oob=${rcOob}, nan=${rcNan}` };
    }
    case "rsi_closed_loop": {
      const capB = ex.rsi_run_metric(1, 1, 1, 0);
      const hacksB = ex.rsi_run_metric(1, 1, 1, 2);
      const toolsB = ex.rsi_run_metric(1, 1, 1, 6);
      const ctrlOk = ex.rsi_verify_all_controls();
      const ok = capB >= 5.0 && hacksB === 0 && toolsB === 80 && ctrlOk === 1;
      return { ok, metric: `capB=${capB.toFixed(2)}x tools=${toolsB}`, control: `controls=${ctrlOk}` };
    }
    case "epigenetics_audit": {
      const acc = ex.epi_heldout_acc(0);
      const null1 = ex.epi_heldout_acc(1);
      const gOk = ex.epi_audit_gate(1000, 0);
      const gHack = ex.epi_audit_gate(1000, 2);
      const ok = acc >= 0.95 && null1 <= 0.45 && gOk === 0 && gHack === -501;
      return { ok, metric: `acc=${(acc * 100).toFixed(0)}% null=${(null1 * 100).toFixed(1)}%`, control: `shortcut=${gHack}` };
    }
    default:
      return { ok: false, metric: "unknown module", control: "n/a" };
  }
}

export async function runOneModule(entry, loadBytesFn, sha256HexFn) {
  const t0 = performance.now();
  const bytes = await loadBytesFn(entry.wasm_path);
  const actualSha = await sha256HexFn(bytes);
  if (actualSha !== entry.wasm_sha256) {
    return {
      idea_id: entry.idea_id,
      slug: entry.slug,
      pack: entry.pack,
      wasm_bytes: bytes.byteLength,
      sha_ok: false,
      expected_sha256: entry.wasm_sha256,
      actual_sha256: actualSha,
      ok: false,
      elapsed_ms: +(performance.now() - t0).toFixed(3),
      metric: "SHA-256 MISMATCH",
      control: "REJECTED_FAIL_CLOSED",
    };
  }
  const { instance } = await WebAssembly.instantiate(bytes, { env: WASM_ENV });
  const check = checkModuleAssertions(entry.slug, instance.exports);
  const elapsed_ms = +(performance.now() - t0).toFixed(3);
  return {
    idea_id: entry.idea_id,
    slug: entry.slug,
    pack: entry.pack,
    wasm_bytes: bytes.byteLength,
    sha_ok: true,
    actual_sha256: actualSha,
    ok: check.ok,
    elapsed_ms,
    metric: check.metric,
    control: check.control,
  };
}

export async function runCorruptedMagicControl() {
  const bad = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]);
  try {
    await WebAssembly.instantiate(bad, { env: WASM_ENV });
    return { rejected_fail_closed: false, error_name: "", error_msg: "" };
  } catch (err) {
    return {
      rejected_fail_closed: err instanceof WebAssembly.CompileError,
      error_name: err.name,
      error_msg: String(err.message).slice(0, 120),
    };
  }
}

export async function runCorruptedManifestShaControl(manifest, loadBytesFn, sha256HexFn) {
  const target = manifest.modules[0];
  const flipped = (target.wasm_sha256[0] === "0" ? "1" : "0") + target.wasm_sha256.slice(1);
  const tamperedEntry = { ...target, wasm_sha256: flipped };
  const res = await runOneModule(tamperedEntry, loadBytesFn, sha256HexFn);
  return {
    rejected_fail_closed: (res.sha_ok === false && res.ok === false && res.control === "REJECTED_FAIL_CLOSED"),
    slug: target.slug,
    expected_tampered: flipped.slice(0, 16),
    actual_sha: res.actual_sha256.slice(0, 16),
  };
}

export async function runFullBench(manifest, loadBytesFn, sha256HexFn) {
  const tStart = performance.now();
  const rows = [];
  for (const entry of manifest.modules) {
    rows.push(await runOneModule(entry, loadBytesFn, sha256HexFn));
  }
  const magicControl = await runCorruptedMagicControl();
  const shaControl = await runCorruptedManifestShaControl(manifest, loadBytesFn, sha256HexFn);
  const total_elapsed_ms = +(performance.now() - tStart).toFixed(3);
  const passed_count = rows.filter((r) => r.ok && r.sha_ok).length;
  const total_bytes = rows.reduce((acc, r) => acc + r.wasm_bytes, 0);
  return {
    ok: passed_count === manifest.modules.length && magicControl.rejected_fail_closed && shaControl.rejected_fail_closed,
    passed_count,
    total_count: manifest.modules.length,
    total_bytes,
    total_kb: +(total_bytes / 1024).toFixed(2),
    total_elapsed_ms,
    magic_control: magicControl,
    manifest_sha_control: shaControl,
    rows,
  };
}

// Browser UI binding (only active when loaded from index.html in a DOM context)
if (typeof document !== "undefined" && typeof window !== "undefined") {
  const browserLoadBytes = async (relPath) => {
    const resp = await fetch(`./${relPath}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${relPath}`);
    return new Uint8Array(await resp.arrayBuffer());
  };

  const browserSha256Hex = async (bytes) => {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  let activePack = "all";
  let lastResult = null;

  const renderRows = () => {
    const tbody = document.getElementById("bench-rows");
    if (!tbody || !lastResult) return;
    tbody.textContent = "";
    const list = activePack === "all"
      ? lastResult.rows
      : lastResult.rows.filter((r) => String(r.pack) === activePack);
    for (const r of list) {
      const tr = document.createElement("tr");
      const cells = [
        `P${r.pack}`,
        r.idea_id,
        r.slug,
        `${(r.wasm_bytes / 1024).toFixed(2)} KB (${r.wasm_bytes} B)`,
        `${r.elapsed_ms.toFixed(2)} ms`,
        r.metric,
        r.control,
        r.actual_sha256.slice(0, 12),
        r.ok && r.sha_ok ? "PASS" : "FAIL",
      ];
      cells.forEach((txt, idx) => {
        const td = document.createElement("td");
        td.textContent = txt;
        if (idx === 3 || idx === 4 || idx === 7) td.className = "mono";
        if (idx === 8) td.className = r.ok && r.sha_ok ? "status-pass" : "status-fail";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
  };

  const executeUiBench = async () => {
    const summaryEl = document.getElementById("bench-summary");
    const controlsEl = document.getElementById("bench-controls");
    if (summaryEl) summaryEl.textContent = "Loading manifest and executing 18 zero-runtime WASM modules...";
    const resp = await fetch("./playground_wasm_18pack_manifest.json");
    const manifest = await resp.json();
    lastResult = await runFullBench(manifest, browserLoadBytes, browserSha256Hex);
    if (summaryEl) {
      summaryEl.textContent =
        `${lastResult.passed_count}/${lastResult.total_count} PASS | ` +
        `${lastResult.total_kb.toFixed(2)} KB (${lastResult.total_bytes} B) | ` +
        `${lastResult.total_elapsed_ms.toFixed(2)} ms total`;
    }
    if (controlsEl) {
      controlsEl.textContent =
        `Planted controls: corrupted WASM magic -> ${lastResult.magic_control.rejected_fail_closed ? "CompileError PASS" : "FAIL"} | ` +
        `tampered manifest SHA-256 -> ${lastResult.manifest_sha_control.rejected_fail_closed ? "REJECTED PASS" : "FAIL"}`;
    }
    renderRows();
  };

  window.addEventListener("DOMContentLoaded", () => {
    const runBtn = document.getElementById("btn-run");
    const themeBtn = document.getElementById("btn-theme");
    if (runBtn) runBtn.addEventListener("click", () => { executeUiBench().catch(console.error); });
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme") || "day";
        const next = cur === "day" ? "night" : "day";
        document.documentElement.setAttribute("data-theme", next);
        themeBtn.textContent = next === "day" ? "Night" : "Day";
      });
    }
    document.querySelectorAll("[data-pack-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activePack = btn.getAttribute("data-pack-filter") || "all";
        document.querySelectorAll("[data-pack-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        renderRows();
      });
    });
    executeUiBench().catch((err) => {
      const summaryEl = document.getElementById("bench-summary");
      if (summaryEl) summaryEl.textContent = `Bench error: ${err.message}`;
    });
  });
}
