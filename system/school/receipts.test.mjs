// Tests for lesson E25, "Case study: Flywheel and re-derivable evaluation".
// Run: node --test system/school/receipts.test.mjs
// The evidence is Flywheel's public PySyft result receipt bundle, copied
// unchanged into media/school/receipts. Each claim has a control that must
// fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { merkleRoot, jobHash, splitLines, parseRows, rederive, rescore, utf8, hex, sha256 } from "./receipts.mjs";
import { verify, BUNDLE_FILES } from "./receipts-verify.mjs";
import { tamper, sweep, reproduce, sameScore, statedScore, cheater, lazyCheater, jsonSpans, locate } from "./receipts-lab.mjs";

const DIR = new URL("../../media/school/receipts/", import.meta.url);
const FILES = Object.fromEntries(BUNDLE_FILES.map((f) => [f, new Uint8Array(readFileSync(new URL(f, DIR)))]));
const OPTS = { nonce: "openmined-bridge-demo-20261003", reviewers: ["do@example.org"] };
const FACTS = existsSync(new URL("facts.json", DIR)) ? JSON.parse(readFileSync(new URL("facts.json", DIR), "utf8")) : null;
const pass = (r, id) => r.checks.find((c) => c.id === id)?.pass;
const HASH_CHECKS = ["claim_digest", "signature", "wrong_signer", "job_hash", "results_bytes", "items_root", "score", "superstack", "superstack_scene", "superstack_content", "schema_or_limits"];

test("the copies are Flywheel's bytes: SHA-256 of each equals the value recorded from git show at the pinned commit", () => {
  assert.ok(FACTS, "run tools/school/fill_receipts.mjs first");
  assert.equal(FACTS.sources.pin.commit, "f04ef26fda8e36e3f73521ebbc5e03c4220da72d");
  for (const f of FACTS.sources.files) {
    assert.equal(createHash("sha256").update(FILES[f.file]).digest("hex"), f.sha256, f.file);
    assert.equal(f.sameBytes, true, `${f.file} was compared with the source`);
  }
  // results_sha256 is also stated inside the signed receipt itself.
  assert.equal(createHash("sha256").update(FILES["results.jsonl"]).digest("hex"), "27a766f0839ad05aed4e7860fdd8c67c4bdaa901c5e58c15d6bc098969457a82");
});

test("the real receipt verifies: MATCH, every Flywheel check and every lesson extra passes", async () => {
  const r = await verify(FILES, OPTS);
  assert.equal(r.verdict, "MATCH");
  assert.deepEqual([r.failed, r.extraFailed, r.missing, r.unavailable], [[], [], [], []]);
  for (const id of [...HASH_CHECKS, "approver", "replay_nonce", "reveal", "envelope_schema", "key_id", "receipt_id", "superstack_metrics"]) assert.equal(pass(r, id), true, id);
  assert.equal(r.attestation, "UNVERIFIABLE", "the attestation gap is always reported");
});

test("every derived field reproduces byte for byte: claim digest, results hash, Merkle root, receipt id, superstack seal, key id", async () => {
  const rep = await reproduce(FILES);
  for (const [k, v] of Object.entries(rep)) assert.equal(v.same, true, `${k}: ${v.stated} vs ${v.recomputed}`);
  assert.equal(rep.claim_sha256.recomputed, "846878f2e1be8f06f527dfbba3d3a46ea1bf912a501e1c788efc59e3514f3782");
  assert.equal(rep.items_root.recomputed, "sha256:a447d77e826ecabb5ad462bdc0e230991a4c78090caf0bf3ed618a70ee651ba2");
});

test("the score re-derived from the rows equals the stated 40 of 50, and the revealed answers rescore to the same 40", async () => {
  const env = JSON.parse(new TextDecoder().decode(FILES["receipt.json"])), d = await rederive(FILES["results.jsonl"]);
  assert.deepEqual([d.correct, d.total], [env.body.result.correct, env.body.result.total]);
  assert.deepEqual([d.correct, d.total, d.fraction], [40, 50, 0.8]);
  const re = rescore(d.rows, JSON.parse(new TextDecoder().decode(FILES["reveal_answers.json"])));
  assert.deepEqual([re.sameItems, re.correct, re.disagree], [true, 40, []]);
});

test("hash rules by hand: RFC 6962 trees, PySyft's job hash, and Python's line splitting", async () => {
  const H = async (...parts) => hex(await sha256(Uint8Array.from(parts.flatMap((p) => [...p]))));
  assert.equal(await merkleRoot([]), "sha256:" + (await H()));
  const l = async (x) => sha256(Uint8Array.from([0, ...utf8(x)])), n = async (a, b) => sha256(Uint8Array.from([1, ...a, ...b]));
  const [a, b, c] = await Promise.all(["a", "b", "c"].map(l));
  assert.equal(await merkleRoot(["a", "b", "c"].map(utf8)), "sha256:" + hex(await n(await n(a, b), c)), "split at the largest power of two below n");
  assert.notEqual(await merkleRoot(["b", "a", "c"].map(utf8)), await merkleRoot(["a", "b", "c"].map(utf8)), "order matters");
  const files = { "code/a.py": utf8("x=1\n"), "run.sh": utf8("python a.py\n"), "config.yaml": utf8("name: j\n"), "SYFT.PUB.YAML": utf8("skipped"), "code/__pycache__/a.pyc": utf8("skipped") };
  const want = await H(...(await Promise.all([["code/a.py", "x=1\n"], ["config.yaml", "name: j\n"], ["run.sh", "python a.py\n"]].map(async ([p, s]) => [...utf8(p), 0, ...(await sha256(utf8(s)))]))));
  assert.equal(await jobHash(files), want, "Flywheel's test_hash_format_by_hand, restated");
  assert.deepEqual(splitLines("a\r\nb\x0bc\x1dd\n"), ["a", "b", "c", "d"]);
  assert.throws(() => parseRows(utf8('{"item_id": "q", "prediction": "1", "correct": 1}\n')), /item_id, prediction, correct/);
});

test("tamper flips one byte of a copy and refuses an index or mask outside the file", () => {
  const b = Uint8Array.of(1, 2, 3), t = tamper(b, 1);
  assert.deepEqual([...t], [1, 3, 3]);
  assert.deepEqual([...b], [1, 2, 3], "the input is not changed");
  assert.throws(() => tamper(b, 3), RangeError);
  assert.throws(() => tamper(b, 0, 0), RangeError);
});

test("every one-byte tamper of each hashed file fails its matching check; syft.pub.yaml is outside the job hash by PySyft's rule", async () => {
  const facts = {};
  for (const [file, check] of [["results.jsonl", "results_bytes"], ["job/code/main.py", "job_hash"], ["job/config.yaml", "job_hash"], ["job/run.sh", "job_hash"]]) {
    const s = await sweep(FILES, file, OPTS);
    assert.equal(s.caughtByFlywheel, s.bytes, `${file}: every flipped byte gives DRIFT`);
    assert.equal(s.byCheck[check], s.bytes, `${file}: every flipped byte fails ${check}`);
    facts[file] = s;
  }
  const pub = await sweep(FILES, "job/syft.pub.yaml", OPTS);
  assert.equal(pub.caughtWithExtras, 0, "the permission file is skipped by the hash, so no edit to it is seen");
  facts["job/syft.pub.yaml"] = pub;
  if (FACTS) for (const [f, s] of Object.entries(facts)) assert.equal(FACTS.sweep.files[f].caughtByFlywheel, s.caughtByFlywheel, `facts.json ${f}`);
});

test("every byte of receipt.json is caught except the two labels outside the signed body that Flywheel's verifier never reads", async () => {
  const s = await sweep(FILES, "receipt.json", OPTS);
  assert.equal(s.caughtWithExtras, s.bytes, "with the lesson's extras every flip is caught");
  const regions = Object.fromEntries(s.uncaughtRegions.map((r) => [r.where, r.bytes]));
  assert.deepEqual(Object.keys(regions).sort(), ["key schema", "key signature.key_id", "schema", "signature.key_id"]);
  assert.equal(s.caughtByFlywheel + Object.values(regions).reduce((a, b) => a + b, 0), s.bytes);
  const spans = jsonSpans(FILES["receipt.json"]), at = new TextDecoder().decode(FILES["receipt.json"]).indexOf('"correct": 40') + 11;
  assert.equal(locate(spans, at), "body.result.correct");
  if (FACTS) assert.equal(FACTS.sweep.files["receipt.json"].caughtByFlywheel, s.caughtByFlywheel);
});

test("control: two rows trade correct flags, the count is unchanged, the score check passes and the hashes catch it", async () => {
  const { result: r } = await sameScore(FILES, OPTS);
  assert.equal(pass(r, "score"), true, "a score check alone cannot see this edit");
  for (const id of ["results_bytes", "items_root", "reveal"]) assert.equal(pass(r, id), false, id);
  assert.equal(r.verdict, "DRIFT");
});

test("control: the stated score is edited and the rows are not; the digest, the signature and the score all fail", async () => {
  const { result: r } = await statedScore(FILES, OPTS);
  assert.deepEqual(r.failed, ["claim_digest", "score", "signature"]);
});

test("control: a key holder who lies consistently passes every hash check; only the revealed answers catch the lie", async () => {
  const c = await cheater(FILES, OPTS);
  assert.equal(c.available, true, "Node's WebCrypto has Ed25519");
  // This is the lesson, and why it passes is the point: a hash proves the bytes did
  // not change after they were hashed, and a signature proves the key holder issued
  // them. The cheater hashed and signed the lie, so both hold. As in E24, a check
  // pays for what it can see; only a check against the truth sees whether a row is true.
  assert.equal(c.beforeReveal.verdict, "MATCH");
  assert.deepEqual(c.beforeReveal.extraFailed, [], "a careful cheater also rebuilds receipt_id");
  for (const id of HASH_CHECKS) assert.equal(pass(c.beforeReveal, id), true, id);
  assert.deepEqual(c.afterReveal.failed, ["reveal"]);
  assert.deepEqual(c.originalKeyPinned.failed, ["signature", "wrong_signer"], "with the honest key pinned the substitution shows: the lie has to come from the key holder");
  const lazy = await lazyCheater(FILES, OPTS);
  assert.equal(lazy.beforeReveal.verdict, "MATCH", "Flywheel's own test cheater leaves receipt_id stale and its verifier does not recompute it");
  assert.deepEqual(lazy.beforeReveal.extraFailed, ["receipt_id"]);
});

test("missing inputs are UNVERIFIABLE, and hostile receipts give DRIFT without throwing", async () => {
  const { "results.jsonl": _r, ...noResults } = FILES;
  const r = await verify(noResults, { ...OPTS, reveal: false });
  assert.deepEqual([r.verdict, r.missing], ["UNVERIFIABLE", ["results"]]);
  for (const hostile of ["{}", '{"body": null}', '{"body": {}, "signature": {}}', "[]", "not json"]) {
    const h = await verify({ ...FILES, "receipt.json": utf8(hostile) }, OPTS);
    assert.equal(h.verdict, "DRIFT", hostile);
    assert.ok(h.failed.length, hostile);
  }
});
