// run-mutations.mjs: Track A step T0.3, show that every equality test can fail.
//
// For the baseline and for each mutation in registry.json, copy system/, shared-frame/ and
// tests/telos-track-a/ to a fresh temporary directory, apply the one mutation (its `find` text must
// occur exactly once), run the paired test file with the TAP reporter, and record which tests failed.
// A paired equality test that fails is "killed". Surviving mutations are reported, never dropped.
// The 36 audit frames are used when TELOS_AUDIT_FRAMES points at them (as for the T3 frames test).
//
// Run: node tests/telos-track-a/mutation/run-mutations.mjs [--slow]
//   writes results/mutation.json when TELOS_WRITE_RESULTS=1; exits 1 if the baseline fails or any
//   registered equality test is left unkilled by all of its mutations.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeResult } from "../lib/results.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const REG = JSON.parse(readFileSync(join(HERE, "registry.json"), "utf8"));
const SLOW = process.argv.includes("--slow");
const TREES = ["system", "shared-frame", join("tests", "telos-track-a")];

function freshCopy() {
  const dir = mkdtempSync(join(tmpdir(), "telos-mut-"));
  for (const t of TREES) cpSync(join(ROOT, t), join(dir, t), { recursive: true });
  return dir;
}

function applyMutation(dir, m) {
  const path = join(dir, m.file);
  const src = readFileSync(path, "utf8");
  const n = src.split(m.find).length - 1;
  if (n !== 1) throw new Error(`${m.id}: find text occurs ${n} times in ${m.file}`);
  writeFileSync(path, src.replace(m.find, m.replace));
}

// Run one test file and return { failed: Set(test names), passedCount, exit }.
function runTests(dir, testFile) {
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", join("tests", "telos-track-a", testFile)],
    { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26, env: { ...process.env, TELOS_WRITE_RESULTS: "0", TELOS_IN_MUTATION_RUN: "1" } });
  const failed = new Set(), passed = new Set();
  for (const line of (r.stdout || "").split(/\r?\n/)) {
    const m = line.match(/^(not ok|ok) \d+ - (.*?)(?: # (?:SKIP|TODO).*)?$/);
    if (m) (m[1] === "ok" ? passed : failed).add(m[2].trim());
  }
  return { failed, passed, exit: r.status };
}

const nameOf = new Map(REG.equalityTests.map((t) => [t.id, t]));
const out = { registry: "tests/telos-track-a/mutation/registry.json", auditFramesDirSet: Boolean(process.env.TELOS_AUDIT_FRAMES),
  baseline: {}, mutations: [], slow: [] };

// Baseline: every paired test file passes unmutated.
{
  const dir = freshCopy();
  try {
    const files = [...new Set(REG.mutations.map((m) => m.testFile))];
    out.baseline.files = files.map((f) => { const r = runTests(dir, f); return { file: f, failed: [...r.failed], passed: r.passed.size, exit: r.exit }; });
    out.baseline.allPassed = out.baseline.files.every((f) => f.exit === 0 && f.failed.length === 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

for (const m of REG.mutations) {
  const dir = freshCopy();
  const t0 = Date.now();
  try {
    applyMutation(dir, m);
    const r = runTests(dir, m.testFile);
    const killed = m.kills.filter((id) => r.failed.has(nameOf.get(id).name));
    const survived = m.kills.filter((id) => !r.failed.has(nameOf.get(id).name));
    out.mutations.push({ id: m.id, file: m.file, fault: m.fault, testFile: m.testFile, killed, survived,
      otherFailures: [...r.failed].filter((n) => !m.kills.some((id) => nameOf.get(id).name === n)), seconds: (Date.now() - t0) / 1000 });
    console.log(`${m.id.padEnd(30)} killed ${killed.length}/${m.kills.length}${survived.length ? "  SURVIVED: " + survived.join(", ") : ""}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (SLOW) {
  for (const s of REG.slow) {
    const dir = freshCopy();
    try {
      applyMutation(dir, s);
      const r = spawnSync(s.command[0] === "node" ? process.execPath : s.command[0], s.command.slice(1),
        { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26, env: { ...process.env, TELOS_WRITE_RESULTS: "0" } });
      let gate = null;
      try { gate = JSON.parse(r.stdout).gate; } catch (_) { gate = { unparsed: (r.stdout || "").slice(0, 400) }; }
      out.slow.push({ id: s.id, fault: s.fault, exit: r.status, killed: r.status === 1, gate });
      console.log(`${s.id.padEnd(30)} exit ${r.status}${gate && gate.perChannel ? " mismatches " + JSON.stringify(gate.perChannel) : ""}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
}

const killedIds = new Set(out.mutations.flatMap((m) => m.killed));
out.summary = {
  equalityTests: REG.equalityTests.length,
  killedAtLeastOnce: REG.equalityTests.filter((t) => killedIds.has(t.id)).length,
  neverKilled: REG.equalityTests.filter((t) => !killedIds.has(t.id)).map((t) => t.id),
  mutations: out.mutations.length,
  mutationsWithSurvivors: out.mutations.filter((m) => m.survived.length).map((m) => ({ id: m.id, survived: m.survived })),
  slowKilled: out.slow.filter((s) => s.killed).length + "/" + out.slow.length,
};
console.log(JSON.stringify({ baseline: out.baseline.allPassed, ...out.summary }, null, 1));
writeResult("mutation", out);
process.exitCode = out.baseline.allPassed && out.summary.neverKilled.length === 0 ? 0 : 1;
