// Tests for lesson A27, "Dynamic programming: remember what you already worked out".
// Run: node --test system/school/editdistance.test.mjs
// The table, the naive recursion, the memoised recursion and a search over
// edits must agree; the greedy control must be wrong on some pair.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { setPriority } from "node:os";
import { table, tableSteps, traceback, naive, naiveCalls, memo, greedy, bfsDistance, distance, CLASSIC, SENTENCES, OPS } from "./editdistance.mjs";
import { rng } from "./tinyformer-ops.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const FACTS_URL = new URL("../../media/school/editdistance/facts.json", import.meta.url);
const randomWord = (r, len, abc = "abc") => Array.from({ length: len }, () => abc[Math.floor(r() * abc.length)]).join("");

// Apply an edit script to a and return the result: an alignment is only right
// if it rebuilds b.
const apply = (ops) => ops.map((o) => o.to).join("");

test("known values: kitten to sitting is 3, intention to execution is 5, and the borders are the lengths", () => {
  for (const p of CLASSIC) assert.equal(distance(p.a, p.b), p.known, `${p.a} ${p.b}`);
  assert.equal(distance("", ""), 0);
  assert.equal(distance("abc", ""), 3);
  assert.equal(distance("", "abcd"), 4);
  assert.equal(distance("same", "same"), 0);
  assert.equal(bfsDistance("kitten", "sitting"), 3, "a search over edits, which never uses the recurrence, agrees");
});

test("the table agrees with search over edits on 300 random short pairs, and is symmetric", () => {
  const r = rng(4);
  for (let t = 0; t < 300; t++) {
    const a = randomWord(r, Math.floor(r() * 5)), b = randomWord(r, Math.floor(r() * 5)), d = distance(a, b);
    assert.equal(d, bfsDistance(a, b), `${a} ${b}`);
    assert.equal(d, distance(b, a));
    assert.ok(d >= Math.abs(a.length - b.length) && d <= Math.max(a.length, b.length));
  }
});

test("naive recursion, memoised recursion and table give the same distance; memo computes exactly the table's cells when both strings are non-empty", () => {
  for (const p of [...CLASSIC, { a: "halve", b: "half" }, { a: "", b: "tide" }]) {
    const t = table(p.a, p.b), nv = naive(p.a, p.b), me = memo(p.a, p.b);
    assert.equal(nv.distance, t.distance);
    assert.equal(me.distance, t.distance);
    assert.equal(me.computed, p.a && p.b ? t.cells : 1, "every cell when both strings have letters; one border cell otherwise");
    assert.equal(t.cells, (p.a.length + 1) * (p.b.length + 1));
    assert.equal(nv.calls, naiveCalls(p.a.length, p.b.length), "the call counter obeys the recurrence");
    assert.ok(nv.calls > me.calls || p.a.length * p.b.length === 0);
  }
  assert.deepEqual([1, 2, 3, 4].map((L) => naiveCalls(L, L)), [4, 19, 94, 481]);
});

test("step form fills one cell per step, in row order, and ends at the direct table", () => {
  for (const [a, b] of [...SENTENCES.slice(0, 3), ["kitten", "sitting"], ["", "ab"]]) {
    const s = tableSteps(a, b), t = table(a, b);
    let steps = 0;
    while (!s.state.done) {
      s.step(); steps++;
      assert.equal(s.state.filled, steps);
      assert.equal(s.state.i * (b.length + 1) + s.state.j, steps - 1);
    }
    assert.equal(steps, t.cells);
    assert.deepEqual(s.state.D, t.D);
    assert.deepEqual(s.state.choice, t.choice);
    assert.equal(s.state.distance, t.distance);
  }
});

test("traceback gives an alignment that rebuilds the second string at exactly the distance", () => {
  const r = rng(8);
  const pairs = [...CLASSIC.map((p) => [p.a, p.b]), ...SENTENCES, ...Array.from({ length: 200 }, () => [randomWord(r, Math.floor(r() * 7)), randomWord(r, Math.floor(r() * 7))])];
  for (const [a, b] of pairs) {
    const t = table(a, b), tb = traceback(t, a, b);
    assert.equal(apply(tb.ops), b);
    assert.equal(tb.ops.map((o) => o.from).join(""), a);
    assert.equal(tb.cost, t.distance);
    assert.equal(tb.top.length, tb.bottom.length);
  }
  assert.equal(table("ab", "ab").choice[0], OPS.START);
});

test("every sentence is under 40 characters", () => {
  for (const [a, b] of SENTENCES) assert.ok(a.length < 40 && b.length < 40);
});

test("control: greedy left-to-right matching is never below the distance and is above it on the guides' sentences", () => {
  let above = 0;
  for (const [a, b] of SENTENCES) {
    const g = greedy(a, b), d = distance(a, b);
    assert.ok(g >= d);
    if (g > d) above++;
  }
  assert.ok(above >= 1, `greedy is wrong on ${above} of ${SENTENCES.length} sentence pairs`);
  const r = rng(2);
  for (let t = 0; t < 500; t++) { const a = randomWord(r, 6), b = randomWord(r, 6); assert.ok(greedy(a, b) >= distance(a, b)); }
});

test("facts.json, when present, carries every block and agrees with the code", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  for (const sec of ["sources", "pairs", "naive", "table", "checks", "controls", "timing", "film"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(f.pairs.rows.every((r) => (r.naive === null || r.distance === r.naive) && r.distance === r.memo && r.memoComputed === r.cells));
  assert.ok(f.controls.greedy.wrong >= 1);
  assert.ok(f.naive.rows.every((r) => r.calls === r.recurrence && r.distance === r.tableDistance));
  assert.equal(f.checks.random.tableEqualsSearch, 300);
});
