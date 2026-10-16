// Lesson E25: the lab's instruments. Tamper with bytes, sweep every byte of a
// file through the verifier, locate a byte in the receipt's JSON, rebuild the
// receipt's derived parts from its inputs (the reproduction check), and the
// false-success controls:
//   sameScore     two rows trade their correct flags, so the count is still
//                 40 of 50: the score check passes and the hashes catch it;
//   statedScore   the receipt's stated score is edited and the rows are left
//                 alone: the digest, the signature and the score all fail;
//   cheater       a key holder flips a wrong row to correct and rebuilds every
//                 digest and the signature consistently: every hash check
//                 passes, and only the revealed answers catch it;
//   lazyCheater   Flywheel's own test cheater (tests/test_job_result_receipt.py,
//                 _lie_in_rows), which leaves receipt_id stale: Flywheel's
//                 verifier does not recompute receipt_id, the lesson's extra does.
// The cheater is E24's lesson again. A checker pays for a property it can see.
// A hash chain sees whether the bytes changed since they were hashed, not
// whether they were true when they were hashed; only a check against the truth
// (here the revealed answers, E24's exact checker) sees that.

import { makeReceipt, sha256 as sha256Sync } from "../media-engine/contracts.mjs";
import { DOES_NOT_PROVE, SIGNED_OVER, ENVELOPE_SCHEMA, subtle, hex, utf8, sha256, sha256Hex, canonicalSha256, parseRows, itemsRoot, jobScene, decodeStrict } from "./receipts.mjs";
import { verify, keyIdFor } from "./receipts-verify.mjs";

export function tamper(bytes, index, mask = 1) {
  if (!Number.isInteger(index) || index < 0 || index >= bytes.length) throw new RangeError(`byte ${index} is outside 0..${bytes.length - 1}`);
  if (!Number.isInteger(mask) || mask < 1 || mask > 255) throw new RangeError("mask must be 1..255");
  const out = Uint8Array.from(bytes);
  out[index] ^= mask;
  return out;
}

// ---------------------------------------------------------------- where a byte sits in the receipt
export function jsonSpans(bytes) {
  const b = bytes, spans = [];
  let i = 0;
  const ws = () => { while (i < b.length && (b[i] === 32 || b[i] === 9 || b[i] === 10 || b[i] === 13)) i++; };
  const str = () => { const s = i++; while (i < b.length && b[i] !== 34) i += b[i] === 92 ? 2 : 1; i++; return decodeStrict(b.subarray(s + 1, i - 1)); };
  function value(path) {
    ws();
    const start = i, c = b[i];
    if (c === 123 || c === 91) {
      i++; let n = 0;
      for (;;) {
        ws();
        if (b[i] === 125 || b[i] === 93) { i++; break; }
        let p = n++;
        if (c === 123) { const ks = i; p = str(); spans.push({ path: [...path, p], kind: "key", start: ks, end: i }); ws(); i++; }
        value([...path, p]); ws();
        if (b[i] === 44) i++;
      }
    } else if (c === 34) str();
    else while (i < b.length && ![44, 93, 125, 32, 9, 10, 13].includes(b[i])) i++;
    spans.push({ path, kind: "value", start, end: i });
  }
  value([]);
  return spans;
}
export function locate(spans, index) {
  let best = null;
  for (const s of spans) if (index >= s.start && index < s.end && (!best || s.end - s.start < best.end - best.start)) best = s;
  const name = (p) => p.join(".") || "(top level)";
  if (!best) return "outside the JSON";
  return best.kind === "key" ? `key ${name(best.path)}` : name(best.path);
}

// ---------------------------------------------------------------- sweep every byte of one file
export async function sweep(files, key, opts = {}, { mask = 1, onProgress = null, every = 256 } = {}) {
  const bytes = files[key], byCheck = {}, byExtra = {}, uncaught = [], uncaughtAll = [];
  const spans = key === "receipt.json" ? jsonSpans(bytes) : null;
  let flywheel = 0, any = 0;
  const t0 = performance.now();
  for (let i = 0; i < bytes.length; i++) {
    const r = await verify({ ...files, [key]: tamper(bytes, i, mask) }, opts);
    const fw = r.verdict === "DRIFT", ext = r.extraFailed.length > 0;
    if (fw) flywheel++;
    if (fw || ext) any++;
    for (const f of r.failed) byCheck[f] = (byCheck[f] ?? 0) + 1;
    for (const f of r.extraFailed) byExtra[f] = (byExtra[f] ?? 0) + 1;
    const at = { index: i, byte: bytes[i], to: bytes[i] ^ mask, where: spans ? locate(spans, i) : null, verdict: r.verdict };
    if (!fw) uncaught.push({ ...at, extraFailed: r.extraFailed });
    if (!fw && !ext) uncaughtAll.push(at);
    if (onProgress && i % every === 0) await onProgress(i, bytes.length);
  }
  const regions = (list) => Object.entries(list.reduce((m, u) => ((m[u.where ?? key] = (m[u.where ?? key] ?? 0) + 1), m), {})).map(([where, n]) => ({ where, bytes: n }));
  return { file: key, bytes: bytes.length, mask, caughtByFlywheel: flywheel, caughtWithExtras: any, byCheck, byExtra, uncaught, uncaughtAll, uncaughtRegions: regions(uncaught), uncaughtAllRegions: regions(uncaughtAll), ms: performance.now() - t0 };
}

// ---------------------------------------------------------------- rebuilding the derived parts
export function superstackFor(job, results, rows, correct, total) {
  const content = sha256Sync(results), rowsCorrect = rows.filter((r) => r.correct).length, ok = rowsCorrect === correct && rows.length === total;
  return makeReceipt({ producer: "flywheel.job_result_receipt", version: "1", backend: "pysyft-syft-job", scene: jobScene(job), media: { kind: "document", format: "jsonl" }, content: results,
    reference: { content_sha256: content, what: "results.jsonl as released" },
    reconcile: { identity: "MATCH", tolerance: { verdict: ok ? "verified" : "refuted", bounds: { rule: "rows_correct == claimed_correct and rows_total == claimed_total" }, metrics: { claimed_correct: correct, rows_correct: rowsCorrect, claimed_total: total, rows_total: rows.length } } },
    doesNotProve: DOES_NOT_PROVE });
}

// Recompute every derived field of the published receipt from its inputs and
// compare: the check that this module's serialisation is Flywheel's, byte for byte.
export async function reproduce(files) {
  const env = JSON.parse(decodeStrict(files["receipt.json"])), body = env.body, results = files["results.jsonl"], rows = parseRows(results);
  const ss = superstackFor(body.job, results, rows, body.result.correct, body.result.total);
  const pairs = {
    claim_sha256: [env.claim_sha256, await canonicalSha256(body)],
    results_sha256: [body.result.results_sha256, await sha256Hex(results)],
    items_root: [body.result.items_root, await itemsRoot(rows)],
    receipt_id: [body.receipt_id, await canonicalSha256({ nonce: body.nonce, job: body.job, result: body.result })],
    "superstack.receipt_sha256": [body.superstack.receipt_sha256, ss.receipt_sha256],
    "superstack.scene_sha256": [body.superstack.scene_sha256, await canonicalSha256(jobScene(body.job))],
    "superstack (whole object)": [await canonicalSha256(body.superstack), await canonicalSha256(ss)],
    key_id: [env.signature.key_id, await keyIdFor(env.signature.public_key)],
  };
  return Object.fromEntries(Object.entries(pairs).map(([k, [stated, recomputed]]) => [k, { stated, recomputed, same: stated === recomputed }]));
}

// ---------------------------------------------------------------- signing, for the cheater
const PKCS8_ED25519 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
// Flywheel's test attacker seed: SHA-256 of a public phrase, not a secret.
export const attackerSeed = () => sha256(utf8("flywheel test attacker key, not a secret"));
export async function signer(seed) {
  const s = await subtle(), der = new Uint8Array(PKCS8_ED25519.length + 32);
  der.set(PKCS8_ED25519); der.set(seed, PKCS8_ED25519.length);
  let key;
  try { key = await s.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]); } catch (e) { if (e?.name === "NotSupportedError") return null; throw e; }
  const jwk = await s.exportKey("jwk", key), pub = Uint8Array.from(atob(jwk.x.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  return { publicKeyHex: hex(pub), sign: async (msg) => new Uint8Array(await s.sign({ name: "Ed25519" }, key, msg)) };
}
async function envelope(body, sg) {
  const claim = await canonicalSha256(body);
  return { schema: ENVELOPE_SCHEMA, body, claim_sha256: claim, signature: { alg: "ed25519", signed_over: SIGNED_OVER, key_id: await keyIdFor(sg.publicKeyHex), public_key: sg.publicKeyHex, sig: hex(await sg.sign(utf8(claim))) } };
}
const asBytes = (env) => utf8(JSON.stringify(env, null, 2) + "\n");

// ---------------------------------------------------------------- the controls
const lines = (b) => decodeStrict(b).split("\n").slice(0, -1);
const joinLines = (ls) => utf8(ls.join("\n") + "\n");

export async function sameScore(files, opts) {
  const ls = lines(files["results.jsonl"]), t = ls.findIndex((l) => l.includes('"correct": true')), f = ls.findIndex((l) => l.includes('"correct": false'));
  ls[t] = ls[t].replace('"correct": true', '"correct": false'); ls[f] = ls[f].replace('"correct": false', '"correct": true');
  const r = await verify({ ...files, "results.jsonl": joinLines(ls) }, opts);
  return { what: `rows ${t + 1} and ${f + 1} trade their correct flags; the count stays the same`, rows: [t + 1, f + 1], result: r };
}

export async function statedScore(files, opts) {
  const env = JSON.parse(decodeStrict(files["receipt.json"]));
  env.body.result.correct += 1;
  return { what: `the receipt's stated score is edited to ${env.body.result.correct} of ${env.body.result.total}; the rows are untouched`, result: await verify({ ...files, "receipt.json": asBytes(env) }, opts) };
}

async function cheat(files, careful) {
  const ls = lines(files["results.jsonl"]), i = ls.findIndex((l) => l.includes('"correct": false'));
  ls[i] = ls[i].replace('"correct": false', '"correct": true');
  const results = joinLines(ls), rows = parseRows(results), env = JSON.parse(decodeStrict(files["receipt.json"])), body = structuredClone(env.body);
  Object.assign(body.result, { correct: env.body.result.correct + 1, items_root: await itemsRoot(rows), results_sha256: await sha256Hex(results) });
  body.superstack = superstackFor(body.job, results, rows, body.result.correct, rows.length);
  if (careful) body.receipt_id = await canonicalSha256({ nonce: body.nonce, job: body.job, result: body.result });
  const sg = await signer(await attackerSeed());
  if (!sg) return null;
  return { row: i + 1, item: rows[i].item_id, publicKeyHex: sg.publicKeyHex, files: { ...files, "results.jsonl": results, "receipt.json": asBytes(await envelope(body, sg)) } };
}

export async function cheater(files, opts = {}, careful = true) {
  const c = await cheat(files, careful);
  if (!c) return { available: false, why: "Ed25519 signing is not available in this browser" };
  const as = (o) => verify(c.files, { ...opts, ...o });
  return { available: true, row: c.row, item: c.item, cheaterKey: c.publicKeyHex,
    what: `row ${c.row} (${c.item}) is flipped from wrong to correct, and every digest, the superstack receipt${careful ? ", receipt_id" : ""} and the signature are rebuilt with the cheater's own key`,
    beforeReveal: await as({ publicKeyHex: c.publicKeyHex, reveal: false }),
    afterReveal: await as({ publicKeyHex: c.publicKeyHex }),
    originalKeyPinned: await as({ reveal: false }) };
}
export const lazyCheater = (files, opts) => cheater(files, opts, false);
