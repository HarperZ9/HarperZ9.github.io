// Lesson E25, "Case study: Flywheel and re-derivable evaluation". Pure ES
// module, no DOM and no dependencies beyond the site's pinned superstack copy,
// so the lab page, a worker and the Node fill script share it.
//
// A claim that carries its own receipt. The receipt studied here is a real one
// from Flywheel (HarperZ9/flywheel, tests/fixtures/pysyft_receipt, schema
// flywheel.pysyft-job-result/v1 in a flywheel.signed-job-result/v1 envelope):
// a data owner approved a PySyft job, PySyft ran exactly the approved copy, the
// job released 50 per-item rows, and the receipt states 40 of 50 correct. This
// file re-derives that score and every hash that binds it, with nothing but
// SHA-256, a little arithmetic and (for the signature) Ed25519, all through
// WebCrypto: crypto.subtle in the browser, the same object as
// globalThis.crypto in Node.
//
// The rules restated here, each read from Flywheel's public main branch:
//   canonical JSON v2   superstack contract (harness/_vendor/superstack.py),
//                       imported from the site's pinned copy of the same
//                       contract (system/media-engine/contracts.mjs)
//   items_root          RFC 6962 Merkle tree (harness/merkle.py): leaf =
//                       SHA-256(0x00 || canonical row), node = SHA-256(0x01 ||
//                       left || right), split at the largest power of two
//                       below n; written "sha256:" + hex
//   job hash            PySyft's submission hash (harness/pysyft_job_hash.py):
//                       SHA-256 over files in sorted relative-path order, each
//                       adding path (UTF-8), one 0x00 byte, SHA-256(file bytes);
//                       syft.pub.yaml is skipped
//   claim_sha256        canonical SHA-256 of the receipt body; the Ed25519
//                       signature covers that hex string as ASCII
//   checks              harness/job_result_verify.py, by the same names
// Checks marked flywheel: false are this lesson's additions (fields the
// receipt carries that Flywheel's verifier does not recompute); they never
// change the Flywheel verdict.
//
// What passing proves is narrow. A hash proves the bytes did not change after
// someone computed it; a signature proves the key holder issued the body. A
// key holder who lies consistently in the rows passes every hash check, and
// only the revealed answers catch it (receipts-lab.mjs, the cheater control).

import { canonical, verifyReceipt } from "../media-engine/contracts.mjs";

export const SCHEMA = "flywheel.pysyft-job-result/v1";
export const ENVELOPE_SCHEMA = "flywheel.signed-job-result/v1";
export const SIGNED_OVER = "claim_sha256";
export const SCORING_RULE = "exact-match-strip/1";
export const HASH_RULE = "pysyft-submission-hash/1";
// harness/job_result_receipt.py DOES_NOT_PROVE: the verifier rejects a list that differs by a word.
export const DOES_NOT_PROVE = Object.freeze([
  "It does not prove the hidden model or the hidden data were what the parties said; that needs the enclave attestation link, which this receipt does not carry.",
  "It does not prove the job ran only once, or that a run with a worse score was not discarded before this receipt was issued.",
  "It does not prove the reviewer read the code or judged it well; it binds the approval record PySyft wrote, and PySyft does not sign that record.",
  "It does not prove the scoring rule or the benchmark measures what it claims to.",
  "It does not prove the per-item rows are correct until the hidden answers are revealed and rescored; before that, the score is only consistent with the rows.",
  "It does not prove anything about enclave side channels, the hardware vendor, or any attestation verifier.",
  "A valid signature shows only that the key holder issued this body. It says nothing about whether the key holder is honest.",
]);
const PERMISSION_FILE = "syft.pub.yaml";
const EXCLUDED = new Set([".venv", ".git", "__pycache__", ".mypy_cache", ".pytest_cache", ".ruff_cache", "node_modules", ".DS_Store"]);
const enc = new TextEncoder();
export const utf8 = (s) => enc.encode(s);
export { canonical };

// ---------------------------------------------------------------- SHA-256 through WebCrypto
let subtleP = null;
export function subtle() {
  if (!subtleP) subtleP = globalThis.crypto?.subtle ? Promise.resolve(globalThis.crypto.subtle) : import("node:crypto").then((m) => m.webcrypto.subtle);
  return subtleP;
}
export const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function unhex(s) {
  if (typeof s !== "string" || s.length % 2 || /[^0-9a-fA-F]/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}
export async function sha256(bytes) { return new Uint8Array(await (await subtle()).digest("SHA-256", bytes)); }
const fileMemo = new WeakMap();
// SHA-256 hex of a byte array; memoised by object identity so a sweep that
// tampers one file does not rehash the untouched ones.
export async function sha256Hex(bytes) {
  if (fileMemo.has(bytes)) return fileMemo.get(bytes);
  const h = hex(await sha256(bytes));
  fileMemo.set(bytes, h);
  return h;
}
export const canonicalSha256 = async (v) => hex(await sha256(utf8(canonical(v))));
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

// ---------------------------------------------------------------- RFC 6962 Merkle root
const leafMemo = new Map(), nodeMemo = new Map();
const remember = (m, k, v) => { if (m.size > 200000) m.clear(); m.set(k, v); return v; };
async function leafHash(data) {
  const k = hex(data);
  return leafMemo.get(k) ?? remember(leafMemo, k, await sha256(concat(Uint8Array.of(0), data)));
}
async function nodeHash(l, r) {
  const k = hex(l) + hex(r);
  return nodeMemo.get(k) ?? remember(nodeMemo, k, await sha256(concat(Uint8Array.of(1), l, r)));
}
const largestPow2Below = (n) => { let k = 1; while (k * 2 < n) k *= 2; return k; };
async function mth(hs) {
  if (hs.length === 0) return sha256(new Uint8Array(0));
  if (hs.length === 1) return hs[0];
  const k = largestPow2Below(hs.length);
  return nodeHash(await mth(hs.slice(0, k)), await mth(hs.slice(k)));
}
export async function merkleRoot(leaves) { return "sha256:" + hex(await mth(await Promise.all(leaves.map(leafHash)))); }

// ---------------------------------------------------------------- PySyft submission hash
const byCodePoint = (a, b) => { const x = utf8(a), y = utf8(b); for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i]; return x.length - y.length; };
export function hashedJobFiles(paths) {
  return paths.filter((p) => {
    const parts = p.split("/");
    return parts.at(-1).toLowerCase() !== PERMISSION_FILE && !parts.some((x) => EXCLUDED.has(x));
  }).sort(byCodePoint);
}
// jobFiles: { "code/main.py": bytes, ... } relative POSIX paths inside the job folder.
export async function jobHash(jobFiles) {
  const parts = [];
  for (const p of hashedJobFiles(Object.keys(jobFiles))) parts.push(utf8(p), Uint8Array.of(0), await sha256(jobFiles[p]));
  return hex(await sha256(concat(...parts)));
}

// ---------------------------------------------------------------- rows, as Python reads them
const PY_BREAKS = new Set([0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x85, 0x2028, 0x2029]);
const PY_SPACE = new Set([9, 10, 11, 12, 13, 28, 29, 30, 31, 32, 0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000]);
const isPySpace = (c) => PY_SPACE.has(c) || (c >= 0x2000 && c <= 0x200a);
// str.splitlines(): every Unicode line boundary Python knows, \r\n as one.
export function splitLines(s) {
  const out = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (!PY_BREAKS.has(c)) continue;
    out.push(s.slice(start, i));
    if (c === 0x0d && s.charCodeAt(i + 1) === 0x0a) i++;
    start = i + 1;
  }
  if (start < s.length) out.push(s.slice(start));
  return out;
}
export function pyStrip(s) {
  let a = 0, b = s.length;
  while (a < b && isPySpace(s.codePointAt(a))) a++;
  while (b > a && isPySpace(s.charCodeAt(b - 1))) b--;
  return s.slice(a, b);
}
const pyStr = (v) => (typeof v === "string" ? v : v === null ? "None" : v === true ? "True" : v === false ? "False" : String(v));
export const decodeStrict = (bytes) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); // Python's "utf-8" keeps a BOM too
export class ReceiptInputError extends Error {}
// harness/job_result_receipt.py parse_rows: one JSON object per non-blank line,
// exactly the keys item_id, prediction, correct, and correct a boolean.
export function parseRows(bytes) {
  const rows = [];
  splitLines(decodeStrict(bytes)).forEach((line, n) => {
    if (!pyStrip(line)) return;
    const row = JSON.parse(line), keys = row && typeof row === "object" && !Array.isArray(row) ? Object.keys(row).sort() : null;
    if (!keys || keys.join() !== "correct,item_id,prediction" || typeof row.correct !== "boolean") throw new ReceiptInputError(`results line ${n + 1}: item_id, prediction, correct`);
    rows.push(row);
  });
  if (!rows.length) throw new ReceiptInputError("results: no rows");
  return rows;
}
export const scoreOne = (prediction, answer) => pyStrip(pyStr(prediction)) === pyStrip(pyStr(answer));
export const itemsRoot = (rows) => merkleRoot(rows.map((r) => utf8(canonical(r))));
// Re-derive the score from the released bytes alone.
export async function rederive(resultsBytes) {
  const rows = parseRows(resultsBytes), correct = rows.filter((r) => r.correct).length;
  return { rows, correct, total: rows.length, fraction: correct / rows.length, itemsRoot: await itemsRoot(rows), resultsSha256: await sha256Hex(resultsBytes) };
}
// Rescore the rows against revealed answers: the one check that sees whether a row is true.
export function rescore(rows, answers) {
  const ids = rows.map((r) => r.item_id), keys = Object.keys(answers);
  const sameItems = keys.length === new Set(ids).size && ids.every((id) => Object.hasOwn(answers, id));
  if (!sameItems) return { sameItems, correct: null, disagree: [] };
  const disagree = rows.filter((r) => scoreOne(r.prediction, answers[r.item_id]) !== r.correct).map((r) => r.item_id);
  return { sameItems, correct: rows.filter((r) => scoreOne(r.prediction, answers[r.item_id])).length, disagree };
}
export const jobScene = (job) => ({ kind: "pysyft-job", hash_rule: job.hash_rule, approved_hash: job.approved_hash, name: job.name });

export { verify, BUNDLE_FILES, JOB_PREFIX } from "./receipts-verify.mjs";
