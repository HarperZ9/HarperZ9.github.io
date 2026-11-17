// A rules table says what it decides and a flow diagram says how it runs, computed from their own data; a list of
// cells or nodes fails. Run: node --test tests/flow-rules-descriptions.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { flowGraph, describeFlow, checkFlow, describeRules, checkRules } from "../system/chart-describe-flow.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const charts = readdirSync(join(ROOT, "findings", "charts")).filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(join(ROOT, "findings", "charts", f), "utf8")).charts.map((c) => ({ f, c })));
const STEPS = [
  { kind: "data", label: "Tree rings" }, { kind: "measure", label: "Transfer entropy" }, { kind: "control", label: "Far-site pairs" },
  { kind: "rule", label: "Rules set in advance" }, { kind: "verdict", label: "Planted check", holds: false }, { kind: "verdict", label: "Real data", holds: true },
];

test("the graph: a chain to the decision, then one branch per verdict", () => {
  const G = flowGraph(STEPS);
  assert.deepEqual(G.edges, [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]]);
  assert.equal(G.decision, 3);
  assert.deepEqual(flowGraph([...STEPS.slice(0, 3), { kind: "measure", label: "Again", loop: 1 }]).edges.at(-1), [3, 1]);
});

test("planted: a description that lists the nodes without saying what leads to what fails", () => {
  const { facts } = describeFlow(STEPS);
  const list = "Steps: Tree rings, Transfer entropy, Far-site pairs, Rules set in advance, Planted check, Real data.";
  const errs = checkFlow(list, facts);
  assert.equal(errs.length, facts.edges.length, errs.join("; "));
  assert.ok(errs.every((e) => /does not say that step/.test(e)));
  assert.ok(checkFlow("It starts from Tree rings, which leads to Transfer entropy.", facts).some((e) => /never names step 3/.test(e)));
});

test("the computed flow sentence names every node and every edge, start, decision, branches and end", () => {
  const d = describeFlow(STEPS);
  assert.deepEqual(checkFlow(d.text, d.facts), [], d.text);
  assert.match(d.text, /^The design runs in 6 steps\. It starts from the data: Tree rings, which leads to the measurement: Transfer entropy, then the control: Far-site pairs, then the rule set in advance: Rules set in advance\./);
  assert.match(d.text, /Rules set in advance decides 2 verdicts \(1 held, 1 failed\), where the diagram ends: Planted check, failed; Real data, held\.$/);
  const loop = describeFlow([...STEPS.slice(0, 3), { kind: "measure", label: "Again", loop: 1 }]);
  assert.deepEqual(checkFlow(loop.text, loop.facts), []); assert.match(loop.text, /Again returns to Transfer entropy\. It ends at Again\./);
});

test("all 24 findings flow diagrams and all 11 rules tables pass their checkers", () => {
  let flows = 0, rules = 0;
  for (const { f, c } of charts) {
    if (c.form === "flow") { const d = describeFlow(c.steps); assert.deepEqual(checkFlow(d.text, d.facts), [], `${f} ${c.key}: ${d.text}`); flows++; }
    if (c.form === "rules") { const d = describeRules(c.rows); assert.deepEqual(checkRules(d.text, d.facts), [], `${f} ${c.key}: ${d.text}`); rules++; }
  }
  assert.equal(flows, 24); assert.equal(rules, 11);
});

const ROWS = [
  { label: "A: first ring within 5%", left: "3.4%", right: "5%", holds: true, yes: "as planned" },
  { label: "B: ratio within 3%", left: "2.9%", right: "3%", holds: true },
  { label: "C: control must miss", left: "40%", right: "10%", holds: false, no: "not as planned" },
];

test("a rules table: counts, the failed rule by name, and the closest call", () => {
  const d = describeRules(ROWS);
  assert.deepEqual(checkRules(d.text, d.facts), [], d.text);
  assert.equal(d.text, "3 rules set in advance: 2 held, 1 failed. Failed: C: control must miss, not as planned. Closest to its bar: B: ratio within 3%, 2.9% against 3%, held.");
});

test("planted: a rules description that reads the cells out, or gets a count wrong, fails", () => {
  const { facts } = describeRules(ROWS);
  const cells = "A: first ring within 5%, 3.4%, 5%, as planned. B: ratio within 3%, 2.9%, 3%, held. C: control must miss, 40%, 10%, not as planned.";
  assert.ok(checkRules(cells, facts).length >= 3, checkRules(cells, facts).join("; "));
  assert.ok(checkRules("3 rules set in advance: 3 held, 0 failed.", facts).some((e) => /how many held/.test(e)));
});
