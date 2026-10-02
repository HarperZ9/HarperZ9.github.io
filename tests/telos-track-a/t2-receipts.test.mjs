// t2-receipts.test.mjs: Telos Track A step T2, SHA-256 receipts over canonical bytes.
// Rules and thresholds: tests/telos-track-a/PREREGISTRATION.md, section T2 and T0.4.
// Run: node --test tests/telos-track-a/t2-receipts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Bytes, sha256Hex, sha256HexAsync, toHex, utf8Bytes } from "../../shared-frame/sha256.js";
import {
  canonicalString, receiptSha256, sealReceipt, verifyReceipt, CanonicalError, CANONICAL_SCHEMA,
} from "../../shared-frame/canonical.js";
import { buildConversionReceipt, createMediaDocument } from "../../system/media/ir.js";
import { buildReceipt } from "../../system/exporters.js";
import { buildCertificate, certificateHash, stringOracle } from "../../shared-frame/certificate.js";
import { xorshift32, randInt } from "./lib/rng.mjs";
import { writeResult } from "./lib/results.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const results = {};
const nodeSha = (b) => createHash("sha256").update(b).digest("hex");

// ---------------------------------------------------------------- SHA-256 known answers
const KAT = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
  ["abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
    "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1"],
  ["a".repeat(1000000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
];

test("T2.KAT eq: the pure SHA-256 matches the FIPS 180-4 example vectors", () => {
  const got = KAT.map(([m, want]) => ({ len: m.length, ok: sha256Hex(m) === want }));
  results.kat = got;
  for (const [m, want] of KAT) assert.equal(sha256Hex(m), want, `length ${m.length}`);
});

test("T2.node eq: the pure SHA-256 agrees with Node's on 1,000 seeded byte strings of length 0..300", () => {
  const next = xorshift32(20261002);
  let agree = 0;
  for (let i = 0; i < 1000; i++) {
    // Cover every padding boundary: lengths 0..300 cycle, plus random content.
    const len = i < 301 ? i : randInt(next, 0, 300);
    const b = new Uint8Array(len);
    for (let j = 0; j < len; j++) b[j] = next() & 255;
    if (toHex(sha256Bytes(b)) === nodeSha(b)) agree++;
  }
  results.nodeAgreement = { n: 1000, agree };
  assert.equal(agree, 1000);
});

test("T2.webcrypto eq: Web Crypto and the forced pure path give the same digest", async () => {
  const b = utf8Bytes("receipt é \u{1F600}");
  assert.equal(await sha256HexAsync(b, null), await sha256HexAsync(b));
});

// ---------------------------------------------------------------- canonical bytes rules
test("T2.canon: the rules reject what cannot cross languages and order keys by UTF-16 unit", () => {
  for (const [v, code] of [[0.5, "non_integer_number"], [NaN, "non_finite_number"], [Infinity, "non_finite_number"],
    [2 ** 53, "unsafe_integer"], [{ a: undefined }, "undefined_value"], ["\ud800", "lone_surrogate"],
    [new Uint8Array(1), "unsupported_type:Uint8Array"], [() => 1, "unsupported_type:function"]]) {
    assert.throws(() => canonicalString(v), (e) => e instanceof CanonicalError && e.code === code, String(code));
  }
  assert.equal(canonicalString({ b: 1, a: [true, null, "x"] }), '{"a":[true,null,"x"],"b":1}');
  assert.equal(canonicalString("q\"\\\b\f\n\r\t\u0001\u007f "), '"q\\"\\\\\\b\\f\\n\\r\\t\\u0001\u007f "');
  assert.equal(canonicalString(-0), "0");
  // U+1F600 is D83D DE00 in UTF-16 and sorts before U+E000; code-point order would reverse them.
  assert.equal(canonicalString({ "": 1, "\u{1F600}": 2 }), '{"\u{1F600}":2,"":1}');
});

// ---------------------------------------------------------------- 1,000 receipts across languages
const ALPH = ["a", "b", "Z", "0", " ", "\"", "\\", "\n", "\t", "\u0000", "\u001f", "\u007f", "é", "中",
  " ", "�", "", "\u{1F600}", "\u{10FFFF}", "-", "_", "/"];
function rstr(next, max) {
  let s = "";
  const n = randInt(next, 0, max);
  for (let i = 0; i < n; i++) s += ALPH[next() % ALPH.length];
  return s;
}
function rhex(next) { let s = ""; for (let i = 0; i < 8; i++) s += next().toString(16).padStart(8, "0"); return s; }
function rint(next) {
  const k = next() % 6;
  if (k === 0) return 0;
  if (k === 1) return Number.MAX_SAFE_INTEGER;
  if (k === 2) return -Number.MAX_SAFE_INTEGER;
  return (next() % 2 ? -1 : 1) * (next() * 4096 + (next() % 4096));
}
function genReceipt(next, i) {
  const r = {
    schema: "project-telos.conversion-receipt/v1",
    adapterId: rstr(next, 12), adapterVersion: `${next() % 10}.${next() % 10}.${next() % 100}`,
    direction: next() % 2 ? "import" : "export",
    conservedFields: Array.from({ length: next() % 4 }, () => rstr(next, 8)),
    droppedFields: Array.from({ length: next() % 4 }, () => rstr(next, 8)),
    fidelityVerdict: ["MATCH", "DRIFT", "UNVERIFIABLE"][next() % 3],
    originHash: rhex(next), resultHash: rhex(next), hashAlgo: "sha-256",
    roundTrip: { supported: !!(next() % 2), verdict: "UNVERIFIABLE", notes: [rstr(next, 6)] },
    warnings: next() % 3 ? [] : [rstr(next, 20)], failureCode: next() % 4 ? null : rstr(next, 10),
    index: i, count: rint(next), fixedDecimal: (next() % 100000 / 1000).toFixed(3),
    nested: { [rstr(next, 3) || "k"]: rint(next), [rstr(next, 3) || "j"]: [rstr(next, 5), { deep: rint(next) }] },
  };
  return r;
}

test("T2.xlang eq: 1,000 seeded receipts re-derive identically in an independent Python canonicaliser", () => {
  const next = xorshift32(20261002);
  const receipts = Array.from({ length: 1000 }, (_, i) => genReceipt(next, i));
  const dir = mkdtempSync(join(tmpdir(), "telos-t2-"));
  try {
    const src = join(dir, "in.json"), dst = join(dir, "out.json");
    writeFileSync(src, JSON.stringify({ receipts }), "utf8");
    execFileSync("python", [join(HERE, "py", "canonical_receipt.py"), src, dst], { stdio: "pipe" });
    const py = JSON.parse(readFileSync(dst, "utf8"));
    let textAgree = 0, hashAgree = 0;
    const firstMismatch = [];
    receipts.forEach((r, i) => {
      const js = canonicalString(r), jh = receiptSha256(r);
      if (py[i].canonical === js) textAgree++;
      if (py[i].sha256 === jh) hashAgree++;
      else if (firstMismatch.length < 3) firstMismatch.push({ i, js: jh, py: py[i].sha256 || py[i].error });
    });
    results.crossLanguage = { n: receipts.length, textAgree, hashAgree, firstMismatch };
    assert.equal(textAgree, 1000);
    assert.equal(hashAgree, 1000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------- T0.4 edit suites per receipt type
function editSuite(name, base, edits, hashOf) {
  const h0 = hashOf(base);
  const rows = edits.map(([label, fn]) => {
    const copy = structuredClone(base);
    fn(copy);
    return { label, changed: hashOf(copy) !== h0 };
  });
  results.editSuites = results.editSuites || {};
  results.editSuites[name] = { edits: rows.length, changed: rows.filter((r) => r.changed).length,
    unchanged: rows.filter((r) => !r.changed).map((r) => r.label) };
  return rows;
}

const convOpts = () => ({
  adapterId: "svg-to-png", adapterVersion: "0.1.0", direction: "export",
  input: createMediaDocument("media.vector", { paths: ["M0 0L1 1"] }, { sourceFormat: "svg" }),
  output: createMediaDocument("media.image", { width: 1, height: 1 }, { sourceFormat: "png" }),
  conservedFields: ["dimensions"], droppedFields: ["vector-editability"], fidelityVerdict: "DRIFT",
  roundTrip: { supported: false, verdict: "UNVERIFIABLE", notes: ["n1"] }, warnings: ["w1"],
});

test("T0.4 eq: conversion receipt: 20 single-field edits each change the receipt hash; tampering fails verify", async () => {
  const sealed = await buildConversionReceipt(convOpts());
  assert.ok(verifyReceipt(sealed), "an untouched receipt verifies");
  const again = await buildConversionReceipt(convOpts());
  assert.equal(again.receiptSha256, sealed.receiptSha256, "the same conversion seals to the same digest");
  const body = { ...sealed }; delete body.receiptSha256;
  const edits = [
    ["schema", (r) => { r.schema += "x"; }], ["adapterId", (r) => { r.adapterId = "svg-to-pnh"; }],
    ["adapterVersion", (r) => { r.adapterVersion = "0.1.1"; }], ["direction", (r) => { r.direction = "import"; }],
    ["conservedFields add", (r) => { r.conservedFields.push("pixels"); }], ["conservedFields rename", (r) => { r.conservedFields[0] = "dimension"; }],
    ["droppedFields empty", (r) => { r.droppedFields = []; }], ["fidelityVerdict", (r) => { r.fidelityVerdict = "MATCH"; }],
    ["originHash one hex", (r) => { r.originHash = (r.originHash[0] === "0" ? "1" : "0") + r.originHash.slice(1); }],
    ["resultHash last hex", (r) => { r.resultHash = r.resultHash.slice(0, -1) + (r.resultHash.endsWith("0") ? "1" : "0"); }],
    ["hashAlgo", (r) => { r.hashAlgo = "fnv1a-fallback"; }], ["roundTrip.supported", (r) => { r.roundTrip.supported = true; }],
    ["roundTrip.verdict", (r) => { r.roundTrip.verdict = "MATCH"; }], ["roundTrip.notes", (r) => { r.roundTrip.notes = ["n2"]; }],
    ["warnings", (r) => { r.warnings = []; }], ["failureCode", (r) => { r.failureCode = "x"; }],
    ["canonical tag", (r) => { r.canonical = "v0"; }], ["extra field", (r) => { r.note = ""; }],
    ["field removed", (r) => { delete r.warnings; }], ["string case", (r) => { r.adapterId = "SVG-to-png"; }],
  ];
  const rows = editSuite("conversionReceipt", body, edits, receiptSha256);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.filter((r) => !r.changed).map((r) => r.label), []);
  for (const [label, fn] of edits) {
    const tampered = structuredClone(sealed); fn(tampered);
    assert.equal(verifyReceipt(tampered), false, `tampered ${label} must fail verify`);
  }
  // Payload sensitivity through the builder: one changed byte of input moves originHash.
  const o2 = convOpts(); o2.input = createMediaDocument("media.vector", { paths: ["M0 0L1 2"] }, { sourceFormat: "svg" });
  assert.notEqual((await buildConversionReceipt(o2)).receiptSha256, sealed.receiptSha256);
});

const MESH = { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]], faces: [[0, 1, 2], [1, 3, 2]] };
const OBJ_OUT = "v 0 0 0\nv 1 0 0\nv 0 1 0\nv 1 1 0\nf 1 2 3\nf 2 4 3\n";

test("T0.4 eq: export receipt: 20 single-field edits each change the receipt hash; tampering fails verify", async () => {
  const sealed = await buildReceipt("obj", null, { mesh: MESH }, OBJ_OUT);
  assert.ok(verifyReceipt(sealed));
  const pure = await buildReceipt("obj", null, { mesh: MESH }, OBJ_OUT, { subtle: null });
  assert.equal(pure.receiptSha256, sealed.receiptSha256, "Web Crypto and the pure path seal identically");
  const body = { ...sealed }; delete body.receiptSha256;
  const edits = [
    ["format", (r) => { r.format = "gltf"; }], ["criterion", (r) => { r.criterion = "custom-export"; }],
    ["conserved add", (r) => { r.conserved.push("normals"); }], ["conserved order", (r) => { r.conserved.reverse(); }],
    ["dropped remove", (r) => { r.dropped.pop(); }], ["discriminatorPassed", (r) => { r.discriminatorPassed = false; }],
    ["discriminatorPassed null", (r) => { r.discriminatorPassed = null; }],
    ["originHash", (r) => { r.originHash = r.originHash.replace(/^./, (c) => (c === "a" ? "b" : "a")); }],
    ["commitHash", (r) => { r.commitHash = r.commitHash.replace(/.$/, (c) => (c === "a" ? "b" : "a")); }],
    ["transform step", (r) => { r.transformsApplied[0].step = "encode:gltf"; }],
    ["transform criterion", (r) => { r.transformsApplied[1].criterion = "no-structural-test"; }],
    ["transform added", (r) => { r.transformsApplied.push({ step: "x", criterion: "y" }); }],
    ["transform removed", (r) => { r.transformsApplied.pop(); }], ["hashAlgo", (r) => { r.hashAlgo = "md5"; }],
    ["canonical tag", (r) => { r.canonical = "v2"; }], ["extra field", (r) => { r.faithfulness = 1; }],
    ["field removed", (r) => { delete r.dropped; }], ["empty conserved", (r) => { r.conserved = []; }],
    ["format case", (r) => { r.format = "OBJ"; }], ["dropped rename", (r) => { r.dropped[0] = r.dropped[0] + "s"; }],
  ];
  const rows = editSuite("exportReceipt", body, edits, receiptSha256);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.filter((r) => !r.changed).map((r) => r.label), []);
  for (const [label, fn] of edits) {
    const tampered = structuredClone(sealed); fn(tampered);
    assert.equal(verifyReceipt(tampered), false, `tampered ${label} must fail verify`);
  }
  const moved = { ...MESH, vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1]] };
  assert.notEqual((await buildReceipt("obj", null, { mesh: moved }, OBJ_OUT)).originHash, sealed.originHash, "a moved vertex moves originHash");
});

test("T0.4 eq: certificate pointer: 20 single-field edits each change the SHA-256 pointer", () => {
  const cert = { ...buildCertificate({ criterion: "quote:x", oracleVerdict: stringOracle("xyz", "x") }) };
  cert.iteration = 3;
  cert.claim = "x appears in the source"; // non-empty, so "claim emptied" is a real edit
  cert.evidence = [["metric", "l1"], ["distance", "0.25"], ["threshold", "0.5"]];
  const h0 = certificateHash(cert);
  assert.match(h0, /^[0-9a-f]{64}$/);
  assert.equal(certificateHash(structuredClone(cert)), h0, "the pointer is a pure function of the content");
  const edits = [
    ["criterion", (c) => { c.criterion = "quote:y"; }], ["claim", (c) => { c.claim = String(c.claim) + "!"; }],
    ["verdict", (c) => { c.verdict = c.verdict === "verified" ? "refuted" : "verified"; }],
    ["oracle", (c) => { c.oracle = "string-match-v2"; }], ["iteration +1", (c) => { c.iteration = 4; }],
    ["iteration to 0", (c) => { c.iteration = 0; }], ["evidence value", (c) => { c.evidence[1][1] = "0.26"; }],
    ["evidence key", (c) => { c.evidence[0][0] = "metrics"; }], ["evidence added", (c) => { c.evidence.push(["len", "3"]); }],
    ["evidence removed", (c) => { c.evidence.pop(); }], ["evidence order", (c) => { c.evidence.reverse(); }],
    ["evidence emptied", (c) => { c.evidence = []; }], ["criterion case", (c) => { c.criterion = "Quote:x"; }],
    ["criterion space", (c) => { c.criterion = "quote:x "; }], ["claim emptied", (c) => { c.claim = ""; }],
    ["verdict unverifiable", (c) => { c.verdict = "unverifiable"; }], ["oracle emptied", (c) => { c.oracle = ""; }],
    ["iteration fraction", (c) => { c.iteration = 3.5; }], ["evidence nested", (c) => { c.evidence[2] = ["threshold", ["0.5"]]; }],
    ["evidence unicode", (c) => { c.evidence[0][1] = "l¹"; }],
  ];
  const rows = editSuite("certificatePointer", cert, edits, certificateHash);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows.filter((r) => !r.changed).map((r) => r.label), []);
});

test("T2 sealed receipts carry the canonical tag", () => {
  const s = sealReceipt({ a: 1 });
  assert.equal(s.canonical, CANONICAL_SCHEMA);
  assert.ok(verifyReceipt(s));
});

test("T2 results file", () => {
  writeResult("t2-receipts", { results });
});
