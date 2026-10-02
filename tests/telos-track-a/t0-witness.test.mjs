// t0-witness.test.mjs: Telos Track A step T0, the witness rules.
//   T0.1/T0.2: the pre-registration hash re-derives in Python, and every result file cites it.
//   T0.3: every equality test in the Track A suites is named in mutation/registry.json with at least
//         one paired mutation, and the last mutation run (results/mutation.json) killed each of them.
// Run: node --test tests/telos-track-a/t0-witness.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preregSha256, amendment1Sha256, PREREG_PATH } from "./prereg-hash.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, "results");
const REGISTRY = JSON.parse(readFileSync(join(HERE, "mutation", "registry.json"), "utf8"));

test("T0.1 eq: the pre-registration hash re-derives identically in Python", () => {
  const py = execFileSync("python", ["-c",
    "import hashlib,sys;t=open(sys.argv[1],encoding='utf-8').read().replace('\\r\\n','\\n');"
    + "a='<!-- prereg-track-a-v1:start -->';s=t.index(a)+len(a);e=t.index('<!-- prereg-track-a-v1:end -->');"
    + "print(hashlib.sha256(t[s:e].encode()).hexdigest())", PREREG_PATH], { encoding: "utf8" }).trim();
  assert.equal(py, preregSha256());
});

test("T0.2 eq: every result file cites the current pre-registration hash (and v2 files the amendment)", () => {
  const files = readdirSync(RESULTS).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 6, `expected the T0..T3 result files, found ${files.length}`);
  const bad = [];
  for (const f of files) {
    const j = JSON.parse(readFileSync(join(RESULTS, f), "utf8"));
    if (j.prereg_sha256 !== preregSha256()) bad.push(`${f}: prereg ${j.prereg_sha256}`);
    if ("amendment_1_sha256" in j && j.amendment_1_sha256 !== amendment1Sha256()) bad.push(`${f}: amendment ${j.amendment_1_sha256}`);
  }
  assert.deepEqual(bad, []);
});

function equalityTestsInSuites() {
  const out = [];
  for (const f of readdirSync(HERE).filter((n) => /^t[0123]-.*\.test\.mjs$/.test(n))) {
    const src = readFileSync(join(HERE, f), "utf8");
    for (const m of src.matchAll(/test\(\s*"([^"]*\beq:[^"]*)"/g)) out.push({ file: f, name: m[1] });
  }
  return out;
}

test("T0.3: every equality test in the suites is registered with at least one paired mutation", () => {
  const registered = new Map(REGISTRY.equalityTests.map((t) => [t.file + "::" + t.name, t.id]));
  const missing = equalityTestsInSuites().filter((t) => !registered.has(t.file + "::" + t.name));
  assert.deepEqual(missing, [], "unregistered equality tests");
  const paired = new Set(REGISTRY.mutations.flatMap((m) => m.kills));
  const unpaired = REGISTRY.equalityTests.filter((t) => !paired.has(t.id)).map((t) => t.id);
  assert.deepEqual(unpaired, [], "equality tests without a paired mutation");
});

test("T0.3: the last mutation run killed every registered equality test", { skip: existsSync(join(RESULTS, "mutation.json")) ? false : "no mutation run recorded yet" }, () => {
  const run = JSON.parse(readFileSync(join(RESULTS, "mutation.json"), "utf8"));
  assert.equal(run.baseline.allPassed, true, "the unmutated copy must pass");
  const killedIds = new Set(run.mutations.flatMap((m) => m.killed));
  const notKilled = REGISTRY.equalityTests.map((t) => t.id).filter((id) => !killedIds.has(id));
  assert.deepEqual(notKilled, []);
});
