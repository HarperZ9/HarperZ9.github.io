// chart-describe-flow.mjs: what a rules table decides and how a flow diagram runs, computed from their own data.
// A list of cells or nodes is the same flaw as naming only the axes: it says what is drawn, not what it does.
//
//   flowGraph(steps)          the diagram's graph: one node per step, an edge from each step to the next, and a run of
//                             verdicts at the end as branches from the step before them (the decision). Steps may
//                             also carry `branch` (an extra edge from that step index) or `loop` (an edge back to it).
//   describeFlow(steps, o)    where it starts, what leads to what, the decision and each branch with its verdict,
//                             any loop, and where it ends. Returns { text, facts: { kind: "flow", nodes, edges } }.
//   checkFlow(text, facts)    the errors: a node the text never names, or an edge with no word joining its two ends
//                             (a bare list of nodes has none); an empty list passes.
//   describeRules(rows, o)    how many rules, how many held and failed, which failed, and the closest call: the rule
//                             whose value sits nearest its bar. checkRules(text, facts) checks the counts and names.
//
// Pure, so the build and the browser say the same words.

const WORD = { data: "the data", measure: "the measurement", control: "the control", planted: "the planted check", rule: "the rule set in advance", verdict: "the verdict" };
const JOIN = /\b(then|leads to|lead to|decides|decided|branches|returns to|feeds)\b/i;
const strip = (s) => String(s).trim().replace(/[.\s]+$/, "");
const outcome = (s) => (s.holds == null ? s.na || "not testable" : s.holds ? s.yes || "held" : s.no || "failed");

export function flowGraph(steps) {
  const n = steps.length, edges = [];
  let v0 = n; while (v0 > 0 && steps[v0 - 1].kind === "verdict") v0--;
  const decision = v0 > 0 && v0 < n ? v0 - 1 : null;
  for (let i = 0; i + 1 < (decision == null ? n : v0); i++) edges.push([i, i + 1]);
  if (decision != null) for (let j = v0; j < n; j++) edges.push([decision, j]);
  steps.forEach((s, i) => {
    if (Number.isInteger(s.branch)) edges.push([i, s.branch]);
    if (Number.isInteger(s.loop)) edges.push([i, s.loop]);
  });
  return { nodes: steps.map((s) => strip(s.label)), edges, decision, verdicts: decision == null ? [] : steps.slice(v0).map((_, k) => v0 + k) };
}

export function describeFlow(steps, opts = {}) {
  const G = flowGraph(steps), L = G.nodes, name = opts.name || "The design";
  const first = steps[0], parts = [`${name} runs in ${steps.length} steps. It starts from ${WORD[first.kind] || first.kind}: ${L[0]}`];
  const chainEnd = G.decision == null ? steps.length - 1 : G.decision;
  for (let i = 1; i <= chainEnd; i++) parts.push(`${i === 1 ? ", which leads to" : ", then"} ${WORD[steps[i].kind] || steps[i].kind}: ${L[i]}`);
  let s = parts.join("") + ".";
  for (const [a, b] of G.edges) if (Number.isInteger(steps[a].loop) && steps[a].loop === b) s += ` ${L[a]} returns to ${L[b]}.`;
  for (const [a, b] of G.edges) if (Number.isInteger(steps[a].branch) && steps[a].branch === b) s += ` ${L[a]} also branches to ${L[b]}.`;
  if (G.decision != null) {
    const vs = G.verdicts.map((j) => steps[j]), held = vs.filter((v) => v.holds === true).length, failed = vs.filter((v) => v.holds === false).length, na = vs.length - held - failed;
    const tally = [held ? `${held} held` : "", failed ? `${failed} failed` : "", na ? `${na} not testable` : ""].filter(Boolean).join(", ");
    s += ` ${L[G.decision]} decides ${vs.length === 1 ? "one verdict" : `${vs.length} verdicts`} (${tally}), where the diagram ends: ${G.verdicts.map((j) => `${L[j]}, ${outcome(steps[j])}`).join("; ")}.`;
  } else s += ` It ends at ${L[steps.length - 1]}.`;
  return { text: s, facts: { kind: "flow", nodes: L, edges: G.edges } };
}

// the shortest stretch of text from a mention of a to a later mention of b, or null
function gap(t, a, b) {
  let best = null;
  for (let i = t.indexOf(a); i >= 0; i = t.indexOf(a, i + 1)) {
    const j = t.indexOf(b, i + a.length);
    if (j >= 0 && (best == null || j - i < best.length)) best = t.slice(i + a.length, j);
  }
  return best;
}

export function checkFlow(text, facts) {
  const t = String(text || ""), errs = [];
  facts.nodes.forEach((l, i) => { if (!t.includes(l)) errs.push(`never names step ${i + 1}, ${l}`); });
  for (const [a, b] of facts.edges) {
    const g = gap(t, facts.nodes[a], facts.nodes[b]);
    if (g == null || !JOIN.test(g)) errs.push(`does not say that step ${a + 1} leads to step ${b + 1}`);
  }
  return errs;
}

const num = (s) => { const m = /[-+−]?\d[\d,]*(?:\.\d+)?(?:e[-+]?\d+)?/i.exec(String(s)); return m ? Number(m[0].replace(/,/g, "").replace("−", "-")) : NaN; };

export function describeRules(rows, opts = {}) {
  const R = rows.map((r) => ({ ...r, label: strip(r.label) })), held = R.filter((r) => r.holds === true), failed = R.filter((r) => r.holds === false), na = R.length - held.length - failed.length;
  let s = `${R.length} ${R.length === 1 ? "rule" : "rules"} set in advance: ${held.length} held, ${failed.length} failed${na ? `, ${na} not testable` : ""}.`;
  if (failed.length && failed.length <= 3) s += ` Failed: ${failed.map((r) => `${r.label}, ${outcome(r)}`).join("; ")}.`;
  else if (failed.length) s += ` The first failed rule is ${failed[0].label}.`;
  // the closest call: the rule whose value sits nearest its bar, as a share of the bar
  let close = null;
  for (const r of R) { const v = num(r.left), b = num(r.right); if (Number.isFinite(v) && Number.isFinite(b) && b !== 0) { const m = Math.abs(v - b) / Math.abs(b); if (!close || m < close.m) close = { r, m }; } }
  if (close && R.length > 1) s += ` Closest to its bar: ${close.r.label}, ${strip(close.r.left)} against ${strip(close.r.right)}, ${outcome(close.r)}.`;
  return { text: s, facts: { kind: "rules", n: R.length, held: held.length, failed: failed.length, na, failedLabels: failed.map((r) => r.label) } };
}

export function checkRules(text, facts) {
  const t = String(text || ""), errs = [];
  if (!t.includes(`${facts.n} rule`)) errs.push(`does not say how many rules there are (${facts.n})`);
  if (!t.includes(`${facts.held} held`)) errs.push(`does not say how many held (${facts.held})`);
  if (!t.includes(`${facts.failed} failed`)) errs.push(`does not say how many failed (${facts.failed})`);
  if (facts.failed <= 3) for (const l of facts.failedLabels) if (!t.includes(l)) errs.push(`does not name the failed rule ${l}`);
  return errs;
}
