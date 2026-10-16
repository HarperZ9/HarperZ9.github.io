// Lesson E25: the verifier. A restatement of Flywheel's
// harness/job_result_verify.py in the browser, check for check and name for
// name, except that every check runs on its own and reports what the receipt
// states beside what was recomputed, so the lab can show each one. Flywheel's
// verifier stops a group at its first failure (a results file whose bytes do
// not match is not parsed further); the verdict is the same, because any
// failure is a DRIFT. Checks with flywheel: false are the lesson's additions
// and never change the verdict.
//
// Input is the bundle as files, path to bytes, laid out as Flywheel's fixture:
// receipt.json, results.jsonl, reveal_answers.json, public_key.hex and
// job/<path> for the job folder. Options: publicKeyHex (the key the verifier
// pins; default public_key.hex), nonce, reviewers, seen (receipt ids already
// seen), reveal (false to verify as a stranger would before the reveal).

import { verifyReceipt } from "../media-engine/contracts.mjs";
import { SCHEMA, ENVELOPE_SCHEMA, SIGNED_OVER, DOES_NOT_PROVE, subtle, hex, unhex, utf8, sha256Hex, canonicalSha256, jobHash, parseRows, itemsRoot, rescore, jobScene, decodeStrict, pyStrip } from "./receipts.mjs";

export const JOB_PREFIX = "job/";
export const BUNDLE_FILES = Object.freeze(["receipt.json", "results.jsonl", "reveal_answers.json", "public_key.hex", "job/code/main.py", "job/config.yaml", "job/run.sh", "job/syft.pub.yaml", "run.json"]);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const sigMemo = new Map();

// Ed25519 through WebCrypto. Returns true, false, or null when this browser has no Ed25519.
export async function ed25519Verify(publicKey, message, signature) {
  const k = hex(publicKey) + hex(message) + hex(signature);
  if (sigMemo.has(k)) return sigMemo.get(k);
  const s = await subtle();
  let ok;
  try {
    const key = await s.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
    ok = await s.verify({ name: "Ed25519" }, key, signature, message);
  } catch (e) {
    if (e?.name === "NotSupportedError") return null;
    ok = false; // a malformed key or signature is a failed check, as in Flywheel
  }
  if (sigMemo.size > 50000) sigMemo.clear();
  sigMemo.set(k, ok);
  return ok;
}

export const keyIdFor = async (pubHex) => { const b = unhex(pubHex); return b && b.length === 32 ? "ed25519:" + (await sha256Hex(b)).slice(0, 32) : null; };
const parseJson = (bytes) => JSON.parse(decodeStrict(bytes));

export async function verify(files, opts = {}) {
  const checks = [], missing = [], unavailable = [];
  const add = (id, group, pass, stated, recomputed, what, flywheel = true) => { checks.push({ id, group, flywheel, pass, stated, recomputed, what }); return pass; };
  const guard = async (id, group, f, flywheel = true) => { try { await f(); } catch (e) { add(`malformed:${id}`, group, false, null, null, `${e.name}: ${e.message}`, flywheel); } };
  const pinned = opts.publicKeyHex ?? (files["public_key.hex"] ? pyStrip(decodeStrict(files["public_key.hex"])) : null);
  const job = Object.fromEntries(Object.entries(files).filter(([p]) => p.startsWith(JOB_PREFIX)).map(([p, b]) => [p.slice(JOB_PREFIX.length), b]));
  const results = files["results.jsonl"] ?? null;
  if (pinned === null) missing.push("public_key");
  if (!Object.keys(job).length) missing.push("job_dir");
  if (results === null) missing.push("results");
  let env;
  try { env = parseJson(files["receipt.json"]); } catch (e) {
    add("parse", "receipt", false, null, null, `receipt.json is not JSON (${e.name}); Flywheel's command line stops with an error before any check`);
    return finish(checks, missing, unavailable);
  }
  const body = isObj(env) ? env.body : null, sig = isObj(env) ? env.signature : null;
  let digest = null;

  await guard("signature", "signature", async () => {
    if (!isObj(sig) || !isObj(body)) return add("malformed", "signature", false, null, null, "the envelope has no body or no signature object");
    add("signed_over", "signature", sig.alg === "ed25519" && sig.signed_over === SIGNED_OVER, `${sig.alg} over ${sig.signed_over}`, `ed25519 over ${SIGNED_OVER}`, "the signature claims to cover claim_sha256 with Ed25519");
    digest = await canonicalSha256(body);
    add("claim_digest", "signature", env.claim_sha256 === digest, env.claim_sha256, digest, "SHA-256 of the body's canonical JSON, recomputed, never read from the receipt");
    if (pinned === null) return;
    add("wrong_signer", "signature", sig.public_key === pinned.toLowerCase(), sig.public_key, pinned.toLowerCase(), "the key named in the receipt is the key this verifier pins");
    const key = unhex(pinned), s = unhex(String(sig.sig));
    const ok = key && key.length === 32 && s && s.length === 64 ? await ed25519Verify(key, utf8(digest), s) : false;
    if (ok === null) { unavailable.push("signature"); return add("signature", "signature", null, sig.sig, null, "Ed25519 is not available in this browser, so the signature was not checked"); }
    add("signature", "signature", ok, sig.sig, ok ? "valid for the pinned key" : "not valid for the pinned key", "Ed25519 signature by the pinned key over the recomputed claim_sha256");
  });
  if (!isObj(body)) return finish(checks, missing, unavailable);

  await guard("schema_or_limits", "schema", () => {
    const dnp = body.does_not_prove, same = Array.isArray(dnp) && dnp.length === DOES_NOT_PROVE.length && dnp.every((s, i) => s === DOES_NOT_PROVE[i]);
    add("schema_or_limits", "schema", body.schema === SCHEMA && same, { schema: body.schema, limits: Array.isArray(dnp) ? dnp.length : null }, { schema: SCHEMA, limits: DOES_NOT_PROVE.length }, "the schema, and the seven fixed does_not_prove lines word for word");
  });
  await guard("job_hash", "job", async () => {
    const j = body.job;
    add("approval_covers_other_job", "job", j.approved_hash === j.received_hash, j.received_hash, j.approved_hash, "the approval names the submission that arrived");
    if (!Object.keys(job).length) return;
    const h = await jobHash(job);
    add("job_hash", "job", h === j.approved_hash, j.approved_hash, h, "PySyft's submission hash of the published job folder equals the approved hash");
  });
  await guard("approval", "approval", () => {
    const a = isObj(body.approval) ? body.approval : {};
    add("approval_missing", "approval", Boolean(a.approved_by && a.approved_at), { approved_by: a.approved_by ?? null, approved_at: a.approved_at ?? null }, "both present", "an approver and a time are recorded");
    add("approval_status", "approval", a.status === "done", a.status ?? null, "done", "the job finished");
    if (opts.reviewers) add("approver", "approval", opts.reviewers.includes(a.approved_by), a.approved_by ?? null, opts.reviewers, "the approver is one this verifier accepts");
  });
  await guard("superstack", "superstack", async () => {
    const rec = body.superstack, errs = verifyReceipt(rec);
    add("superstack", "superstack", errs.length === 0, rec?.receipt_sha256 ?? null, errs.length ? errs : "seal holds", "the embedded superstack.receipt/1 is well formed and its seal (receipt_sha256) recomputes");
    if (errs.length) return;
    const scene = await canonicalSha256(jobScene(body.job));
    add("superstack_scene", "superstack", rec.scene_sha256 === scene, rec.scene_sha256, scene, "the superstack scene is the approved job");
    add("superstack_tolerance", "superstack", rec.reconcile.tolerance.verdict === "verified", rec.reconcile.tolerance.verdict, "verified", "the superstack tolerance verdict says the score recomputes");
    add("superstack_content", "superstack", rec.content_sha256 === body.result?.results_sha256, rec.content_sha256, body.result?.results_sha256, "the superstack content is the released results file");
  });
  let rows = null;
  if (results !== null) await guard("results", "results", async () => {
    const res = body.result, h = await sha256Hex(results);
    add("results_bytes", "results", res.results_sha256 === h, res.results_sha256, h, "SHA-256 of results.jsonl as released");
    rows = parseRows(results);
    const root = await itemsRoot(rows), correct = rows.filter((r) => r.correct).length;
    add("items_root", "results", root === res.items_root, res.items_root, root, "Merkle root over each row's canonical JSON, in order");
    add("score", "results", correct === res.correct && rows.length === res.total, `${res.correct} of ${res.total}`, `${correct} of ${rows.length}`, "the score re-derived by counting the rows marked correct");
  });
  await guard("replay", "replay", () => {
    if (opts.nonce != null) add("replay_nonce", "replay", body.nonce === opts.nonce, body.nonce, opts.nonce, "the receipt answers this verifier's challenge");
    if (opts.seen) add("replay_seen", "replay", !opts.seen.includes(body.receipt_id), body.receipt_id, "not seen before", "the receipt was not presented before");
  });
  if (opts.reveal !== false && files["reveal_answers.json"] && results !== null) await guard("reveal", "reveal", () => {
    const answers = parseJson(files["reveal_answers.json"]), r = rescore(rows ?? parseRows(results), answers);
    if (!r.sameItems) return add("reveal_items", "reveal", false, "the rows' item ids", "the revealed answers' ids", "the revealed answers cover exactly the released items");
    add("reveal", "reveal", r.disagree.length === 0, `${(rows ?? []).filter((x) => x.correct).length} rows marked correct`, `${r.correct} correct against the answers; ${r.disagree.length} rows disagree${r.disagree.length ? ": " + r.disagree.join(", ") : ""}`, "each row's correct flag rescored against the revealed answer (exact match after stripping)");
  });
  await extras(add, guard, env, body, sig, rows);
  return finish(checks, missing, unavailable);
}

async function extras(add, guard, env, body, sig, rows) {
  await guard("envelope_schema", "extra", () => add("envelope_schema", "extra", env.schema === ENVELOPE_SCHEMA, env.schema, ENVELOPE_SCHEMA, "the envelope's schema label (outside the signed body; Flywheel's verifier does not read it)", false), false);
  await guard("key_id", "extra", async () => { const k = await keyIdFor(sig?.public_key); add("key_id", "extra", sig?.key_id === k, sig?.key_id ?? null, k, "key_id is ed25519: plus the first 32 hex of SHA-256(public key), as harness/receipt_signer.py writes it (outside the signed body; not read by the verifier)", false); }, false);
  await guard("receipt_id", "extra", async () => { const id = await canonicalSha256({ nonce: body.nonce, job: body.job, result: body.result }); add("receipt_id", "extra", body.receipt_id === id, body.receipt_id, id, "receipt_id recomputed as the canonical SHA-256 of nonce, job and result (the verifier only compares it with ids already seen)", false); }, false);
  if (rows) await guard("superstack_metrics", "extra", () => {
    const m = body.superstack?.reconcile?.tolerance?.metrics ?? {}, correct = rows.filter((r) => r.correct).length;
    const want = { claimed_correct: body.result.correct, claimed_total: body.result.total, rows_correct: correct, rows_total: rows.length };
    add("superstack_metrics", "extra", Object.keys(want).every((k) => m[k] === want[k]), m, want, "the superstack tolerance metrics match the stated score and the rows (the verifier reads only the verdict word)", false);
  }, false);
}

function finish(checks, missing, unavailable) {
  const codes = (c) => (c.id === "superstack" && Array.isArray(c.recomputed) ? c.recomputed.map((e) => "superstack:" + e) : [c.id]);
  const failed = [...new Set(checks.filter((c) => c.flywheel && c.pass === false).flatMap(codes))].sort();
  const extraFailed = checks.filter((c) => !c.flywheel && c.pass === false).map((c) => c.id).sort();
  const verdict = failed.length ? "DRIFT" : missing.length || unavailable.length ? "UNVERIFIABLE" : "MATCH";
  return { verdict, failed, extraFailed, missing, unavailable, checks, attestation: "UNVERIFIABLE" };
}
