// t7v2-task-value.test.mjs: Telos Track A pre-registration 3 (T7 v2 and T5 v2), in-source only.
// The probe runs in py/t7v2_analyze.py (results/t7v2-task-value.json) and the budget and upsampler checks in
// py/t5v2_analyze.py (results/t5v2-budget-upsampler.json). Here: the pairing oracle behaves as specified on
// constructed cases, and every recorded gate and verdict re-derives from the recorded numbers.
// Run: node --test tests/telos-track-a/t7v2-task-value.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const T7 = join(HERE, "results", "t7v2-task-value.json");
const T5 = join(HERE, "results", "t5v2-budget-upsampler.json");
const py = (code) => execFileSync("python", ["-c", code], { cwd: join(HERE, "py"), encoding: "utf8" }).trim();

test("T7v2 oracle: a partner label that fixes the class gives 1; a partner label independent of the class gives the leave-one-out majority", () => {
  // y = 0,0,1,1 with partners 0,0,1,1: each image's cell holds one other image of its own class.
  assert.equal(py("import numpy as np;from t7v2_analyze import oracle;print(oracle(np.array([0,0,1,1]),np.array([[0],[0],[1],[1]])))"), "1.0");
  // Inverted pairing is learnable by a reader, so the oracle also reaches 1 (the binary-task case of T7 v1).
  assert.equal(py("import numpy as np;from t7v2_analyze import oracle;print(oracle(np.array([0,0,1,1]),np.array([[1],[1],[0],[0]])))"), "1.0");
  // One cell holding both classes: leave-one-out leaves the other class on top, so every prediction is wrong.
  assert.equal(py("import numpy as np;from t7v2_analyze import oracle;print(oracle(np.array([0,1]),np.array([[5],[5]])))"), "0.0");
});

test("T7v2 record: controls, positive controls, saturation and value verdicts re-derive from the recorded numbers", { skip: !existsSync(T7) }, () => {
  const R = JSON.parse(readFileSync(T7, "utf8"));
  assert.equal(R.tasks.length, 4);
  for (const t of R.tasks) {
    assert.equal(t.scope, "in-source only");
    const sat = t.configs["L0+L1+L2"].accuracy >= 0.99;
    assert.equal(t.saturated, sat);
    for (const [name, c] of Object.entries(t.controls)) {
      const ex = c.draws.map((a, i) => a - c.oracle[i]);
      const m = ex.reduce((a, b) => a + b, 0) / ex.length;
      const sd = Math.sqrt(ex.reduce((a, b) => a + (b - m) ** 2, 0) / (ex.length - 1));
      assert.equal(c.draws.length, 20);
      assert.ok(Math.abs(c.excess_upper - (m + 1.96 * sd / Math.sqrt(20))) < 1e-9, `${t.source} ${t.task} ${name}`);
      assert.equal(c.pass, c.excess_upper <= 0.02);
      assert.equal(R.gates[`${t.source} ${t.task} ${name}`], c.pass);
    }
    const p = t.positive_controls;
    for (const k of ["P_0.5", "P_0.25", "P_0.1", "D_0.5"]) assert.equal(p[k].detected, p[k].lo > 0);
    assert.equal(p.gate, sat ? "not applicable (saturated)" : p["P_0.5"].detected);
    assert.equal(R.gates[`${t.source} ${t.task} positive P_0.5`], p.gate);
    for (const v of Object.values(t.conditional_value)) assert.equal(v.carries_value, v.lo > 0 && !sat);
  }
});

test("T5v2 record: the L1 budget gate and the nearest-cell gates re-derive from the recorded numbers", { skip: !existsSync(T5) }, () => {
  const R = JSON.parse(readFileSync(T5, "utf8"));
  assert.equal(R.l1_budget, 160);
  const b = R.budget;
  assert.equal(b.pass, ["audit", "s0", "t7v2"].every((c) => b[c].over === 0 && b[c].max <= 160) && b.worst_case.tokens <= 160);
  for (const up of ["nearest", "bilinear"]) for (const [src, r] of Object.entries(R.rebuild[up])) for (const [step, s] of Object.entries(r.steps)) {
    const want = s.de2000_loss.hi <= 0.5 && s.ssim_loss.hi <= 0.02 && s.images_over_ceiling.de2000 === 0 && s.images_over_ceiling.ssim === 0;
    assert.equal(s.pass, want, `${up} ${src} ${step}`);
    if (up === "nearest") assert.equal(R.gates[`nearest ${src} ${step}`], s.pass);
  }
});
