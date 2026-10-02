// t5-budgets.test.mjs: Telos Track A step T5, declared token budgets and prefix rebuilds.
// Rules: PREREGISTRATION.md, pre-registration 2 section T5. The measurement runs in t5t7-run.mjs and
// py/t5_analyze.py and is recorded in results/t5-budgets.json. Here: the noise-floor equality checks run
// live, and every recorded gate is re-derived from the recorded numbers (a failed gate is a result; the
// test checks that the record states it correctly).
// Run: TELOS_TRACKA_WORK=<prep_t5t7 output> node --test tests/telos-track-a/t5-budgets.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { layerPacket } from "../../system/lib/sense-core/layers-int.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = process.env.TELOS_TRACKA_WORK;
const haveWork = WORK && existsSync(join(WORK, "index.json")) ? false : "TELOS_TRACKA_WORK not set";
const R = JSON.parse(readFileSync(join(HERE, "results", "t5-budgets.json"), "utf8"));
const BUDGET = { L0: 80, L1: 100, "L2:chromatic": 1300, "L2:achromatic": 650 };

function sample(step = 10) {
  const index = JSON.parse(readFileSync(join(WORK, "index.json"), "utf8"));
  const out = [];
  for (const corpus of ["audit", "s0"]) index.corpora[corpus].forEach((e, k) => {
    if (k % step === 0) out.push({ key: `${corpus}/${e.name}`, w: e.w, h: e.h, px: new Uint8Array(readFileSync(join(WORK, "base", corpus, `${e.name}.rgba`))) });
  });
  return out;
}

test("T5.det eq: packet text is byte-identical across two encodings on every tenth image", { skip: haveWork }, () => {
  const imgs = sample();
  const same = imgs.filter((i) => layerPacket(i.px, i.w, i.h, 4, 32).text === layerPacket(i.px, i.w, i.h, 4, 32).text).length;
  assert.equal(same, imgs.length);
});

test("T5.twin eq: Node and the Python twin give byte-identical packet text on every tenth image", { skip: haveWork }, () => {
  const dir = mkdtempSync(join(tmpdir(), "telos-t5-"));
  try {
    execFileSync("python", ["layers_int.py", "packets", WORK, join(dir, "p.json"), "10"], { cwd: join(HERE, "py"), maxBuffer: 1 << 28 });
    const twin = JSON.parse(readFileSync(join(dir, "p.json"), "utf8"));
    const imgs = sample();
    const bad = imgs.filter((i) => twin[i.key] !== layerPacket(i.px, i.w, i.h, 4, 32).text).map((i) => i.key);
    assert.equal(Object.keys(twin).length, imgs.length);
    assert.deepEqual(bad, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("T5 record: the noise floor is zero (Node repeats and the Python twin identical on every image)", () => {
  const nf = R.noise_floor;
  for (const c of ["audit", "s0"]) assert.equal(nf.node_repeat_identical[c].same, nf.node_repeat_identical[c].of);
  assert.equal(nf.python_twin_identical.same, nf.python_twin_identical.of);
  assert.equal(nf.python_twin_identical.of, 336);
});

test("T5 record: every recorded gate re-derives from the recorded numbers", () => {
  for (const c of ["audit", "s0"]) {
    const res = R.corpora[c];
    for (const [k, t] of Object.entries(res.tokens)) {
      const over = res.per_image.filter((r) => (k === "L0" || k === "L1" ? r.tokens[k] : r.branch === k ? r.tokens.L2 : -1) > BUDGET[k]);
      assert.equal(t.over_budget.length, over.length, `${c} ${k} over-budget count`);
    }
    assert.equal(res.budget_pass, Object.values(res.tokens).every((t) => t.over_budget.length === 0));
    assert.equal(R.gates[`${c} budgets`], res.budget_pass);
    for (const [step, [a, b]] of Object.entries({ "R0->R1": [0, 1], "R1->R2": [1, 2] })) {
      const s = res.steps[step];
      const dl = res.per_image.map((r) => r.de2000[b] - r.de2000[a]), sl = res.per_image.map((r) => r.ssim[a] - r.ssim[b]);
      const pass = s.de2000_loss.hi <= 0.5 && s.ssim_loss.hi <= 0.02 && Math.max(...dl) <= 2.0 && Math.max(...sl) <= 0.05;
      assert.equal(s.pass, pass, `${c} ${step}`);
      assert.equal(R.gates[`${c} ${step}`], pass);
    }
  }
});
