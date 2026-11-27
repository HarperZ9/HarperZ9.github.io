// Browser + Node module for /playground/buildos-triad/.
// Loads the Zero-C BuildOS Microkernel Triad WebAssembly binaries (SHA-256, AEAD, X25519, TLS handshake,
// Ed25519, signed boot, capability scheduler, IPC + Merkle VFS, end-to-end triad), verifies each binary
// against a pinned SHA-256 before compile, requires zero imports, runs it, and injects attacks that must
// fail closed. No CDN, no network except same-origin fetches of the manifest and the .wasm files.

export class TriadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TriadError";
    this.code = code;
  }
}

export const KNOWN = Object.freeze({
  aeadTag: "1ae10b594f09e26a7e902ecbd0600691",
  x25519Shared: "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742",
  sha256Messages: Object.freeze(["", "abc", "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"]),
  sha256FlipMessage: "abd",
});

const A = (mode, label, expect_rc) => ({ mode, label, expect_rc });

export const MODULE_SPECS = Object.freeze([
  { slug: "sha256_zeroc", slice: 11, title: "FIPS 180-4 SHA-256", file: "sha256_zeroc.wasm", fn: null, clean_count: 24,
    attacks: [A(1, "Flip 1 input bit (abc to abd), compare to WebCrypto", -1)] },
  { slug: "aead_chacha20_poly1305", slice: 13, title: "RFC 8439 ChaCha20-Poly1305 AEAD", file: "aead_chacha20_poly1305.wasm",
    fn: "aead_rfc8439_run", clean_count: 34,
    attacks: [A(1, "1-bit ciphertext flip", 0), A(2, "1-bit AAD header flip", 0)] },
  { slug: "x25519_curve25519_zeroc", slice: 14, title: "RFC 7748 X25519 ECDH", file: "x25519_curve25519_zeroc.wasm",
    fn: "x25519_suite", clean_count: 26,
    attacks: [A(1, "1-bit Alice scalar flip", 0)] },
  { slug: "tls_mini_handshake_zeroc", slice: 15, title: "TLS mini handshake (X25519, HKDF-SHA256, AEAD)",
    file: "tls_mini_handshake_zeroc.wasm", fn: "tls_handshake_run", clean_count: 26,
    attacks: [A(1, "MITM transcript key swap", -101), A(2, "1-bit ciphertext flip", -201)] },
  { slug: "ed25519_verify_zeroc", slice: 16, title: "SHA-512 and RFC 8032 Ed25519 verify", file: "ed25519_verify_zeroc.wasm",
    fn: "ed25519_suite", clean_count: 46,
    attacks: [A(1, "1-bit signature S flip", -101), A(2, "1-bit message flip", -201),
      A(3, "Non-canonical S >= L malleability", -301)] },
  { slug: "buildos_signed_boot_zeroc", slice: 17, title: "Signed bootloader (SHA-256, epoch, RFC 6962, Ed25519)",
    file: "buildos_signed_boot_zeroc.wasm", fn: "buildos_boot_verify", clean_count: 28,
    attacks: [A(1, "1-bit kernel image tamper", -101), A(2, "Anti-rollback epoch downgrade", -201),
      A(3, "1-bit Merkle proof tamper", -301), A(4, "1-bit Ed25519 signature tamper", -401)] },
  { slug: "buildos_cap_sched_zeroc", slice: 18, title: "Capability scheduler, W^X, code-page SHA-256",
    file: "buildos_cap_sched_zeroc.wasm", fn: "microkernel_run", clean_count: 19,
    attacks: [A(1, "W^X violation (RWX page)", -101), A(2, "Forged capability bit", -201),
      A(3, "1-bit code-page tamper before dispatch", -301), A(4, "CPU budget overrun", -401)] },
  { slug: "buildos_ipc_vfs_zeroc", slice: 19, title: "Zero-copy capability IPC and Merkle VFS",
    file: "buildos_ipc_vfs_zeroc.wasm", fn: "ipc_vfs_run", clean_count: 20,
    attacks: [A(1, "Unauthorized sender (no capability)", -101), A(2, "Double send after transfer", -201),
      A(3, "1-bit silent block corruption", -301), A(4, "Ring sequence replay forgery", -401)] },
  { slug: "buildos_e2e_triad_zeroc", slice: 20, title: "End-to-end boot, schedule, IPC and VFS triad",
    file: "buildos_e2e_triad_zeroc.wasm", fn: "buildos_triad_run", clean_count: 30,
    attacks: [A(1, "Boot epoch rollback", -101), A(2, "Post-boot W^X escalation", -201),
      A(3, "IPC double-send ownership fault", -301), A(4, "VFS 1-bit block corruption", -401)] },
]);

const enc = new TextEncoder();
const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
export const u32be = (w) => (Number(w) >>> 0).toString(16).padStart(8, "0");
export const u32le = (w) => {
  const u = Number(w) >>> 0;
  return [u & 255, (u >>> 8) & 255, (u >>> 16) & 255, (u >>> 24) & 255].map((b) => b.toString(16).padStart(2, "0")).join("");
};

export async function sha256Hex(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) throw new TriadError("missing_webcrypto", "WebCrypto subtle.digest is unavailable");
  return toHex(new Uint8Array(await subtle.digest("SHA-256", u8)));
}
export const sha256Text = (s) => sha256Hex(enc.encode(s));
export const transcriptDigest = (logged) => sha256Text(logged.join(","));

// Pinned-hash gate: digest, magic, then compile, then zero-import requirement, all before any export runs.
export async function loadVerified(bytes, expectedSha256) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const expected = String(expectedSha256 || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) throw new TriadError("invalid_sha256", "pin must be 64 lowercase hex chars");
  const actual = await sha256Hex(u8);
  if (actual !== expected) throw new TriadError("sha256_mismatch", `expected ${expected}, got ${actual}`);
  if (!(u8.byteLength >= 8 && u8[0] === 0x00 && u8[1] === 0x61 && u8[2] === 0x73 && u8[3] === 0x6d)) {
    throw new TriadError("invalid_wasm_magic", "buffer lacks the 0x0061736d WebAssembly magic");
  }
  const module = await WebAssembly.compile(u8);
  const imports = WebAssembly.Module.imports(module);
  if (imports.length > 0) {
    throw new TriadError("disallowed_import", `Zero-C binaries must declare 0 imports, found ${imports.length}`);
  }
  return { module, bytes: u8.byteLength, sha256: actual };
}

export async function runMode(module, spec, mode) {
  const instance = await WebAssembly.instantiate(module, {});
  const ex = instance.exports;
  const t0 = performance.now();
  const rc = Number(spec.fn ? ex[spec.fn](BigInt(mode)) : ex.main());
  const ms = performance.now() - t0;
  const mem = new BigInt64Array(ex.memory.buffer);
  const count = spec.fn ? Number(mem[0]) : rc;
  const logged = [];
  for (let i = 1; i <= count; i++) logged.push(Number(mem[i]));
  return { rc, logged, ms };
}

async function sha256Words(logged, from) {
  return logged.slice(from, from + 8).map(u32be).join("");
}

export async function checkClean(spec, run) {
  if (spec.slug === "sha256_zeroc") {
    if (run.logged.length !== 24) return { ok: false, note: "expected 24 digest words" };
    for (let i = 0; i < 3; i++) {
      const want = await sha256Text(KNOWN.sha256Messages[i]);
      if ((await sha256Words(run.logged, i * 8)) !== want) return { ok: false, note: `NIST message ${i} digest mismatch` };
    }
    return { ok: true, note: "3/3 digests equal WebCrypto SHA-256" };
  }
  if (spec.slug === "aead_chacha20_poly1305") {
    const tag = run.logged.slice(29, 33).map(u32le).join("");
    const ok = run.rc === 1 && tag === KNOWN.aeadTag && run.logged[run.logged.length - 1] === 1;
    return { ok, note: ok ? "RFC 8439 tag matched, auth_ok=1" : "tag or auth flag mismatch" };
  }
  if (spec.slug === "x25519_curve25519_zeroc") {
    const shared = run.logged.slice(16, 24).map(u32le).join("");
    const ok = run.rc === 1 && shared === KNOWN.x25519Shared && run.logged[24] === 1 && run.logged[25] === 1;
    return { ok, note: ok ? "RFC 7748 shared secret matched" : "shared secret mismatch" };
  }
  const ok = run.rc === 1 && run.logged.length === spec.clean_count;
  return { ok, note: ok ? `status=1, ${run.logged.length} words` : "unexpected status or word count" };
}

export async function runAttack(module, spec, atk) {
  if (spec.slug === "sha256_zeroc") {
    const base = await runMode(module, spec, 0);
    const flipped = await sha256Text(KNOWN.sha256FlipMessage);
    const mismatch = (await sha256Words(base.logged, 8)) !== flipped;
    return { rc: mismatch ? -1 : 0, logged: base.logged.slice(8, 16), ms: base.ms, caught: mismatch };
  }
  const run = await runMode(module, spec, atk.mode);
  let caught = run.rc === atk.expect_rc;
  if (spec.slug === "aead_chacha20_poly1305") caught = caught && run.logged[run.logged.length - 1] === 0;
  if (spec.slug === "x25519_curve25519_zeroc") caught = caught && run.logged.slice(16, 24).map(u32le).join("") !== KNOWN.x25519Shared;
  if (spec.slug === "buildos_signed_boot_zeroc") caught = caught && run.logged[1] === 0;
  return { rc: run.rc, logged: run.logged, ms: run.ms, caught };
}

const IMPORTING_WASM = Uint8Array.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
  0x02, 0x0c, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x04, 0x6c, 0x65, 0x61, 0x6b, 0x00, 0x00,
]);

export async function integrityControls(manifest, readBytes) {
  const first = manifest.modules[0];
  const real = new Uint8Array(await readBytes(first.file));
  const out = [];
  const expectReject = async (id, label, bytes, pin, code) => {
    try {
      await loadVerified(bytes, pin);
      out.push({ id, label, code: "none", caught: false });
    } catch (err) {
      out.push({ id, label, code: err.code || "error", caught: err instanceof TriadError && err.code === code });
    }
  };
  const flipped = new Uint8Array(real);
  flipped[flipped.length - 1] ^= 1;
  await expectReject("byte_flip", "1-byte binary tamper against the pinned SHA-256", flipped, first.sha256, "sha256_mismatch");
  const badMagic = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 1, 0, 0, 0]);
  await expectReject("bad_magic", "Corrupted WebAssembly magic with a matching digest", badMagic, await sha256Hex(badMagic), "invalid_wasm_magic");
  await expectReject("extra_import", "Binary declaring one import with a matching digest", IMPORTING_WASM,
    await sha256Hex(IMPORTING_WASM), "disallowed_import");
  return out;
}

export async function runAll(manifest, readBytes) {
  const modules = [];
  for (const m of manifest.modules) {
    const bytes = await readBytes(m.file);
    const loaded = await loadVerified(bytes, m.sha256);
    const clean = await runMode(loaded.module, m, 0);
    const cleanCheck = await checkClean(m, clean);
    const cleanDigest = await transcriptDigest(clean.logged);
    const attacks = [];
    for (const atk of m.attacks) {
      const r = await runAttack(loaded.module, m, atk);
      const pinned = (await transcriptDigest(r.logged)) === atk.transcript_sha256;
      attacks.push({ mode: atk.mode, label: atk.label, rc: r.rc, expect_rc: atk.expect_rc, caught: r.caught, pinned });
    }
    modules.push({
      slug: m.slug, bytes: loaded.bytes, imports: 0, clean_ok: cleanCheck.ok, clean_rc: clean.rc,
      clean_words: clean.logged.length, clean_pinned: cleanDigest === m.clean_transcript_sha256, attacks,
    });
  }
  const attacksAll = modules.flatMap((x) => x.attacks);
  const controls = await integrityControls(manifest, readBytes);
  const ok = modules.every((x) => x.clean_ok && x.clean_pinned) && attacksAll.every((a) => a.caught && a.pinned)
    && controls.every((c) => c.caught);
  return {
    ok, modules, controls,
    clean_pass: modules.filter((x) => x.clean_ok && x.clean_pinned).length,
    attacks_caught: attacksAll.filter((a) => a.caught && a.pinned).length,
    attacks_total: attacksAll.length,
    controls_caught: controls.filter((c) => c.caught).length,
  };
}

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function renderLedgerRows(manifest) {
  return manifest.modules.map((m) => `        <tr data-slug="${esc(m.slug)}">
          <th scope="row">${esc(m.title)}<span class="bt-sub">Slice ${m.slice} | ${esc(m.file)}</span></th>
          <td class="mono">${fmtInt(m.bytes)} B</td>
          <td class="mono">0</td>
          <td class="mono" title="${m.sha256}">${m.sha256.slice(0, 12)}</td>
          <td class="mono" data-cell="status">PENDING</td>
          <td class="mono" data-cell="ms">pending</td>
        </tr>`).join("\n");
}

export function renderAttackRows(manifest) {
  const rows = [];
  for (const m of manifest.modules) {
    for (const atk of m.attacks) {
      rows.push(`        <tr data-slug="${esc(m.slug)}" data-mode="${atk.mode}">
          <th scope="row">${esc(m.title)}<span class="bt-sub">Slice ${m.slice}</span></th>
          <td>${esc(atk.label)}</td>
          <td class="mono">rc=${atk.expect_rc}</td>
          <td class="mono" data-cell="obs">pending</td>
          <td class="mono" data-cell="verdict">NOT RUN</td>
          <td><button type="button" class="bt-inject" data-slug="${esc(m.slug)}" data-mode="${atk.mode}" aria-label="Inject attack ${esc(atk.label)} into ${esc(m.title)}">Inject</button></td>
        </tr>`);
    }
  }
  return rows.join("\n");
}

export function renderControlRows() {
  const ids = [
    ["byte_flip", "1-byte binary tamper against the pinned SHA-256"],
    ["bad_magic", "Corrupted WebAssembly magic with a matching digest"],
    ["extra_import", "Binary declaring one import with a matching digest"],
  ];
  return ids.map(([id, label]) => `        <tr data-control="${id}">
          <th scope="row">${esc(label)}</th>
          <td class="mono" data-cell="obs">pending</td>
          <td class="mono" data-cell="verdict">NOT RUN</td>
        </tr>`).join("\n");
}

export function verifySurfaceConsistency(html, manifest) {
  const slugs = manifest.modules.map((m) => m.slug);
  const attackCount = manifest.modules.reduce((n, m) => n + m.attacks.length, 0);
  const ledger = (html.match(/<tr data-slug="[a-z0-9_]+">/g) || []).length;
  const attackRows = (html.match(/<tr data-slug="[a-z0-9_]+" data-mode="/g) || []).length;
  if (ledger !== slugs.length) throw new Error(`ledger rows ${ledger} != modules ${slugs.length}`);
  if (attackRows !== attackCount) throw new Error(`attack rows ${attackRows} != attacks ${attackCount}`);
  for (const m of manifest.modules) {
    if (!html.includes(m.sha256.slice(0, 16))) throw new Error(`missing sha256 prefix for ${m.slug}`);
    if (!html.includes(`${m.file}`)) throw new Error(`missing file name for ${m.slug}`);
  }
  return { ok: true, ledger, attackRows };
}

async function hydrate(doc) {
  const q = (sel) => doc.querySelector(sel);
  const status = q("#bt-status");
  const digest = q("#bt-digest");
  const base = new URL("./", doc.baseURI);
  const counters = { clean: 0, caught: 0, controls: 0, total: 0, modules: 0 };
  const fail = (msg) => { status.textContent = `FAIL CLOSED: ${msg}`; doc.documentElement.dataset.triadReady = "fail"; };
  const getBytes = async (name) => {
    const res = await fetch(new URL(name, base));
    if (!res.ok) throw new Error(`fetch ${name} failed (${res.status})`);
    return res.arrayBuffer();
  };
  const refresh = () => {
    status.textContent = `Clean runs: ${counters.clean}/${counters.modules} PASS | Attacks rejected: ${counters.caught}/${counters.total} | Integrity controls: ${counters.controls}/3`;
  };
  try {
    const mBuf = await getBytes("triad_manifest.json");
    const mSha = await sha256Hex(mBuf);
    const pinned = (q('meta[name="triad-manifest-sha256"]') || {}).content;
    if (mSha !== pinned) return fail("manifest SHA-256 does not match the pinned page digest");
    const manifest = JSON.parse(new TextDecoder().decode(mBuf));
    counters.modules = manifest.modules.length;
    counters.total = manifest.modules.reduce((n, m) => n + m.attacks.length, 0);
    digest.textContent = `Manifest SHA-256: ${mSha.slice(0, 23)}... | ${counters.modules} binaries, 0 imports each`;
    refresh();
    const loaded = new Map();
    const row = (slug) => q(`tr[data-slug="${slug}"]:not([data-mode])`);
    for (const m of manifest.modules) {
      const cell = (name) => row(m.slug).querySelector(`[data-cell="${name}"]`);
      try {
        const lv = await loadVerified(await getBytes(`wasm/${m.file}`), m.sha256);
        loaded.set(m.slug, lv.module);
        const run = await runMode(lv.module, m, 0);
        const chk = await checkClean(m, run);
        const pin = (await transcriptDigest(run.logged)) === m.clean_transcript_sha256;
        const ok = chk.ok && pin;
        if (ok) counters.clean++;
        cell("status").textContent = ok ? `PASS rc=${run.rc} (${run.logged.length}w)` : "FAIL";
        cell("ms").textContent = `${run.ms.toFixed(2)} ms`;
      } catch (err) {
        cell("status").textContent = `FAIL ${err.code || "error"}`;
      }
      refresh();
    }
    const injectRow = async (slug, mode) => {
      const m = manifest.modules.find((x) => x.slug === slug);
      const atk = m.attacks.find((x) => x.mode === mode);
      const tr = q(`tr[data-slug="${slug}"][data-mode="${mode}"]`);
      const mod = loaded.get(slug);
      if (!mod) { tr.querySelector('[data-cell="verdict"]').textContent = "NO MODULE"; return false; }
      const r = await runAttack(mod, m, atk);
      const pin = (await transcriptDigest(r.logged)) === atk.transcript_sha256;
      const ok = r.caught && pin;
      tr.querySelector('[data-cell="obs"]').textContent = `rc=${r.rc}`;
      tr.querySelector('[data-cell="verdict"]').textContent = ok ? "REJECTED" : "NOT CAUGHT";
      if (ok && !tr.dataset.counted) { tr.dataset.counted = "1"; counters.caught++; }
      refresh();
      return ok;
    };
    doc.querySelectorAll("button.bt-inject").forEach((b) => b.addEventListener("click", () => injectRow(b.dataset.slug, Number(b.dataset.mode))));
    q("#bt-inject-all").addEventListener("click", async () => {
      doc.documentElement.dataset.triadAttacks = "running";
      for (const m of manifest.modules) for (const atk of m.attacks) await injectRow(m.slug, atk.mode);
      doc.documentElement.dataset.triadAttacks = "done";
    });
    q("#bt-controls").addEventListener("click", async () => {
      doc.documentElement.dataset.triadControls = "running";
      try {
        const res = await integrityControls(manifest, (file) => getBytes(`wasm/${file}`));
        counters.controls = 0;
        for (const r of res) {
          const tr = q(`tr[data-control="${r.id}"]`);
          tr.querySelector('[data-cell="obs"]').textContent = r.code;
          tr.querySelector('[data-cell="verdict"]').textContent = r.caught ? "REJECTED" : "NOT CAUGHT";
          if (r.caught) counters.controls++;
        }
        refresh();
        doc.documentElement.dataset.triadControls = "done";
      } catch (err) {
        fail(String(err.message || err));
        doc.documentElement.dataset.triadControls = "fail";
      }
    });
    doc.documentElement.dataset.triadReady = "1";
  } catch (err) {
    fail(String(err.message || err));
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => hydrate(document));
  else hydrate(document);
}
