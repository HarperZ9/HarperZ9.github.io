// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
//
// Wave 136A: Unified 90/90 Live Node Verification Suite for the MIT BuildLang WASM Suite
// (Packs 1 through 15 including 13 Zero-C 0-import modules: X25519, TLS Mini Handshake,
// BuildOS Cap Scheduler + W^X, BuildOS Zero-Copy IPC + Merkle VFS, Slice 20 Unified Triad,
// Slice 22 Cap Compositor, Slice 23 Input/Audio DSP, Slice 24 BuildOS v1.0 Unified Microkernel,
// Slice 25 SMP + Sv39 MMU, Slice 26 IOMMU + NVMe WAL, Slice 27 GPU VRAM + Shader Gate,
// Slice 28 Enclave Attestation + Ed25519 Quote, and Slice 29 FIPS 203 ML-KEM-512 + X25519
// Hybrid PQ KEM, plus Titan Test-Time MCTS Oracle, Titan E-Graph RLVR Synthesizer, and 8
// bit-exact 0-ULP C++23 Superframe renderer parity WASM modules: art_brdf, art_sky, art_gtao,
// art_ssr, art_purity, art_lens, art_sag, and art_film_optics).
// Verifies SHA-256 digests prior to WebAssembly.instantiate, runs all 90/90 modules live,
// enforces the <= 850 KB aggregate budget, and tests 2/2 planted fail-closed negative controls.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {
  print_i64() {},
  print_u64() {},
  print_f64() {},
  print_bool() {},
  print_str() {},
};

const ZERO_IMPORT_SLUGS = new Set([
  "x25519_curve25519_zeroc",
  "tls_mini_handshake_zeroc",
  "buildos_cap_sched_zeroc",
  "buildos_ipc_vfs_zeroc",
  "buildos_e2e_triad_zeroc",
  "buildos_compositor_zeroc",
  "buildos_input_audio_zeroc",
  "buildos_v1_unified_zeroc",
  "buildos_smp_mmu_zeroc",
  "buildos_iommu_nvme_zeroc",
  "buildos_gpu_vram_zeroc",
  "buildos_enclave_attest_zeroc",
  "buildos_pq_hybrid_kem_zeroc",
]);

function u32BeHex(w) { return (w >>> 0).toString(16).padStart(8, "0"); }
function u32LeHex(w) { const b = Buffer.alloc(4); b.writeUInt32LE(w >>> 0, 0); return b.toString("hex"); }
function wordsToLeHex(words) {
  const b = Buffer.alloc(words.length * 4);
  for (let i = 0; i < words.length; i++) b.writeUInt32LE(words[i] >>> 0, i * 4);
  return b.toString("hex");
}

async function assertModule(slug, ex, modBuf) {
  switch (slug) {
    // Pack 1
    case "buoy_ocean_field": {
      const hs = ex.jonswap_hs_rec(2.40, 10.5);
      const ak = ex.gerstner_max_ak(2.40, 10.5);
      return Math.abs(hs - 2.40) < 1e-4 && ex.validate_buoy(2.40, 10.5, ak) === 1
        && ex.validate_buoy(-1.2, 10.5, 0.12) === -1 && ex.validate_buoy(2.40, 10.5, 1.35) === -2;
    }
    case "metamer_divergence": {
      const d = ex.metamer_d65_delta_xyz();
      const de = ex.metamer_alt_delta_e76();
      const rms = ex.metamer_spec_rms();
      return d < 1e-9 && de > 1.0 && rms > 0.01 && ex.metamer_guard(d, rms, de) === -401;
    }
    case "console_shader_stack":
      return Number.isFinite(ex.shader_frame_checksum()) && ex.shader_max_chan() <= 1.0
        && ex.validate_radiance(0.5, 0.5, 0.5) === 1
        && ex.validate_radiance(-0.15, 0.4, 0.5) === -1
        && ex.validate_radiance(0.4, Number.NaN, 0.5) === -2;
    case "midcentury_synthesis_grid":
      return ex.grid_total_area_mm2() > 1000.0 && ex.grid_validate(0) === 1
        && ex.grid_validate(1) === -1 && ex.grid_validate(2) === -2;
    case "confidence_word_calib":
      return ex.confidence_band(0.004, 0.03, 1) === 3 && ex.confidence_band(0.450, 0.40, 1) === 0
        && ex.audit_claim(0.004, 0.03, 1, 3, 0) === 0 && ex.audit_claim(0.04, 0.22, 1, 1, 1) === -401;
    case "living_type_bezier":
      return ex.optical_contrast(144.0) > 1.0 && Number.isFinite(ex.kern_av_em())
        && ex.count_bezier_self_intersections(0, 0, 0, 0.9, 0.8, 0.9, 0.8, 0) === 0
        && ex.count_bezier_self_intersections(0, 0, 2.5, 1.5, -1.5, 1.5, 1.0, 0) > 0;

    // Pack 2
    case "honest_exit_valve":
      return ex.arm_metric(0, 0) > 0.95 && ex.arm_metric(2, 0) === 0.0
        && ex.arm_reseats(2, 600) === 300 && ex.audit_arm_safety(2) === 0 && ex.audit_arm_safety(3) === -101;
    case "catastrophe_surge":
      return Number.isFinite(ex.surge_3shock_checksum()) && ex.eval_shock(1, 105.0, 1) === 0.0
        && ex.eval_shock(0, 105.0, 1) > 30.0 && ex.check_conservation(75, 75) === 0 && ex.check_conservation(80, 75) === -101;
    case "blackout_commons":
      return ex.verify_all_15_blackouts(67, 77, 78, 83) === 15 && ex.check_quorum(4) === 0 && ex.check_quorum(3) === -201;
    case "community_homeostasis":
      return ex.sim_feedback(10, 0.22, 0.015, 180, 1) > ex.sim_feedback(1, 0.22, 0.015, 180, 1)
        && ex.check_stability(10, 0.22, 0.015) === 0 && ex.check_stability(10, 0.95, 0.12) === -301;
    case "disclosure_penalty":
      return ex.simulate_regime(1.0, 0.0, 0.15, 0.35, 1.2, 0.02) > 0.5
        && ex.simulate_regime(1.0, 0.25, 0.0, 0.0, 1.0, 0.02) < 0.02
        && ex.check_prob_bounds(0.5) === 1 && ex.check_prob_bounds(1.25) === 0;
    case "tree_wind_root_rot":
      return ex.solve_tree_metric(25, 18, 12, 0.28, 1e10, 62000, 1, 0, 3)
        > ex.solve_tree_metric(25, 18, 12, 0.28, 1e10, 62000, 0, 0.45, 3)
        && ex.validate_tree(-10, 1e10, 62000, 0) === -201 && ex.validate_tree(25, 1e10, 0, 0) === -202;

    // Pack 3
    case "moat_egraph_cert_compress":
      return ex.egraph_compress_metric(0) === 64 && ex.egraph_compress_metric(1) === 8
        && ex.egraph_compress_metric(4) === 0 && (ex.egraph_compress_metric(5) >>> 0) === 3332218802
        && ex.egraph_compress_metric(6) === 1;
    case "moat_zerocopy_cap_ipc":
      return ex.ipc_run_metric(0) === 4096 && ex.ipc_run_metric(1) === 0 && ex.ipc_run_metric(4) === 1
        && ex.ipc_run_metric(7) === 1 && ex.ipc_run_metric(8) === 2;
    case "moat_three_plate":
      return ex.three_plate_sweep(0) === 32 && ex.three_plate_sweep(1) === 32
        && ex.three_plate_sweep(2) === 0 && ex.three_plate_sweep(3) === 0 && ex.verify_three_plate(1, 1, 0) === -801;
    case "moat_ntc_block":
      return ex.ntc_comp_ratio() >= 5.0 && ex.ntc_eval_tile(0) >= 40.0
        && ex.validate_latent(310, 0.25) === -1 && ex.validate_latent(128, Number.NaN) === -2;
    case "rsi_closed_loop":
      return ex.rsi_run_metric(1, 1, 1, 0) >= 5.0 && ex.rsi_run_metric(1, 1, 1, 2) === 0
        && ex.rsi_run_metric(1, 1, 1, 6) === 80 && ex.rsi_verify_all_controls() === 1;
    case "epigenetics_audit":
      return ex.epi_heldout_acc(0) >= 0.95 && ex.epi_heldout_acc(1) <= 0.45
        && ex.epi_audit_gate(1000, 0) === 0 && ex.epi_audit_gate(1000, 2) === -501;

    // Pack 4
    case "titan_1m":
      return ex.titan_eval_metric(0) === 8 && ex.titan_eval_metric(7) === 0
        && ex.titan_eval_metric(1) < 1e-8 && ex.titan_blowup_step() > 0 && ex.titan_decay_step() > 0;
    case "low_water_combat":
      return ex.lw_run_fixed_metric(60, 5) === 1200 && ex.lw_max_fps_drift() === 0.0 && ex.lw_var_dt_drift() > 0.05;
    case "pbr_16archetype":
      return ex.pbr_sweep_metric(0) === 16 && ex.pbr_sweep_metric(1) <= 1.0 && ex.pbr_sweep_metric(4) === -301;
    case "moat_indirect_cull":
      return ex.cull_sweep_metric(2) === 32 && ex.cull_sweep_metric(3) === 0
        && ex.cull_sweep_metric(1) > 0 && ex.cull_sweep_metric(6) === 1;
    case "moat_tpm_merkle":
      return ex.tpm_merkle_metric(0) === 108 && ex.tpm_merkle_metric(1) === 8
        && ex.tpm_merkle_metric(4) === -901 && ex.tpm_merkle_metric(6) === -902 && ex.tpm_merkle_metric(7) === -903;
    case "moat_cross_gpu_tv":
      return ex.tv_sweep_metric(4) <= 1.0 && ex.tv_sweep_metric(7) === 0
        && ex.tv_sweep_metric(5) > 16.0 && ex.tv_sweep_metric(8) === 1;

    // Pack 5
    case "sha256_zeroc": {
      let h = "";
      for (let i = 0; i < 8; i++) h += u32BeHex(ex.sha256_abc_word(i, 0));
      return h === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        && ex.sha256_verify_flip_caught() === 8;
    }
    case "aead_chacha20_poly1305": {
      let tag = "";
      for (let i = 0; i < 4; i++) tag += u32LeHex(ex.aead_tag_word(0, 0, i));
      return tag === "1ae10b594f09e26a7e902ecbd0600691"
        && u32LeHex(ex.aead_ct_first_word()) === "d31a8d34"
        && ex.aead_verify_tampers_caught() === 2;
    }
    case "merkle_rfc6962": {
      let r = "";
      for (let i = 0; i < 8; i++) r += u32BeHex(ex.merkle_root_word(0, i));
      return r === "3c534b22b2e8c8fff07416469d39d9553b4d325e51874140e429b2c2a9ae22d2"
        && ex.merkle_verify_all(0) === 4 && ex.merkle_verify_all(1) === -902 && ex.merkle_verify_all(2) === -903;
    }
    case "rsi_closed_loop_p5":
      return ex.rsi_biodamped_metric(1, 1, 1, 0) > 8.0 && ex.rsi_biodamped_metric(1, 1, 1, 2) === 0
        && ex.rsi_biodamped_metric(1, 1, 1, 6) === 120 && ex.rsi_biodamped_controls_ok() === 1;
    case "ntc610_compress":
      return ex.ntc610_metric(0) >= 50.0 && ex.ntc610_metric(1) >= 5.0
        && ex.ntc610_validate(300, 0.25) === -1 && ex.ntc610_validate(64, Number.NaN) === -2;
    case "jonswap_ocean":
      return Math.abs(ex.jonswap_eval(2.40, 10.5, 0) - 2.40) < 1e-6
        && ex.jonswap_eval(2.40, 10.5, 1) < 1.0 && ex.jonswap_eval(2.40, 10.5, 3) === 1;

    // Pack 6
    case "x25519_curve25519_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const logged = [];
      for (let i = 1; i <= count; i++) logged.push(Number(mem[i]));
      return wordsToLeHex(logged.slice(0, 8)) === "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a"
        && wordsToLeHex(logged.slice(8, 16)) === "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f"
        && wordsToLeHex(logged.slice(16, 24)) === "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742"
        && logged[24] === 1 && logged[25] === 1;
    }
    case "camera_reciprocity_origami":
      return Math.abs(ex.h8_metric(0) - 40.0) < 1e-6 && ex.h8_metric(1) > 76.0
        && ex.h8_metric(2) < 1e-10 && ex.h8_metric(3) === 1;
    case "cinematography_framing":
      return ex.k2_metric(0) > 73.0 && ex.k2_metric(1) > 39.0
        && ex.k2_metric(2) < 1e-12 && ex.k2_metric(3) < 25.0 && ex.k2_metric(6) === 1;
    case "weather_ocean_sky_map":
      return Math.abs(ex.e23_metric(0) - 24.24227) < 1e-3 && ex.e23_metric(2) > ex.e23_metric(1)
        && ex.e23_metric(3) === 1;
    case "minds_eye_distance":
      return ex.cand_rc(3) === 0 && ex.cand_rc(4) === 0 && ex.cand_rc(5) === -401
        && ex.cand_net(3) > 0.70 && ex.cand_net(5) < 0.0;
    case "ambient_jazz_waves":
      return ex.voice_leading_total() === 9 && ex.surf_metric(0, 0) <= 0.95
        && ex.surf_metric(0, 3) === 0 && ex.surf_metric(1, 3) === -202 && ex.surf_metric(2, 3) === -201;

    // Pack 7
    case "tls_mini_handshake_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const { instance: iMitm } = await WebAssembly.instantiate(modBuf);
      const { instance: iTamper } = await WebAssembly.instantiate(modBuf);
      return count === 26 && Number(mem[1]) === 1 && Number(mem[2]) === 1 && Number(mem[3]) === 1
        && Number(iMitm.exports.tls_handshake_run(1n)) === -101
        && Number(iTamper.exports.tls_handshake_run(2n)) === -201;
    }
    case "three_control_negatives": {
      const pSig = ex.perm_p_value(1);
      const pNull = ex.perm_p_value(0);
      return ex.pearson_r(1, -1) > 0.99 && pSig <= 0.01 && pNull > 0.10
        && ex.validate_three_controls(1, 1, 1, 1, pSig, 0.05) === 0
        && ex.validate_three_controls(1, 0, 1, 1, pSig, 0.05) === -201
        && ex.validate_three_controls(1, 1, 1, 0, pSig, 0.05) === -202
        && ex.validate_three_controls(1, 1, 1, 1, pNull, 0.05) === -203;
    }
    case "personal_voice_twin": {
      const baseCv = ex.extract_feature(0, 0);
      const dMatch = ex.voice_distance_vs_base(1);
      const dSlop = ex.voice_distance_vs_base(2);
      return Math.abs(baseCv - 0.4956) < 1e-3 && dMatch <= 0.05 && dSlop >= 0.50
        && ex.gate_voice_twin(42, 42, 1, dMatch) === 0
        && ex.gate_voice_twin(42, 42, 1, dSlop) === -201
        && ex.gate_voice_twin(42, 99, 1, dMatch) === -202
        && ex.gate_voice_twin(42, 42, 0, dMatch) === -202;
    }
    case "universal_articulate_pipe":
      return ex.verify_all_8_cases() === 1
        && ex.route_preset(0) === 0 && ex.route_preset(4) === -301
        && ex.route_preset(5) === -303 && ex.route_preset(6) === -302 && ex.route_preset(7) === -303;
    case "concept_phase_states":
      return Math.abs(ex.lg_psi(250, 273.15, 0.02, 1.0) - 0.680441) < 1e-4
        && ex.lg_fe_analytic_err(250, 273.15, 0.02, 1.0) < 1e-14
        && ex.sweep_hyst_loop_k(8.0) === 17.0 && ex.count_states_seen(8.0) === 4
        && ex.lg_validate(-15.0, 273.15, 0.02, 1.0, 8.0) === -1
        && ex.lg_validate(250.0, 273.15, 0.02, 0.0, 0.0) === -2;
    case "cross_layer_overlap":
      return ex.ncc_eval(0, 0) === 1.0 && ex.ncc_eval(0, 1) === 5.0 && ex.ncc_eval(0, 2) === 3.0
        && ex.ncc_eval(0, 3) > 0.99 && ex.ncc_eval(1, 0) === 0.0;

    // Pack 8
    case "cmmns_evidence_quorum":
      return ex.verify_all_6_scenarios() === 1
        && (ex.attest_digest_u32(9501, 3735928559, 101) >>> 0) === 0x8800cafc
        && ex.eval_bft_scenario(0) === 0 && ex.eval_bft_scenario(1) === 0
        && ex.eval_bft_scenario(2) === -501 && ex.eval_bft_scenario(3) === -502
        && ex.eval_bft_scenario(4) === -503 && ex.eval_bft_scenario(5) === -503;
    case "cmmns_citation_decay":
      return ex.eval_survival_prob(0, 10, 0) > 0.996 && ex.eval_survival_prob(1, 10, 0) < 0.14
        && ex.loss_reduction_ratio(10) > 200.0
        && ex.eval_mirror_rc(0, 10, 0, 0.99) === 0
        && ex.eval_mirror_rc(1, 10, 0, 0.99) === -601
        && ex.eval_mirror_rc(2, 10, 0, 0.99) === -602
        && ex.eval_mirror_rc(0, 10, 1.0, 0.99) === -603;
    case "cmmns_source_corroboration": {
      const cycMask = (1 << 1) | (1 << 6) | (1 << 8);
      const echoMask = (1 << 4) | (1 << 8) | (1 << 12);
      return ex.count_independent_roots(0) === 4
        && ex.eval_corrob_posterior(0, 0.2, 0.85, 0.15) > 0.996
        && ex.eval_corrob_rc(0, 0.2, 0.85, 0.15) === 0
        && ex.eval_corrob_rc(cycMask, 0.2, 0.85, 0.15) === -701
        && ex.eval_corrob_rc(echoMask, 0.2, 0.85, 0.15) === -702
        && ex.eval_corrob_rc(0, 0.2, 0.10, 0.25) === -703;
    }
    case "cmmns_archive_merkle_diff":
      return ex.verify_all_4_diffs() === 1
        && (ex.prefix_chain_root(0, 4) >>> 0) === 0x1e9de29f
        && (ex.prefix_chain_root(0, 6) >>> 0) === 0xae0cbd4e
        && ex.verify_archive_scenario(0) === 0 && ex.verify_archive_scenario(1) === -801
        && ex.verify_archive_scenario(2) === -802 && ex.verify_archive_scenario(3) === -803;
    case "cmmns_attention_valve":
      return ex.remaining_minutes(20, 30) === 10 && ex.stop_ramp_active(30, 30, 1) === 1
        && ex.dark_pattern_score(1, 1, 1) === 9
        && ex.audit_attention_valve(20, 30, 0, 0, 0, 0) === 0
        && ex.audit_attention_valve(30, 30, 1, 0, 0, 0) === 0
        && ex.audit_attention_valve(12, 30, 0, 1, 1, 1) === -901
        && ex.audit_attention_valve(45, 30, 0, 0, 0, 0) === -902
        && ex.audit_attention_valve(10, 0, 0, 0, 0, 0) === -903;
    case "cocoon_cloth_aperture":
      return ex.count_cloth_clips(0) === 0 && ex.count_cloth_clips(1) === 2
        && ex.aperture_plate_contrast(0) > 7.0 && ex.aperture_plate_contrast(1) === 1.0
        && ex.audit_cocoon_plate(0, 0) === 0
        && ex.audit_cocoon_plate(1, 0) === -501
        && ex.audit_cocoon_plate(0, 1) === -502;

    // Pack 9
    case "buildos_cap_sched_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.microkernel_run(a)));
      }
      return count === 19 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "buildos_ipc_vfs_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.ipc_vfs_run(a)));
      }
      return count === 20 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 4 && Number(mem[4]) === 4
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "first_principles_dag":
      return ex.eval_dag_metric(0, 0) === 1 && ex.eval_dag_metric(0, 1) === 20
        && ex.eval_dag_metric(0, 2) === 4 && ex.eval_dag_metric(0, 3) === 40
        && (ex.eval_dag_metric(0, 4) >>> 0) === 360515885
        && ex.eval_dag_metric(1, 0) === -1 && ex.eval_dag_metric(2, 0) === -2;
    case "potential_space_transmute":
      return ex.verify_5step_bloom_peak() === 1 && ex.transmute_telemetry(0) === 0
        && ex.transmute_order_score(1, 1, 2) > 0.90
        && ex.transmute_valid(0, 1, 2) === -1 && ex.transmute_valid(10, 1, 2) === -2;
    case "cs030_effect_uncolored_runtime":
      return ex.run_uncolored_hash(0, 256) === 52936172364692028n
        && ex.run_uncolored_hash(1, 256) === 52936172364692028n
        && ex.run_uncolored_rc(0, 256, 1024, -1) === 0
        && ex.run_uncolored_rc(1, 256, 1024, -1) === 0
        && ex.run_uncolored_rc(1, 256, 1024, 17) === -101
        && ex.run_uncolored_rc(1, 257, 1024, -1) === -201
        && ex.run_uncolored_rc(1, 256, 100, -1) === -301;
    case "cs068_rare_event_committor":
      return ex.committor_exact(-0.92) < 1e-6 && Math.abs(ex.committor_exact(0.0) - 0.5) < 1e-11
        && ex.exact_splitting_vrf() > 28000.0
        && ex.validate_committor_params(0, 1, 0.0625) === 0
        && ex.validate_committor_params(1, 1, 0.0625) === -681
        && ex.validate_committor_params(0, 1, -0.0625) === -682;

    // Pack 10
    case "buildos_e2e_triad_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.buildos_triad_run(a)));
      }
      return count === 30 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 2 && Number(mem[4]) === 20 && Number(mem[5]) === 9 && Number(mem[6]) === 4
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "cs042_onebit_vis_dynamic_lights":
      return ex.cs042_metric(0) === 7979 && ex.cs042_metric(1) === 8405
        && ex.cs042_metric(2) === 32.0 && ex.cs042_metric(3) === 0.0
        && Math.abs(ex.cs042_metric(4) - 11.184661188615) < 1e-9
        && ex.validate_light_radiance(-1.5, 1.0, 1.0) === -421
        && ex.validate_visibility_parity(ex.cs042_metric(5)) === -422;
    case "cs047_kiruna_night_spectral_sky":
      return ex.cs047_metric(1) > ex.cs047_metric(0)
        && ex.cs047_metric(2) < 0.7 && ex.cs047_metric(3) > 1.4
        && Math.abs(ex.cs047_metric(4) - 416.243238559957) < 1e-8
        && ex.validate_optical_depth(-0.15) === -471
        && ex.sky_rc(95.0) === -472;
    case "cs025_agentic_ppl_bpb":
      return ex.cs025_metric(0) === 384 && ex.cs025_metric(1) === 1536
        && ex.cs025_metric(7) > 25.0 && ex.cs025_metric(12) < 1e-12
        && ex.validate_prob_dist(0.85, 0.50) === -251
        && ex.validate_denominators(384, 0) === -252;
    case "cs008_model_carving_loop":
      return ex.cs008_metric(0) === 8 && ex.cs008_metric(1) < 1.0
        && ex.cs008_metric(2) <= 0.02 && ex.cs008_metric(3) >= 0.99
        && ex.cs008_metric(4) === 16.0 && ex.cs008_metric(5) === 4.0
        && ex.validate_carving_plan(16, 0) === -801
        && ex.validate_spectral_bound(1.25) === -802;
    case "cs069_auxetic_xpbd_lattice":
      return Math.abs(ex.cs069_metric(0) - (-1.061282505297319)) < 1e-11
        && Math.abs(ex.cs069_metric(0) - ex.cs069_metric(1)) < 1e-12
        && ex.cs069_metric(2) < -0.30 && ex.cs069_metric(4) === 1.0 && ex.cs069_metric(5) === 1.0
        && ex.validate_xpbd_state(0.0001, 2.0, 0.5, -0.05) === -691
        && ex.validate_xpbd_state(-0.0001, 2.0, 0.5, 0.5) === -692;

    // Pack 11
    case "cs045_persistent_3d_memory":
      return ex.cs045_metric(4) === 12 && ex.cs045_metric(5) > 0 && ex.cs045_metric(6) < 1e-9
        && ex.cs045_metric(9) === 0 && (ex.cs045_metric(0) < 12 || ex.cs045_metric(2) > 1.0)
        && ex.cs045_ctrl_rot() === -451 && ex.validate_depth(-0.5) === -452;
    case "cs046_video_skeleton_mocap":
      return ex.cs046_metric(1) < ex.cs046_metric(0) && ex.cs046_metric(2) > 25.0
        && ex.cs046_metric(3) > 1.0 && ex.cs046_metric(4) < 1e-6 && ex.cs046_metric(5) < 1e-12
        && ex.validate_bone_length(0.0) === -461 && ex.validate_bone_length(-0.2) === -461
        && ex.triangulate_rc(0.3, 0.4, 0.5, 0.3, 0.4, 0.5) === -462;
    case "cs014_fractal_procedural_weights":
      return ex.cs014_metric(0) > ex.cs014_metric(1) + 10.0 && ex.cs014_metric(0) > ex.cs014_metric(2) + 10.0
        && ex.cs014_metric(4) < ex.cs014_metric(5) && ex.cs014_metric(4) < ex.cs014_metric(6)
        && ex.cs014_metric(7) < 8.0 && ex.cs014_metric(7) < ex.cs014_metric(8)
        && ex.validate_byte_budget(8, 1024) === 0 && ex.validate_byte_budget(12, 1024) === -141;
    case "cs024_posterior_rare_tail_audit":
      return ex.cs024_metric(1) <= 1e-3 && ex.cs024_metric(3) <= 0.15
        && ex.cs024_metric(6) >= 0.90 && ex.cs024_metric(7) < 0.90
        && ex.cs024_metric(9) >= 50.0 && ex.cs024_metric(10) > 10.0
        && ex.validate_prob_sum(1.25) === -241 && ex.validate_martingale(1.30) === -242;
    case "cs031_automated_port_verifier":
      return ex.cs031_metric(0) === 1000 && ex.cs031_metric(1) === 0.0
        && ex.cs031_metric(2) === 50 && ex.cs031_metric(3) === 50 && ex.cs031_metric(4) === 1.0
        && ex.validate_port_equivalence(1.25, 1.26, 1e-12) === -311
        && ex.validate_effect_subset(1, 3) === -312;
    case "cs049_fourier_optics_pdb_provenance":
      return ex.cs049_metric(0) === 0 && ex.cs049_metric(5) === 0 && ex.cs049_metric(9) < 1e-12
        && ex.cs049_metric(6) > 2.0 && ex.cs049_metric(7) < 5.0 && ex.cs049_metric(8) > 20.0
        && ex.cs049_prov_digest() === 1751076291561830023n
        && ex.validate_optics_params(-740.0, 320.0, 532.0) === -491
        && ex.validate_peptide_bond(0.85) === -492;

    // Pack 12
    case "buildos_v1_unified_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 6n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.buildos_v1_run(a)));
      }
      return count === 19 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 7 && Number(mem[4]) === 5
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301
        && atks[3] === -401 && atks[4] === -501 && atks[5] === -601;
    }
    case "buildos_compositor_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.compositor_run(a)));
      }
      return count === 24 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 2 && Number(mem[4]) === 16
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "buildos_input_audio_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.input_audio_run(a)));
      }
      return count === 22 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 16 && Number(mem[4]) === 2 && Number(mem[5]) === 32 && Number(mem[6]) === 5
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "cs005_fca_titans_grid_probe":
      return ex.cs005_metric(2) >= 2.5 && ex.cs005_metric(3) >= 0.99 && ex.cs005_metric(4) <= 0.15
        && ex.cs005_metric(5) <= 1e-12 && ex.cs005_metric(6) < 20.0 && ex.cs005_metric(7) > 20.0
        && ex.cs005_metric(8) > 5.0 && ex.cs005_metric(9) === 0.0
        && ex.check_vram_budget_gb(131072.0, 1, 20.0) === 0
        && ex.check_vram_budget_gb(131072.0, 0, 20.0) === -501;
    case "cs006_sparrow_fixedpoint_loop":
      return ex.cs006_metric(0) === 24.0 && ex.cs006_metric(3) >= 5.0 && ex.cs006_metric(4) === 25.0
        && ex.cs006_metric(5) <= 1e-4 && ex.cs006_metric(6) <= ex.cs006_metric(7) + 1e-6
        && ex.cs006_metric(8) <= 0.72 + 1e-12 && ex.cs006_metric(9) > 1.0
        && (ex.cs006_ctrl(1) === -601 || ex.cs006_ctrl(1) === -602)
        && ex.cs006_ctrl(2) === -602;
    case "cs001_loom_mhc_loss_per_flop":
      return ex.cs001_metric(2) >= 3.0 && ex.cs001_metric(3) <= 1e-11 && ex.cs001_metric(4) === 0.0
        && ex.validate_birkhoff_uniform(0.25) === 0
        && ex.validate_birkhoff_uniform(0.75 / 4.0) === -101
        && ex.validate_birkhoff_uniform(0.40) === -102;

    // Pack 13
    case "buildos_smp_mmu_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.smp_mmu_run(a)));
      }
      return count === 23 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 4 && Number(mem[4]) === 16 && Number(mem[5]) === 8
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "buildos_iommu_nvme_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.iommu_nvme_run(a)));
      }
      return count === 23 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 4 && Number(mem[4]) === 4 && Number(mem[5]) === 4 && Number(mem[7]) === 20
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "buildos_gpu_vram_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.gpu_vram_run(a)));
      }
      return count === 23 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 4 && Number(mem[4]) === 4 && Number(mem[5]) === 32 && Number(mem[7]) === 4096
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "titan_unified_epigenetic_engine": {
      const hdr = ex.run_titan_unified_wasm();
      const dv = new DataView(ex.memory.buffer);
      const dataPtr = dv.getUint32(hdr, true);
      const len = dv.getUint32(hdr + 4, true);
      if (len !== 21) return false;
      const arr = new Float64Array(ex.memory.buffer, dataPtr, len);
      return arr[0] > 2.0 && arr[1] < 1e-12 && arr[2] < 1e-12 && arr[3] > 7.0
        && arr[6] === 1.0 && arr[7] < 1e-12 && arr[10] > 90.0 && arr[12] > 3.0
        && arr[15] === 1.0 && arr[16] === 1.0 && arr[17] === 1.0 && arr[20] === 0.0;
    }
    case "cs041_anywreck_physical_weathering":
      return ex.cs041_metric(2) < 1.0 && ex.cs041_metric(3) < 2.0 && ex.cs041_metric(4) > 10.0
        && ex.cs041_metric(7) >= 5.0 && ex.cs041_metric(8) === 0.0 && ex.cs041_metric(9) === 0.0
        && ex.check_mask_value(1.35) === -411 && ex.check_mask_value(Number.NaN) === -411
        && ex.check_geometry_gates(ex.cs041_metric(2), ex.cs041_metric(4)) === -412
        && ex.check_geometry_gates(2.5, ex.cs041_metric(3)) === -412;
    case "cs060_biotorch_oracle_drill_forge":
      return ex.cs060_metric(0) === 128.0 && ex.cs060_metric(1) === 128.0
        && ex.cs060_metric(2) === 128.0 && ex.cs060_metric(3) === 128.0
        && ex.cs060_metric(4) === 1.0 && ex.cs060_metric(5) === 1.0
        && Math.abs(ex.cs060_metric(6) - 52.94172479956) < 1e-10
        && ex.cs060_suite_hash() === 4159402974n
        && ex.grade_drill_rc(0, 0, ex.eval_drill(0, 0, 0), 1e-12) === 0
        && ex.grade_drill_rc(0, 0, 0.0, 1e-12) === -601
        && ex.grade_drill_rc(6, 3, ex.eval_drill(6, 3, 2), 1e-12) === -602;

    // Pack 14
    case "buildos_enclave_attest_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.enclave_attest_run(a)));
      }
      return count === 23 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 28 && Number(mem[4]) === 42 && Number(mem[5]) === 5
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "superframe_art_brdf":
      return BigInt.asUintN(64, ex.brdf_grid_hash(0.0)) === 0xe8d741020e6f146an
        && BigInt.asUintN(64, ex.brdf_grid_hash(0.001)) !== 0xe8d741020e6f146an;
    case "superframe_art_sky":
      return BigInt.asUintN(64, ex.sky_cube16_hash(0.0)) === 0x4774e06b9efdb90dn
        && BigInt.asUintN(64, ex.sky_cube16_hash(0.01)) !== 0x4774e06b9efdb90dn;
    case "superframe_art_gtao":
      return BigInt.asUintN(64, ex.gtao_hash(0)) === 0x10d3723a5bd82529n
        && BigInt.asUintN(64, ex.gtao_hash(1)) === 0x18cacb7a24d2d03cn
        && BigInt.asUintN(64, ex.gtao_hash(2)) === 0xb1edf333d5925383n
        && BigInt.asUintN(64, ex.gtao_hash(3)) === 0x28cadd1bf99ef7cfn
        && BigInt.asUintN(64, ex.gtao_hash(4)) === 0x35c3ea81948e6711n;
    case "superframe_art_ssr":
      return BigInt.asUintN(64, ex.ssr_hash(0)) === 0x5fe10583a278ee55n
        && BigInt.asUintN(64, ex.ssr_hash(1)) === 0xf99e235517d04fben
        && BigInt.asUintN(64, ex.ssr_hash(2)) === 0xfba75d3ca1ba5ca1n
        && BigInt.asUintN(64, ex.ssr_hash(3)) === 0xf513463006c87383n
        && ex.ssr_hits(0) === 344 && ex.ssr_hits(1) === 378 && ex.ssr_hits(3) === 0;
    case "superframe_art_purity":
      return BigInt.asUintN(64, ex.purity_hash(0)) === 0x7fce44868c056d9cn
        && BigInt.asUintN(64, ex.purity_hash(1)) === 0xf3ba482e245a43f1n
        && BigInt.asUintN(64, ex.purity_hash(2)) === 0xd8cc2dc73422ba83n
        && BigInt.asUintN(64, ex.purity_hash(3)) === 0x2ba3846871f3701an
        && BigInt.asUintN(64, ex.purity_hash(4)) === 0x3785bd59637ac6f0n;

    // Pack 15 (Zero-C BuildOS Slice 29 PQ KEM + Titan MCTS/RLVR + 3 0-ULP C++23 Superframe Renderers)
    case "buildos_pq_hybrid_kem_zeroc": {
      const count = Number(ex.main());
      const mem = new BigInt64Array(ex.memory.buffer);
      const atks = [];
      for (let a = 1n; a <= 4n; a++) {
        const { instance: ia } = await WebAssembly.instantiate(modBuf);
        atks.push(Number(ia.exports.pq_hybrid_kem_run(a)));
      }
      return count === 23 && Number(mem[1]) === 1 && Number(mem[2]) === 1
        && Number(mem[3]) === 3329 && Number(mem[4]) === 256 && Number(mem[5]) === 2
        && atks[0] === -101 && atks[1] === -201 && atks[2] === -301 && atks[3] === -401;
    }
    case "titan_test_time_mcts_oracle": {
      const hdr = ex.run_titan_mcts_wasm();
      const dv = new DataView(ex.memory.buffer);
      const dataPtr = dv.getUint32(hdr, true);
      const len = dv.getUint32(hdr + 4, true);
      if (len !== 13) return false;
      const arr = new Float64Array(ex.memory.buffer, dataPtr, len);
      return arr[0] === 30.0 && arr[1] === 90.0 && arr[3] === 120.0 && arr[4] === 1.0
        && arr[5] === 90.0 && arr[6] === 0.0 && arr[7] === 3429.0 && arr[8] > 0.999999
        && arr[9] === 143053981.0 && arr[10] === 1.0 && arr[11] === 1.0 && arr[12] === 0.0;
    }
    case "titan_egraph_rlvr_synthesizer": {
      const hdr = ex.run_titan_rlvr_wasm();
      const dv = new DataView(ex.memory.buffer);
      const dataPtr = dv.getUint32(hdr, true);
      const len = dv.getUint32(hdr + 4, true);
      if (len !== 15) return false;
      const arr = new Float64Array(ex.memory.buffer, dataPtr, len);
      return arr[0] === 2.0 && arr[2] === 16.0 && arr[3] === 1.0 && arr[4] === 1.0
        && arr[5] > 0.90 && arr[6] < 0.01 && arr[7] === 46.0 && arr[8] === 3868613143.0
        && arr[9] === 1536.0 && arr[10] === 961.0 && arr[11] === 92.0
        && arr[12] === 1.0 && arr[13] === 1.0 && arr[14] === 0.0;
    }
    case "superframe_art_lens":
      return BigInt.asUintN(64, ex.lens_hash(0)) === 0xfa92ce0278da1f75n
        && BigInt.asUintN(64, ex.lens_hash(1)) === 0xc2e001d052256354n
        && BigInt.asUintN(64, ex.lens_hash(2)) === 0x73c8f6fc31691d0cn
        && BigInt.asUintN(64, ex.lens_hash(3)) === 0x7a5e93f98d68d85fn
        && BigInt.asUintN(64, ex.lens_hash(4)) === 0xbd8268cb80d70739n
        && BigInt.asUintN(64, ex.lens_hash(5)) === 0xf3f6cfb7b9a247f8n;
    case "superframe_art_sag":
      return BigInt.asUintN(64, ex.sag_hash(0)) === 0xc40a17415810146dn
        && BigInt.asUintN(64, ex.sag_hash(1)) === 0xc7cb2f695b3560dfn
        && BigInt.asUintN(64, ex.sag_hash(2)) === 0x1c18d9ba031b83a8n
        && BigInt.asUintN(64, ex.sag_hash(3)) === 0x13b61759c1c74cf3n
        && BigInt.asUintN(64, ex.sag_hash(4)) === 0xc093c83f3628e436n
        && BigInt.asUintN(64, ex.sag_hash(5)) === 0x8f819a0f0f39ca60n;
    case "superframe_art_film_optics":
      return BigInt.asUintN(64, ex.film_optics_hash(0)) === 0x65cc5210a95d8d39n
        && BigInt.asUintN(64, ex.film_optics_hash(1)) === 0x927e46a55f3e9f2bn
        && BigInt.asUintN(64, ex.film_optics_hash(2)) === 0xc9bee95c5b91dbadn
        && BigInt.asUintN(64, ex.film_optics_hash(3)) === 0x69e1cc092ef541fdn
        && BigInt.asUintN(64, ex.film_optics_hash(4)) === 0xce8d086fa30550d9n
        && BigInt.asUintN(64, ex.film_optics_hash(5)) === 0xb7515e47cebfa6dbn;
    default:
      return false;
  }
}

async function verifyEntry(entry) {
  const t0 = performance.now();
  const buf = fs.readFileSync(path.join(__dirname, entry.wasm_path));
  const actualSha = crypto.createHash("sha256").update(buf).digest("hex");
  if (actualSha !== entry.wasm_sha256) {
    return { slug: entry.slug, pack: entry.pack, sha_ok: false, ok: false, bytes: buf.length, elapsed_ms: +(performance.now() - t0).toFixed(3) };
  }
  const noEnv = ZERO_IMPORT_SLUGS.has(entry.slug);
  const { instance } = noEnv
    ? await WebAssembly.instantiate(buf)
    : await WebAssembly.instantiate(buf, { env });
  const ok = await assertModule(entry.slug, instance.exports, buf);
  return { slug: entry.slug, pack: entry.pack, sha_ok: true, ok, bytes: buf.length, elapsed_ms: +(performance.now() - t0).toFixed(3) };
}

async function main() {
  const tAll = performance.now();
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "wasm_90pack_manifest.json"), "utf8"));
  const rows = [];
  for (const entry of manifest.modules) {
    rows.push(await verifyEntry(entry));
  }

  let magicRejected = false;
  let magicErr = "";
  try {
    await WebAssembly.instantiate(Buffer.from([0xba, 0xd0, 0xca, 0xfe, 0x01, 0x00, 0x00, 0x00]), { env });
  } catch (err) {
    magicRejected = err instanceof WebAssembly.CompileError;
    magicErr = err.name;
  }

  const target = manifest.modules[84]; // buildos_pq_hybrid_kem_zeroc
  const badSha = (target.wasm_sha256[0] === "0" ? "1" : "0") + target.wasm_sha256.slice(1);
  const shaCtrl = await verifyEntry({ ...target, wasm_sha256: badSha });
  const shaRejected = (shaCtrl.sha_ok === false && shaCtrl.ok === false);

  const passed = rows.filter((r) => r.ok && r.sha_ok).length;
  const totalBytes = rows.reduce((a, r) => a + r.bytes, 0);
  const maxBytes = Math.max(...rows.map((r) => r.bytes));
  const totalMs = +(performance.now() - tAll).toFixed(3);
  const ok = (passed === 90 && rows.length === 90 && totalBytes <= 850 * 1024 && magicRejected && shaRejected);

  console.log(JSON.stringify({
    schema: "run-all-90-wasm-suite/1",
    ok,
    node_version: process.version,
    passed_count: passed,
    total_count: rows.length,
    zero_import_count: ZERO_IMPORT_SLUGS.size,
    total_bytes: totalBytes,
    total_kb: +(totalBytes / 1024).toFixed(2),
    max_module_bytes: maxBytes,
    max_module_kb: +(maxBytes / 1024).toFixed(2),
    total_elapsed_ms: totalMs,
    planted_controls: {
      corrupted_magic_rejected: magicRejected,
      corrupted_magic_error: magicErr,
      tampered_manifest_sha_rejected: shaRejected,
    },
    rows,
  }, null, 2));

  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
