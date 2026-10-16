// Fill lesson A27's numbers ("Dynamic programming: remember what you already
// worked out") so no number in the film or lab is typed by hand. Writes
// media/school/editdistance/facts.json.
//
//   node tools/school/fill_editdistance.mjs [media/school/editdistance]
//
// Distances, call counts and cell counts are exact and the same on every
// machine; wall times are this machine only. No GPU. One process at
// below-normal priority.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority, cpus, platform } from "node:os";
import { table, traceback, naive, naiveCalls, memo, greedy, bfsDistance, CLASSIC, SENTENCES, OP_NAMES } from "../../system/school/editdistance.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";
import { round, deep } from "./fill_gaming_report.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const outDir = process.argv[2] || "media/school/editdistance", NAIVE_MAX_LEN = 9, NAIVE_BUDGET_MS = 2000, cost = {};
const timed = (k, f) => { const t = performance.now(), v = f(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const PAIRS = [...CLASSIC.map((p) => ({ a: p.a, b: p.b, known: p.known, group: "classic" })), ...SENTENCES.map(([a, b]) => ({ a, b, known: null, group: "sentence" }))];
const randomWord = (r, len, abc) => Array.from({ length: len }, () => abc[Math.floor(r() * abc.length)]).join("");

function sourcesBlock() {
  return {
    about: "What the sources are cited for and how far each was checked. Every distance and count in the other blocks is this lesson's own computation (system/school/editdistance.mjs), checked by four methods that must agree; none of it depends on trusting a citation.",
    wagnerFischer1974: { cite: "Robert A. Wagner and Michael J. Fischer, The String-to-String Correction Problem, Journal of the ACM 21(1):168-173, January 1974, doi:10.1145/321796.321811",
      read: "Bibliographic record and abstract read from Crossref (api.crossref.org) on 2026-10-16: title, authors, volume 21, issue 1, pages 168-173, January 1974 all match. The abstract states the edit operations (change one symbol, delete one, insert one), the distance as the minimum-cost sequence of them, and an algorithm in time proportional to the product of the two lengths. The full paper is behind the ACM paywall (dl.acm.org returned 403) and was not read, so the table's exact layout in the paper is unverified.", citedFor: ["the dynamic-programming table for edit distance and its cost, (m + 1)(n + 1) cells"] },
    bellman1957: { cite: "Richard Bellman, Dynamic Programming, Princeton University Press, Princeton, N.J., 1957",
      read: "Not read. The publisher, place, year and extent (xxv + 342 pages) were checked against Preston C. Hammer's review in Science 127(3304), 1958 (Crossref record doi:10.1126/science.127.3304.976.a). The wording, chapter and page of the principle of optimality are unverified.", citedFor: ["the principle that an optimal solution is built from optimal solutions to its subproblems, which is why D[i][j] needs only its three neighbours"] },
    jurafskyMartin: { cite: "Daniel Jurafsky and James H. Martin, Speech and Language Processing, third edition draft of 19 August 2026, chapter 2, section 2.9 Minimum Edit Distance",
      read: "Read on 2026-10-16 (web.stanford.edu/~jurafsky/slp3/2.pdf). Section 2.9 gives intention to execution as 5 with every operation costing 1 (Levenshtein, 1966), and 8 when a substitution costs 2; it says the algorithm was named by Wagner and Fischer (1974) but independently discovered by many people, and that the intention and execution example was adapted from Kruskal (1983). Its worked table (Figure 2.20) uses substitution cost 2; this lesson uses cost 1.", citedFor: ["intention to execution = 5 with unit costs", "storing a back-pointer per cell and tracing back to get an alignment"] },
    kittenSitting: { cite: "kitten to sitting = 3, a widely used example with no single primary source found", read: "Not attributed. The value is checked here by breadth-first search over single edits, which does not use the recurrence." },
  };
}

function pairsBlock() {
  const rows = PAIRS.map(({ a, b, known, group }) => {
    const t = timed("table", () => table(a, b)), tb = traceback(t, a, b), m = timed("memo", () => memo(a, b)), small = a.length <= NAIVE_MAX_LEN && b.length <= NAIVE_MAX_LEN;
    const nv = small ? timed("naive", () => naive(a, b)) : null, counts = Object.fromEntries(["match", "substitute", "delete", "insert"].map((o) => [o, tb.ops.filter((x) => x.op === o).length]));
    return { group, a, b, lengths: [a.length, b.length], distance: t.distance, known, cells: t.cells, naive: nv ? nv.distance : null, naiveCallsRun: nv ? nv.calls : null, naiveCallsByRecurrence: naiveCalls(a.length, b.length), memo: m.distance, memoComputed: m.computed, memoCalls: m.calls, greedy: greedy(a, b), alignment: { top: tb.top, bottom: tb.bottom, marks: tb.marks }, ops: counts };
  });
  return { about: `Every pair: the table's distance, its cell count (m + 1)(n + 1), the memoised recursion's distance, cells computed and total calls (including answers taken from memory), and the naive recursion's distance and calls when both strings have at most ${NAIVE_MAX_LEN} letters (null above that). naiveCallsByRecurrence is the naive call count from T(i, 0) = T(0, j) = 1, T(i, j) = 1 + T(i-1, j) + T(i, j-1) + T(i-1, j-1), for every pair, run or not. alignment: one optimal alignment from the traceback (ties go to the diagonal, then delete, then insert), '-' for a gap, marks s, d, i for substitute, delete, insert. greedy: the control's (wrong) answer.`, rows };
}

function naiveBlock() {
  const [A, B] = SENTENCES[5], rows = [];
  let stopped = null;
  for (let L = 1; L <= Math.min(A.length, B.length); L++) {
    const a = A.slice(0, L), b = B.slice(0, L), t = performance.now(), nv = naive(a, b), ms = performance.now() - t, me = memo(a, b);
    cost.naive = (cost.naive ?? 0) + ms;
    rows.push({ length: L, a, b, calls: nv.calls, recurrence: naiveCalls(L, L), ms, distance: nv.distance, tableDistance: table(a, b).distance, memoComputed: me.computed, memoCalls: me.calls, cells: (L + 1) ** 2 });
    if (ms > NAIVE_BUDGET_MS) { stopped = { atLength: L, reason: `one naive run at length ${L} took ${round(ms, 0)} ms, over the ${NAIVE_BUDGET_MS} ms budget` }; break; }
  }
  const last = rows.at(-1).length, predicted = [1, 2, 3, 4].map((k) => ({ length: last + k, calls: naiveCalls(last + k, last + k) }));
  const ratios = rows.slice(1).map((r, i) => r.calls / rows[i].calls);
  return { about: `The naive recursion on growing prefixes of "${A}" and "${B}" (equal lengths L), against the memoised recursion and the table. calls: counted while running; recurrence: from the recurrence without running (must be equal). The run stops when one length takes over ${NAIVE_BUDGET_MS} ms on this machine; predicted gives the calls for the next lengths from the recurrence alone. growth: calls(L + 1) / calls(L), measured.`, rows, stoppedAt: stopped, predicted, growth: ratios,
    verdict: `Length ${last}: the naive recursion made ${rows.at(-1).calls} calls in ${round(rows.at(-1).ms, 0)} ms; the memoised one worked out ${rows.at(-1).memoComputed} cells (${rows.at(-1).memoCalls} calls), the table fills ${rows.at(-1).cells}. Each extra letter multiplied the naive calls by ${round(ratios.at(-1), 2)} at the end of the run. Length ${predicted.at(-1).length} would take ${predicted.at(-1).calls} calls.` };
}

function checksBlock(pairs) {
  const r = rng(4), random = [];
  let agree = 0, symmetric = 0;
  for (let t = 0; t < 300; t++) {
    const a = randomWord(r, Math.floor(r() * 5), "abc"), b = randomWord(r, Math.floor(r() * 5), "abc"), d = table(a, b).distance, s = timed("bfs", () => bfsDistance(a, b));
    if (d === s) agree++;
    if (d === table(b, a).distance) symmetric++;
    if (t < 12) random.push({ a, b, table: d, bfs: s });
  }
  const classicBfs = ["kitten", "sitting"], halve = ["halve", "half"];
  const four = pairs.rows.filter((x) => x.naive !== null).map((x) => ({ a: x.a, b: x.b, table: x.distance, naive: x.naive, memo: x.memo, bfs: x.a.length <= 7 ? bfsDistance(x.a, x.b) : null, allAgree: x.distance === x.naive && x.distance === x.memo }));
  return { about: "Independent checks. random: 300 random pairs over the letters a, b, c with 0 to 4 letters each (seed 4): the table against breadth-first search over single edits (which never uses the recurrence), and the table against itself with the strings swapped. four: the pairs short enough for the naive recursion, with all four methods (search over edits only up to 7 letters; for intention and execution it is too slow, so that pair rests on the naive recursion, which is the definition, and on the published value 5). known: the published values.",
    random: { pairs: 300, tableEqualsSearch: agree, symmetric, sample: random }, four,
    bfs: { kittenSitting: bfsDistance(...classicBfs), halveHalf: bfsDistance(...halve) },
    known: pairs.rows.filter((x) => x.known !== null).map((x) => ({ a: x.a, b: x.b, known: x.known, table: x.distance, matches: x.known === x.distance })) };
}

function controlsBlock(pairs) {
  const r = rng(9), N = 1000;
  let above = 0, below = 0, sumExcess = 0;
  for (let t = 0; t < N; t++) { const a = randomWord(r, 6 + Math.floor(r() * 3), "abcd"), b = randomWord(r, 6 + Math.floor(r() * 3), "abcd"), g = greedy(a, b), d = table(a, b).distance; if (g > d) above++; if (g < d) below++; sumExcess += g - d; }
  const rows = pairs.rows.map((x) => ({ a: x.a, b: x.b, distance: x.distance, greedy: x.greedy, wrong: x.greedy !== x.distance }));
  return { about: "Control: a greedy matcher that walks both strings left to right, passes equal letters, substitutes unequal ones and inserts or deletes whatever is left at the end. It never looks back, so one early insertion shifts every later letter out of line. It is a valid edit script, so it can never be below the true distance. rows: every lesson pair; random: 1,000 random pairs of 6 to 8 letters over a, b, c, d (seed 9).", greedy: { rows, wrong: rows.filter((x) => x.wrong).length, pairs: rows.length },
    random: { pairs: N, greedyAbove: above, greedyBelow: below, meanExcess: sumExcess / N },
    verdict: `Greedy is wrong on ${rows.filter((x) => x.wrong).length} of ${rows.length} lesson pairs (right on both classic pairs, ${rows.filter((x) => x.wrong && SENTENCES.some(([a, b]) => a === x.a && b === x.b)).length} of ${SENTENCES.length} sentence pairs wrong) and too high on ${above} of ${N} random pairs; it was never below the true distance (${below} times).` };
}

function median(f, reps) { const xs = []; for (let i = 0; i < reps; i++) { const t = performance.now(); f(); xs.push(performance.now() - t); } xs.sort((a, b) => a - b); return xs[reps >> 1]; }

function timingBlock() {
  const rows = PAIRS.map(({ a, b }) => ({ a, b, tableMs: median(() => { for (let i = 0; i < 100; i++) table(a, b); }, 5) / 100, memoMs: median(() => { for (let i = 0; i < 100; i++) memo(a, b); }, 5) / 100, naiveMs: a.length <= NAIVE_MAX_LEN && b.length <= NAIVE_MAX_LEN ? median(() => naive(a, b), 3) : null }));
  return { about: `Wall time in Node ${process.version} on this machine only (${cpus()[0]?.model ?? "unknown CPU"}, ${platform()}), one process at below-normal priority, median of 3 or 5 runs, in milliseconds per call (table and memo averaged over 100 calls). Another machine gives other times; the call and cell counts do not change.`, rows };
}

function filmBlock(pairs) {
  const grid = (a, b) => { const t = table(a, b), w = b.length + 1; return { a, b, distance: t.distance, D: Array.from({ length: a.length + 1 }, (_, i) => Array.from(t.D.slice(i * w, (i + 1) * w))), choice: Array.from({ length: a.length + 1 }, (_, i) => Array.from(t.choice.slice(i * w, (i + 1) * w), (c) => OP_NAMES[c])), alignment: traceback(t, a, b) }; };
  const nv = pairs.rows.filter((x) => x.naive !== null);
  return { about: "What the film draws (the tide tables: work each entry out once, then read it back). tables: the full table D and the choice per cell for kitten and sitting, intention and execution, and one of the guides' sentence pairs, with the traceback's alignment. effort: for the pairs the naive recursion ran on, its calls against the table's cells.", tables: [grid("kitten", "sitting"), grid("intention", "execution"), grid(...SENTENCES[1])], effort: nv.map((x) => ({ a: x.a, b: x.b, naiveCalls: x.naiveCallsRun, cells: x.cells })) };
}

function main() {
  const t0 = Date.now(), pairs = pairsBlock();
  const blocks = { sources: sourcesBlock(), pairs, naive: naiveBlock(), checks: checksBlock(pairs), controls: controlsBlock(pairs), timing: timingBlock(), film: filmBlock(pairs) };
  blocks.table = { about: "The table's cost: (m + 1)(n + 1) cells, each from three neighbours, for every lesson pair; the memoised recursion works out the same number of cells (when both strings have letters) and the step form takes one step per cell (editdistance.test.mjs).", rows: pairs.rows.map((x) => ({ a: x.a, b: x.b, cells: x.cells, memoComputed: x.memoComputed, equal: x.cells === x.memoComputed })) };
  blocks.cost = { about: "Milliseconds this fill spent in each part (this machine only), and the fill's wall time in seconds.", totals: { ...cost }, fillSeconds: (Date.now() - t0) / 1000 };
  const facts = { about: "Lesson A27, Dynamic programming: remember what you already worked out. Computed by tools/school/fill_editdistance.mjs from system/school/editdistance.mjs. Do not edit by hand. Levenshtein distance with unit costs (insert, delete, substitute each 1). Distances, call counts and cell counts are exact; wall times are this machine only. No GPU.",
    sourceSha256: { "editdistance.mjs": createHash("sha256").update(readFileSync(new URL("../../system/school/editdistance.mjs", import.meta.url))).digest("hex") },
    recipe: { naiveMaxLength: NAIVE_MAX_LEN, naiveBudgetMs: NAIVE_BUDGET_MS, randomSeeds: { bfsCheck: 4, greedyControl: 9 } }, ...deep(blocks), seconds: 0 };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ pairs: facts.pairs.rows.map((x) => [x.a, x.b, x.distance, x.greedy, x.naiveCallsRun, x.cells]), naive: facts.naive.verdict, stopped: facts.naive.stoppedAt, checks: { random: facts.checks.random.tableEqualsSearch, symmetric: facts.checks.random.symmetric, bfs: facts.checks.bfs }, controls: facts.controls.verdict, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_editdistance failed:", e); process.exit(1); }
