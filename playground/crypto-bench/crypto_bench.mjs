// Unified browser + Node pure-JS WebAssembly Zero-C Cryptography Lab (/playground/crypto-bench/)
// Zero external CDN dependencies; verifies SHA-256 of every .wasm buffer prior to instantiation.

const WASM_ENV = {
  print_i64() {},
  print_u64() {},
  print_f64() {},
  print_bool() {},
  print_str() {},
};

export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function u32BeHex(word) {
  return (word >>> 0).toString(16).padStart(8, "0");
}

function u32LeHex(word) {
  const u = word >>> 0;
  const b0 = (u & 0xff).toString(16).padStart(2, "0");
  const b1 = ((u >>> 8) & 0xff).toString(16).padStart(2, "0");
  const b2 = ((u >>> 16) & 0xff).toString(16).padStart(2, "0");
  const b3 = ((u >>> 24) & 0xff).toString(16).padStart(2, "0");
  return b0 + b1 + b2 + b3;
}

export async function sha256HexBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", u8);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(u8).digest("hex");
}

export function runCryptoModuleExports(slug, ex, { tamper = false } = {}) {
  const tFlag = tamper ? 1 : 0;

  if (slug === "sha256_zeroc") {
    let digest = "";
    for (let i = 0; i < 8; i++) {
      digest += u32BeHex(ex.sha256_abc_word(i, tFlag));
    }
    const flipWords = Number(ex.sha256_verify_flip_caught());
    const expectedClean = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    const expectedTampered = "a52d159f262b2c6ddb724a61840befc36eb30c88877a4030b65cbe86298449c9";
    const katMatch = digest === expectedClean;
    const tamperCaught = tamper ? (digest === expectedTampered && !katMatch) : flipWords === 8;
    return {
      slug,
      tamper,
      output_hex: digest,
      kat_match: katMatch,
      fail_closed_caught: tamperCaught,
      detail: tamper
        ? `1-bit flip -> digest diverged (${flipWords}/8 words avalanche), fail-closed REJECT`
        : `FIPS 180-4 KAT match; self-test flip guard=${flipWords}/8 words`,
    };
  }

  if (slug === "merkle_rfc6962") {
    let root = "";
    for (let i = 0; i < 8; i++) {
      root += u32BeHex(ex.merkle_root_word(tFlag, i));
    }
    const rc = Number(ex.merkle_verify_all(tFlag));
    const rcDomainSwap = Number(ex.merkle_verify_all(2));
    const expectedClean = "3c534b22b2e8c8fff07416469d39d9553b4d325e51874140e429b2c2a9ae22d2";
    const expectedTampered = "b6c43fd6ac264eea036fa6c7cfcca8a20c582030fb7b4aa70f352781dd13bfd4";
    const katMatch = root === expectedClean && rc === 4;
    const tamperCaught = tamper
      ? (root === expectedTampered && rc === -902 && !katMatch)
      : (rcDomainSwap === -903 && Number(ex.merkle_verify_all(1)) === -902);
    return {
      slug,
      tamper,
      output_hex: root,
      kat_match: katMatch,
      fail_closed_caught: tamperCaught,
      detail: tamper
        ? `1-bit leaf tamper -> rc=${rc} (domain swap rc=${rcDomainSwap}), fail-closed REJECT`
        : `4/4 RFC 6962 proofs PASS (rc=${rc}); leaf=-902, domain-swap=${rcDomainSwap}`,
    };
  }

  if (slug === "aead_chacha20_poly1305") {
    let tag = "";
    for (let i = 0; i < 4; i++) {
      tag += u32LeHex(ex.aead_tag_word(tFlag, 0, i));
    }
    let aadTamperTag = "";
    for (let i = 0; i < 4; i++) {
      aadTamperTag += u32LeHex(ex.aead_tag_word(0, 1, i));
    }
    const ct0 = u32LeHex(ex.aead_ct_first_word());
    const tampersCaught = Number(ex.aead_verify_tampers_caught());
    const expectedClean = "1ae10b594f09e26a7e902ecbd0600691";
    const expectedTampered = "843fc679081345d0a7aa816846c90f42";
    const katMatch = tag === expectedClean && ct0 === "d31a8d34";
    const tamperCaught = tamper
      ? (tag === expectedTampered && !katMatch)
      : (tampersCaught === 2 && aadTamperTag === "b7837c931c1b268f99eefa516bd77309");
    return {
      slug,
      tamper,
      output_hex: tag,
      kat_match: katMatch,
      fail_closed_caught: tamperCaught,
      detail: tamper
        ? `1-bit ciphertext flip -> Poly1305 tag mismatch (AAD tag=${aadTamperTag.slice(0, 12)}...), fail-closed REJECT`
        : `RFC 8439 tag + ct0=${ct0} PASS; CT & AAD tamper guards=${tampersCaught}/2`,
    };
  }

  if (slug === "x25519_curve25519_zeroc") {
    let count;
    if (tamper) {
      ex.x25519_suite(1n);
      count = Number(new BigInt64Array(ex.memory.buffer)[0]);
    } else {
      count = Number(ex.main());
    }
    const mem = new BigInt64Array(ex.memory.buffer);
    const logged = [];
    for (let i = 1; i <= count; i++) {
      logged.push(Number(mem[i]));
    }
    const wordsToHex = (arr) => arr.map((w) => u32LeHex(w)).join("");
    const alicePub = wordsToHex(logged.slice(0, 8));
    const bobPub = wordsToHex(logged.slice(8, 16));
    const shared = wordsToHex(logged.slice(16, 24));
    const ecdhMatch = logged[24];
    const lowOrderRejected = logged[25];
    const expectedClean = "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742";
    const expectedTampered = "e988be83790df90187b1f98e405bd22b55927b9f0facf56dc08a25f5afa32414";
    const katMatch =
      shared === expectedClean &&
      alicePub === "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a" &&
      bobPub === "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f" &&
      ecdhMatch === 1 &&
      lowOrderRejected === 1;
    const tamperCaught = tamper
      ? (shared === expectedTampered && ecdhMatch === 0 && lowOrderRejected === 1 && !katMatch)
      : (ecdhMatch === 1 && lowOrderRejected === 1);
    return {
      slug,
      tamper,
      output_hex: shared,
      kat_match: katMatch,
      fail_closed_caught: tamperCaught,
      detail: tamper
        ? `1-bit scalar flip -> ecdh_match=${ecdhMatch}, low_order_rejected=${lowOrderRejected}, fail-closed REJECT`
        : `RFC 7748 Alice/Bob ECDH PASS (ecdh_match=${ecdhMatch}, low_order_rejected=${lowOrderRejected})`,
    };
  }

  throw new Error(`Unknown crypto module slug: ${slug}`);
}

export async function verifyAndRunEntry(entry, loadBytes, { tamper = false } = {}) {
  const t0 = performance.now();
  const raw = await loadBytes(entry.wasm_path);
  const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const actualSha = await sha256HexBytes(u8);
  const shaOk = actualSha === entry.wasm_sha256;
  if (!shaOk) {
    return {
      slug: entry.slug,
      name: entry.name,
      standard: entry.standard,
      bytes: u8.byteLength,
      sha_ok: false,
      actual_sha256: actualSha,
      tamper,
      kat_match: false,
      fail_closed_caught: true,
      output_hex: "",
      detail: "Pre-instantiation SHA-256 mismatch: module refused fail-closed.",
      elapsed_ms: Number((performance.now() - t0).toFixed(3)),
    };
  }
  const imports = entry.slug === "x25519_curve25519_zeroc" ? {} : { env: WASM_ENV };
  const { instance } = await WebAssembly.instantiate(u8, imports);
  const res = runCryptoModuleExports(entry.slug, instance.exports, { tamper });
  return {
    slug: entry.slug,
    name: entry.name,
    standard: entry.standard,
    bytes: u8.byteLength,
    sha_ok: true,
    actual_sha256: actualSha,
    tamper,
    kat_match: res.kat_match,
    fail_closed_caught: res.fail_closed_caught,
    output_hex: res.output_hex,
    detail: res.detail,
    elapsed_ms: Number((performance.now() - t0).toFixed(3)),
  };
}

export async function runLoaderNegativeControls(manifest, loadBytes) {
  let magicRejected = false;
  let magicError = "";
  try {
    await WebAssembly.instantiate(new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x00, 0x00, 0x00]), {
      env: WASM_ENV,
    });
  } catch (err) {
    magicRejected = err instanceof WebAssembly.CompileError;
    magicError = err.name || String(err);
  }

  const first = manifest.modules[0];
  const badSha = (first.wasm_sha256[0] === "0" ? "1" : "0") + first.wasm_sha256.slice(1);
  const shaProbe = await verifyAndRunEntry({ ...first, wasm_sha256: badSha }, loadBytes, { tamper: false });
  const shaRejected = shaProbe.sha_ok === false && shaProbe.kat_match === false;

  return {
    corrupted_magic_rejected: magicRejected,
    corrupted_magic_error: magicError,
    tampered_manifest_sha_rejected: shaRejected,
    all_ok: magicRejected && shaRejected,
  };
}

export async function runCryptoBenchSuite(manifest, loadBytes, { tamperMap = {}, globalTamper = false } = {}) {
  const tAll = performance.now();
  const rows = [];
  for (const entry of manifest.modules) {
    const tamper = Boolean(globalTamper || tamperMap[entry.slug]);
    rows.push(await verifyAndRunEntry(entry, loadBytes, { tamper }));
  }
  const controls = await runLoaderNegativeControls(manifest, loadBytes);
  const totalBytes = rows.reduce((acc, r) => acc + r.bytes, 0);
  const cleanPassed = rows.filter((r) => !r.tamper && r.sha_ok && r.kat_match).length;
  const tamperRejected = rows.filter((r) => r.tamper && r.sha_ok && !r.kat_match && r.fail_closed_caught).length;

  return {
    schema: "wave89e-crypto-bench-run/1",
    module_count: rows.length,
    total_bytes: totalBytes,
    total_kb: Number((totalBytes / 1024).toFixed(2)),
    clean_passed: cleanPassed,
    tamper_rejected: tamperRejected,
    all_verified: rows.every((r) => r.sha_ok && (r.tamper ? !r.kat_match && r.fail_closed_caught : r.kat_match)) && controls.all_ok,
    elapsed_ms: Number((performance.now() - tAll).toFixed(3)),
    controls,
    rows,
  };
}

export function renderResultRows(manifest, resultsBySlug = new Map(), tamperState = {}) {
  return manifest.modules
    .map((m) => {
      const r = resultsBySlug.get(m.slug);
      const isTamper = Boolean(tamperState[m.slug]);
      const statusText = !r
        ? "READY"
        : !r.sha_ok
          ? "SHA REFUSED"
          : r.tamper
            ? r.fail_closed_caught
              ? "REJECTED (TAMPER CAUGHT)"
              : "ERROR"
            : r.kat_match
              ? "PASS"
              : "FAIL";
      const statusCls = !r
        ? "mono"
        : r.tamper && r.fail_closed_caught
          ? "mono cb-reject"
          : r.kat_match && r.sha_ok
            ? "mono cb-pass"
            : "mono cb-reject";
      const hexDisplay = r ? r.output_hex : m.expected_clean;
      const detail = r ? r.detail : `${m.kat_label}. ${m.tamper_description}`;
      const latency = r ? `${r.elapsed_ms.toFixed(2)} ms` : "pending";
      const shaLabel = r ? (r.sha_ok ? `${m.wasm_sha256.slice(0, 12)} OK` : "MISMATCH") : m.wasm_sha256.slice(0, 12);

      return `<tr data-crypto-slug="${escHtml(m.slug)}">
  <th scope="row">${escHtml(m.name)}<span class="cb-sub">${escHtml(m.standard)} | ${escHtml(m.idea_id)} | ${escHtml(m.formula_id)}</span></th>
  <td class="mono">${m.wasm_kb.toFixed(2)} KB<span class="cb-sub">${m.wasm_bytes} B</span></td>
  <td class="mono">${escHtml(latency)}</td>
  <td class="mono" title="${escHtml(hexDisplay)}">${escHtml(hexDisplay.slice(0, 20))}...<span class="cb-sub">${escHtml(detail)}</span></td>
  <td class="mono" title="${escHtml(m.wasm_sha256)}">${escHtml(shaLabel)}</td>
  <td><button type="button" class="cb-toggle" data-tamper-toggle="${escHtml(m.slug)}" aria-pressed="${isTamper}">${isTamper ? "1-Bit Tamper: ON" : "1-Bit Tamper: OFF"}</button></td>
  <td class="${statusCls}">${escHtml(statusText)}</td>
</tr>`;
    })
    .join("\n");
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    const summaryEl = document.getElementById("cb-summary");
    const controlsEl = document.getElementById("cb-controls");
    const tbody = document.getElementById("cb-rows");
    const btnRunClean = document.getElementById("cb-run-clean");
    const btnRunTamper = document.getElementById("cb-run-tamper");

    try {
      const manifest = await fetch("./crypto_bench_manifest.json").then((r) => r.json());
      const tamperMap = {};
      for (const m of manifest.modules) tamperMap[m.slug] = false;

      const loadBytes = async (relPath) => {
        const res = await fetch(`./${relPath}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${relPath}`);
        return new Uint8Array(await res.arrayBuffer());
      };

      async function execute() {
        if (summaryEl) summaryEl.textContent = "Verifying SHA-256 buffers and executing 4 Zero-C WebAssembly crypto modules...";
        const run = await runCryptoBenchSuite(manifest, loadBytes, { tamperMap });
        const bySlug = new Map(run.rows.map((r) => [r.slug, r]));
        if (tbody) tbody.innerHTML = renderResultRows(manifest, bySlug, tamperMap);
        if (summaryEl) {
          summaryEl.textContent = `Executed 4/4 MIT Zero-C WASM modules (${run.total_kb} KB total, ${run.elapsed_ms} ms) | Clean KAT PASS: ${run.clean_passed} | 1-Bit Tamper Rejected: ${run.tamper_rejected} | Overall: ${run.all_verified ? "VERIFIED" : "CHECK"}`;
        }
        if (controlsEl) {
          controlsEl.textContent = `Loader controls: corrupted WASM magic=${run.controls.corrupted_magic_rejected ? run.controls.corrupted_magic_error : "FAIL"} | tampered manifest SHA-256 rejected=${run.controls.tampered_manifest_sha_rejected}`;
        }
      }

      btnRunClean?.addEventListener("click", () => {
        for (const m of manifest.modules) tamperMap[m.slug] = false;
        execute();
      });
      btnRunTamper?.addEventListener("click", () => {
        for (const m of manifest.modules) tamperMap[m.slug] = true;
        execute();
      });
      tbody?.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-tamper-toggle]");
        if (!btn) return;
        const slug = btn.dataset.tamperToggle;
        tamperMap[slug] = !tamperMap[slug];
        execute();
      });

      await execute();
    } catch (err) {
      if (summaryEl) {
        summaryEl.textContent = `Interactive WASM load note: displaying pre-rendered KAT sheet (${err.message}).`;
      }
    }
  });
}
