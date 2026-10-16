// Fill lesson E25's numbers ("Case study: Flywheel and re-derivable
// evaluation") so no number in the film or lab is typed by hand. Writes
// media/school/receipts/facts.json.
//
//   node tools/school/fill_receipts.mjs [media/school/receipts] [flywheel checkout] [--copy]
//
// The evidence is Flywheel's public PySyft result receipt bundle, copied
// unchanged from HarperZ9/flywheel at the pinned commit below. With a
// checkout (third argument or FLYWHEEL_DIR) every copy is compared byte for
// byte with `git show <commit>:<path>`; with --copy the copies are written
// from it first. The checkout is only read, never switched. Without one, the
// sources block says the comparison was not run and the hashes recorded are
// those of the copies. No GPU. One process at below-normal priority.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { setPriority } from "node:os";
import { rederive, rescore, DOES_NOT_PROVE } from "../../system/school/receipts.mjs";
import { verify, BUNDLE_FILES } from "../../system/school/receipts-verify.mjs";
import { sweep, reproduce, sameScore, statedScore, cheater, lazyCheater } from "../../system/school/receipts-lab.mjs";
import { round, deep } from "./fill_gaming_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const args = process.argv.slice(2).filter((a) => a !== "--copy"), COPY = process.argv.includes("--copy");
const outDir = args[0] || "media/school/receipts", checkout = args[1] || process.env.FLYWHEEL_DIR || null;
const PIN = { repository: "https://github.com/HarperZ9/flywheel", branch: "main", commit: "f04ef26fda8e36e3f73521ebbc5e03c4220da72d", fixture: "tests/fixtures/pysyft_receipt", fixtureLastChanged: "7d47b8fc81d5921c0023b0884fc63498357a1ac8" };
const OPTS = { nonce: "openmined-bridge-demo-20261003", reviewers: ["do@example.org"] };
const SWEPT = ["receipt.json", "results.jsonl", "job/code/main.py", "job/config.yaml", "job/run.sh", "job/syft.pub.yaml", "reveal_answers.json", "public_key.hex"];
const cost = {};
const timed = async (k, f) => { const t = performance.now(), v = await f(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const sha = (b) => createHash("sha256").update(b).digest("hex");

function copies() {
  const git = (...a) => execFileSync("git", ["-C", checkout, ...a], { maxBuffer: 1 << 24 });
  const rows = BUNDLE_FILES.map((f) => {
    const src = `${PIN.fixture}/${f}`, bytes = git("show", `${PIN.commit}:${src}`), dst = join(outDir, f);
    if (COPY) { mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, bytes); }
    const local = existsSync(dst) ? readFileSync(dst) : null;
    return { file: f, source: src, blob: git("rev-parse", `${PIN.commit}:${src}`).toString().trim(), sameBytes: local !== null && Buffer.compare(local, bytes) === 0 };
  });
  return { compared: true, checkout: "a local clone of the repository, read with git show at the pinned commit", rows };
}

function sourcesBlock(files, cmp) {
  return {
    about: "Where the evidence comes from and what each piece proves. Every file in this folder except facts.json is a byte-for-byte copy of Flywheel's public test fixture tests/fixtures/pysyft_receipt at the pinned commit (Flywheel is FSL-1.1-MIT). sha256 is of the copy here; sameBytes is whether it equals git show <commit>:<source> when that comparison was run.",
    pin: PIN,
    files: BUNDLE_FILES.map((f) => ({ file: f, bytes: files[f].length, sha256: sha(files[f]), ...(cmp ? cmp.rows.find((r) => r.file === f) : {}) })),
    comparedWithSource: cmp ? cmp.compared : false,
    docs: [
      { path: "docs/features/pysyft-result-receipt.md", proves: "What the receipt binds and what a stranger can check: the job hash, the approval record, the per-item rows (results_sha256 and a Merkle items_root), the score, the replay nonce, the superstack seal, the fixed does_not_prove lines, and the reveal rescoring. It states the run: syft-job 0.1.41 from PySyft commit 36e6516 on Ubuntu 24.04 under WSL, 40 of 50.", doesNotProve: "Read as the project's own description. That the run happened as described is attested by the project, not by this lesson; the lesson checks only the bytes." },
      { path: "harness/job_result_verify.py", proves: "The verifier's checks, by name; the browser verifier here restates them one for one.", doesNotProve: "That its checks are sufficient. The sweep below finds bytes of the envelope that no check reads." },
      { path: "harness/job_result_receipt.py", proves: "How the body is built: the scoring rule, parse_rows, items_root, the superstack receipt, receipt_id, claim_sha256 and the fixed does_not_prove lines.", doesNotProve: "Anything about the hidden model or data." },
      { path: "harness/merkle.py", proves: "The RFC 6962 Merkle tree: 0x00 leaf prefix, 0x01 node prefix, split at the largest power of two below n.", doesNotProve: "" },
      { path: "harness/pysyft_job_hash.py", proves: "PySyft's submission hash restated: sorted relative POSIX paths, path, 0x00, SHA-256 of the bytes; syft.pub.yaml skipped. It names its source, OpenMined/PySyft at 36e65162, packages/syft-job/src/syft_job/submission.py.", doesNotProve: "That PySyft's own hash agrees on every platform; the module names two edges (Windows path order, newline normalisation on the submitter side)." },
      { path: "harness/_vendor/superstack.py", proves: "Canonical JSON v2 and superstack.receipt/1. The site carries the same contract, pinned, as system/media-engine/contracts.mjs (superstack.mjs v0.2.0).", doesNotProve: "" },
      { path: "tests/test_job_result_receipt.py", proves: "Flywheel's 16 paired tamper tests on this bundle, and the stated honest null: a consistent liar in the rows passes until the reveal.", doesNotProve: "" },
    ],
    doesNotProve: DOES_NOT_PROVE,
  };
}

const brief = (r) => ({ verdict: r.verdict, failed: r.failed, extraFailed: r.extraFailed, missing: r.missing, unavailable: r.unavailable, checks: r.checks.map((c) => ({ id: c.id, flywheel: c.flywheel, pass: c.pass })) });
const passing = (r, ids) => Object.fromEntries(ids.map((id) => [id, r.checks.find((c) => c.id === id)?.pass ?? null]));
const HASH_CHECKS = ["claim_digest", "signature", "wrong_signer", "job_hash", "results_bytes", "items_root", "score", "superstack", "superstack_scene", "superstack_content", "schema_or_limits"];

async function main() {
  const t0 = Date.now(), cmp = checkout ? copies() : null;
  const files = Object.fromEntries(BUNDLE_FILES.map((f) => [f, new Uint8Array(readFileSync(join(outDir, f)))]));
  const real = await timed("verify", () => verify(files, OPTS)), env = JSON.parse(Buffer.from(files["receipt.json"]).toString("utf8"));
  const der = await rederive(files["results.jsonl"]), answers = JSON.parse(Buffer.from(files["reveal_answers.json"]).toString("utf8")), re = rescore(der.rows, answers);
  const repro = await timed("reproduce", () => reproduce(files));
  const sweeps = {};
  for (const f of SWEPT) { sweeps[f] = await timed(`sweep ${f}`, () => sweep(files, f, OPTS)); console.error(`swept ${f}`); }
  const ctl = { sameScore: await sameScore(files, OPTS), statedScore: await statedScore(files, OPTS), cheater: await cheater(files, OPTS), lazyCheater: await lazyCheater(files, OPTS) };
  const blocks = {
    sources: sourcesBlock(files, cmp),
    receipt: { about: "The published receipt's own numbers, read from receipt.json.", schema: env.body.schema, envelope: env.schema, correct: env.body.result.correct, total: env.body.result.total, scoringRule: env.body.result.scoring_rule, itemsRoot: env.body.result.items_root, resultsSha256: env.body.result.results_sha256, approvedHash: env.body.job.approved_hash, claimSha256: env.claim_sha256, keyId: env.signature.key_id, nonce: env.body.nonce, attestation: env.body.attestation.status },
    rederive: { about: "The score re-derived from results.jsonl alone (count the rows marked correct), and rescored against the revealed answers.", correct: der.correct, total: der.total, fraction: der.fraction, matchesStated: der.correct === env.body.result.correct && der.total === env.body.result.total, reveal: { correct: re.correct, sameItems: re.sameItems, disagree: re.disagree } },
    reproduce: { about: "Every derived field of the receipt recomputed from its inputs with this lesson's code (WebCrypto SHA-256, canonical JSON v2 from the pinned superstack contract, RFC 6962 Merkle). same: the recomputed value equals the published one exactly.", fields: repro, allSame: Object.values(repro).every((v) => v.same) },
    verify: { about: "The real bundle through the browser verifier with the bundle's key pinned, the demo's nonce, the reviewer do@example.org and the revealed answers. Flywheel's own verifier gives MATCH on the same inputs (recheck/pysyft-result-receipt.json).", ...brief(real) },
    sweep: { about: "Every byte of each file flipped in turn (XOR 0x01, one byte at a time, so a file of n bytes gives n tampered bundles), each through the verifier. caughtByFlywheel: verdict DRIFT from Flywheel's checks; caughtWithExtras: DRIFT or a failed lesson extra. byCheck counts how often each check failed. uncaughtRegions: where in the file the uncaught bytes sit (JSON path for receipt.json). syft.pub.yaml is outside the job hash by PySyft's rule; reveal_answers.json is not bound by the receipt at all, so a changed answer is caught only when it changes a row's rescoring; public_key.hex is the verifier's own pin.",
      files: Object.fromEntries(Object.entries(sweeps).map(([f, s]) => [f, { bytes: s.bytes, caughtByFlywheel: s.caughtByFlywheel, caughtWithExtras: s.caughtWithExtras, byCheck: s.byCheck, byExtra: s.byExtra, uncaughtRegions: s.uncaughtRegions, uncaughtAllRegions: s.uncaughtAllRegions, uncaughtIndices: s.uncaught.length <= 64 ? s.uncaught.map((u) => u.index) : null, ms: s.ms }])) },
    controls: { about: "False-success controls. sameScore: two rows trade correct flags so the count is unchanged; the score check passes and the hashes catch the edit. statedScore: the stated score is edited and the rows are not; digest, signature and score fail. cheater: a key holder flips one wrong row to correct and rebuilds every digest, the superstack receipt, receipt_id and the signature with its own key; with that key pinned every hash check passes and only the revealed answers catch it; with the original key pinned the signature check catches the substitution, which is why the lie must come from the key holder. lazyCheater: Flywheel's own test cheater, which leaves receipt_id stale; Flywheel's verdict is MATCH before the reveal and only the lesson's receipt_id extra catches it.",
      sameScore: { what: ctl.sameScore.what, ...brief(ctl.sameScore.result), passes: passing(ctl.sameScore.result, ["score", "results_bytes", "items_root", "reveal"]) },
      statedScore: { what: ctl.statedScore.what, ...brief(ctl.statedScore.result), passes: passing(ctl.statedScore.result, ["claim_digest", "signature", "score"]) },
      cheater: ctl.cheater.available ? { what: ctl.cheater.what, beforeReveal: brief(ctl.cheater.beforeReveal), afterReveal: brief(ctl.cheater.afterReveal), originalKeyPinned: brief(ctl.cheater.originalKeyPinned), hashChecksBeforeReveal: passing(ctl.cheater.beforeReveal, HASH_CHECKS) } : ctl.cheater,
      lazyCheater: ctl.lazyCheater.available ? { what: ctl.lazyCheater.what, beforeReveal: brief(ctl.lazyCheater.beforeReveal), afterReveal: brief(ctl.lazyCheater.afterReveal) } : ctl.lazyCheater,
      lesson: "A hash proves the bytes did not change after they were hashed. A signature proves the key holder issued them. Neither says the rows were true when they were hashed; that needs a check against the truth, the revealed answers, as E24's exact checker was the only one that measured the goal." },
  };
  const sw = (f) => blocks.sweep.files[f];
  blocks.film = { about: "The sweep counts again under names the film's script can reach (file names contain dots). Same numbers as sweep.files.",
    results: { bytes: sw("results.jsonl").bytes, caught: sw("results.jsonl").caughtByFlywheel }, receipt: { bytes: sw("receipt.json").bytes, caught: sw("receipt.json").caughtByFlywheel, missed: sw("receipt.json").bytes - sw("receipt.json").caughtByFlywheel, caughtWithExtras: sw("receipt.json").caughtWithExtras },
    permissions: { bytes: sw("job/syft.pub.yaml").bytes, caught: sw("job/syft.pub.yaml").caughtByFlywheel }, answers: { bytes: sw("reveal_answers.json").bytes, caught: sw("reveal_answers.json").caughtByFlywheel },
    tampers: Object.values(blocks.sweep.files).reduce((n, f) => n + f.bytes, 0),
    rows: der.rows.map((r) => r.correct), cheat: { id: "q016", prediction: der.rows.find((r) => r.item_id === "q016")?.prediction ?? null, answer: answers.q016 ?? null } };
  blocks.timings = { about: "Milliseconds in Node (V8), one process at below-normal priority, on the fill machine's CPU. Each sweep runs the whole verifier once per byte.", parts: { ...cost }, seconds: (Date.now() - t0) / 1000 };
  const facts = { about: "Lesson E25, Case study: Flywheel and re-derivable evaluation. Computed by tools/school/fill_receipts.mjs from system/school/receipts.mjs, receipts-verify.mjs and receipts-lab.mjs on Flywheel's public PySyft result receipt bundle. Do not edit by hand.",
    sourceSha256: Object.fromEntries(["receipts.mjs", "receipts-verify.mjs", "receipts-lab.mjs"].map((f) => [f, sha(readFileSync(new URL(`../../system/school/${f}`, import.meta.url)))])), ...deep(blocks), seconds: 0 };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ rederive: facts.rederive, reproduceAllSame: facts.reproduce.allSame, verify: facts.verify.verdict, sweep: Object.fromEntries(Object.entries(facts.sweep.files).map(([f, s]) => [f, [s.caughtByFlywheel, s.caughtWithExtras, s.bytes, s.uncaughtRegions]])), cheater: facts.controls.cheater.beforeReveal?.verdict, seconds: facts.seconds }, null, 1));
}

main().catch((e) => { console.error("fill_receipts failed:", e); process.exit(1); });
