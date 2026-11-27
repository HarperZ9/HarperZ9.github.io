import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  TriadError, integrityControls, loadVerified, runAll, sha256Hex, verifySurfaceConsistency,
} from "../playground/buildos-triad/buildos_triad.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(path.dirname(HERE), "playground", "buildos-triad");
const rawManifest = readFileSync(path.join(DIR, "triad_manifest.json"));
const manifest = JSON.parse(rawManifest.toString("utf8"));
const html = readFileSync(path.join(DIR, "index.html"), "utf8");
const modSrc = readFileSync(path.join(DIR, "buildos_triad.mjs"), "utf8");
const readBytes = async (file) => readFileSync(path.join(DIR, "wasm", file));

test("manifest digest is pinned in the page and every binary matches its pinned SHA-256 with zero imports", async () => {
  const digest = createHash("sha256").update(rawManifest).digest("hex");
  assert.ok(html.includes(`<meta name="triad-manifest-sha256" content="${digest}">`));
  assert.equal(manifest.schema, "buildos-triad-manifest/1");
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.module_count, 9);
  assert.equal(manifest.total_attacks, 25);
  assert.equal(manifest.total_bytes, 111830);
  let total = 0;
  for (const m of manifest.modules) {
    const buf = await readBytes(m.file);
    assert.equal(buf.length, m.bytes, `${m.slug} size`);
    assert.equal(createHash("sha256").update(buf).digest("hex"), m.sha256, `${m.slug} digest`);
    const wasm = await WebAssembly.compile(buf);
    assert.equal(WebAssembly.Module.imports(wasm).length, 0, `${m.slug} must declare 0 imports`);
    total += buf.length;
  }
  assert.equal(total, manifest.total_bytes);
});

test("all 9 binaries run clean and all 25 injected attacks fail closed against pinned transcripts", async () => {
  const v = await runAll(manifest, readBytes);
  assert.equal(v.ok, true);
  assert.equal(v.clean_pass, 9);
  assert.equal(v.attacks_total, 25);
  assert.equal(v.attacks_caught, 25);
  assert.equal(v.controls_caught, 3);
  const by = Object.fromEntries(v.modules.map((m) => [m.slug, m]));
  assert.deepEqual(by.buildos_signed_boot_zeroc.attacks.map((a) => a.rc), [-101, -201, -301, -401]);
  assert.deepEqual(by.buildos_cap_sched_zeroc.attacks.map((a) => a.rc), [-101, -201, -301, -401]);
  assert.deepEqual(by.buildos_ipc_vfs_zeroc.attacks.map((a) => a.rc), [-101, -201, -301, -401]);
  assert.deepEqual(by.buildos_e2e_triad_zeroc.attacks.map((a) => a.rc), [-101, -201, -301, -401]);
  assert.deepEqual(by.ed25519_verify_zeroc.attacks.map((a) => a.rc), [-101, -201, -301]);
});

test("known answers: SHA-256 NIST vectors, RFC 8439 tag, and RFC 7748 shared secret come from the binaries", async () => {
  const v = await runAll(manifest, readBytes);
  for (const slug of ["sha256_zeroc", "aead_chacha20_poly1305", "x25519_curve25519_zeroc"]) {
    assert.equal(v.modules.find((m) => m.slug === slug).clean_ok, true, `${slug} known answer`);
  }
});

test("3/3 integrity controls reject byte tamper, bad magic, and an extra import before any export runs", async () => {
  const res = await integrityControls(manifest, readBytes);
  assert.deepEqual(res.map((r) => r.code), ["sha256_mismatch", "invalid_wasm_magic", "disallowed_import"]);
  assert.ok(res.every((r) => r.caught));
});

test("planted tampers: wrong pin, edited manifest, and edited transcript pin all fail closed", async () => {
  const m0 = manifest.modules[0];
  const buf = await readBytes(m0.file);
  const wrongPin = (m0.sha256[0] === "0" ? "1" : "0") + m0.sha256.slice(1);
  await assert.rejects(() => loadVerified(buf, wrongPin), (e) => e instanceof TriadError && e.code === "sha256_mismatch");
  assert.notEqual(await sha256Hex(Buffer.from(rawManifest.toString("utf8").replace("sha256_zeroc", "sha256_zerob"))),
    createHash("sha256").update(rawManifest).digest("hex"));
  const bad = structuredClone(manifest);
  bad.modules[5].attacks[0].transcript_sha256 = "0".repeat(64);
  const v = await runAll(bad, readBytes);
  assert.equal(v.ok, false);
  assert.equal(v.attacks_caught, 24);
});

test("page markup: 9 ledger rows, 25 attack rows, shell markers, no CDN, strict public hygiene", () => {
  const c = verifySurfaceConsistency(html, manifest);
  assert.equal(c.ledger, 9);
  assert.equal(c.attackRows, 25);
  assert.match(html, /href="\/world\/ui\/shell\/shell\.css(?:\?v=world-[0-9a-f]+)?"/);
  assert.match(html, /href="\/studies\/studies\.css(?:\?v=world-[0-9a-f]+)?"/);
  assert.ok(html.includes('class="reading ds-sheet"'));
  assert.ok(html.includes('class="o-hand o-said"'));
  assert.ok(html.includes('id="o-menu"'));
  assert.ok(html.includes('class="ds-prov"'));
  assert.ok(!html.includes('class="gw-backdrop"'));
  const cdn = /(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|stackpath\.bootstrapcdn)/i;
  for (const [label, text] of [["index.html", html], ["buildos_triad.mjs", modSrc], ["triad_manifest.json", rawManifest.toString("utf8")]]) {
    assert.ok(!cdn.test(text), `${label}: CDN reference`);
    assert.ok(!text.includes("\u2014") && !text.includes("\u2013"), `${label}: em or en dash`);
    assert.ok(!/[A-Za-z]:[\\/](?:dev|Users|Downloads|wt|library)/i.test(text), `${label}: local path`);
    assert.ok(!/zentropy|DS-08|isomorph/i.test(text), `${label}: forbidden token`);
  }
  assert.ok(!/\bfetch\(\s*["']https?:/i.test(modSrc), "module must not fetch absolute URLs");
});
