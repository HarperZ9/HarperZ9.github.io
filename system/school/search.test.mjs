// Tests for lesson A26, "Search and sorting: the cost of looking".
// Run: node --test system/school/search.test.mjs
// Each closed form is checked exactly where it should hold, the step forms
// must reach the direct functions' results, and the control must fail.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { setPriority } from "node:os";
import { KINDS, makeInput, linearSearch, binarySearch, insertionSort, mergeSort, inversions, isSorted, CLOSED, mergeWorstInput } from "./search.mjs";
import { STEPS, linearSteps, binarySteps, insertionSteps, mergeSteps } from "./search-steps.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const FACTS_URL = new URL("../../media/school/search/facts.json", import.meta.url);
const POW = [8, 16, 32, 64, 128, 256, 512, 1024];
const sortedCopy = (a) => Int32Array.from(a).sort();

test("inputs are seeded: same seed same input, random is a permutation, few has at most 4 values", () => {
  assert.deepEqual(makeInput("random", 100, 3), makeInput("random", 100, 3));
  assert.notDeepEqual(makeInput("random", 100, 3), makeInput("random", 100, 4));
  assert.deepEqual(sortedCopy(makeInput("random", 100, 3)), makeInput("sorted", 100));
  assert.ok(new Set(makeInput("few", 1000, 2)).size <= 4);
  assert.deepEqual(Array.from(makeInput("reversed", 4)), [3, 2, 1, 0]);
  assert.throws(() => makeInput("nope", 4));
});

test("binary search: every successful search takes at most floor(log2 n) + 1 comparisons, the bound is reached, and the average is exact", () => {
  for (const n of [...POW, 1, 2, 3, 5, 7, 100, 1000, 4097]) {
    const a = makeInput("sorted", n);
    let max = 0, sum = 0;
    for (let k = 0; k < n; k++) { const r = binarySearch(a, k); assert.equal(r.index, k); max = Math.max(max, r.comparisons); sum += r.comparisons; }
    assert.equal(max, CLOSED.binaryMax(n), `max at n ${n}`);
    assert.ok(Math.abs(sum / n - CLOSED.binaryAvg(n)) < 1e-12, `average at n ${n}: ${sum / n} against ${CLOSED.binaryAvg(n)}`);
  }
});

test("linear search: k + 1 comparisons for the key at place k, n for a missing key, average (n + 1) / 2", () => {
  const a = makeInput("random", 257, 9);
  let sum = 0;
  for (let k = 0; k < 257; k++) { const r = linearSearch(a, k); assert.equal(a[r.index], k); assert.equal(r.comparisons, r.index + 1); sum += r.comparisons; }
  assert.equal(sum / 257, CLOSED.linearAvg(257));
  assert.deepEqual(linearSearch(a, 999), { index: -1, comparisons: 257 });
});

test("insertion sort: n(n-1)/2 comparisons on reversed input, n - 1 on sorted, shifts equal inversions on every kind", () => {
  for (const n of POW) {
    assert.equal(insertionSort(makeInput("reversed", n)).comparisons, CLOSED.insertionWorst(n));
    assert.equal(insertionSort(makeInput("sorted", n)).comparisons, CLOSED.insertionBest(n));
    assert.equal(insertionSort(makeInput("sorted", n)).moves, 0);
    for (const kind of KINDS) {
      const a = makeInput(kind, n, n), r = insertionSort(a);
      assert.ok(isSorted(r.sorted) && r.comparisons >= CLOSED.insertionBest(n) && r.comparisons <= CLOSED.insertionWorst(n));
      assert.equal(r.shifts, inversions(a), `${kind} ${n}`);
    }
  }
});

test("merge sort, n a power of two: (n/2) log2 n on sorted input, n log2 n - n + 1 on the worst input, every input in between, n log2 n moves", () => {
  for (const n of [...POW, 4096]) {
    assert.equal(mergeSort(makeInput("sorted", n)).comparisons, CLOSED.mergeBest(n));
    assert.equal(mergeSort(makeInput("reversed", n)).comparisons, CLOSED.mergeBest(n), "reversed also stops each merge after one run");
    assert.equal(mergeSort(mergeWorstInput(n)).comparisons, CLOSED.mergeWorst(n));
    for (const kind of KINDS) for (const seed of [1, 2, 3]) {
      const r = mergeSort(makeInput(kind, n, seed));
      assert.ok(isSorted(r.sorted));
      assert.deepEqual(r.sorted, sortedCopy(makeInput(kind, n, seed)));
      assert.ok(r.comparisons >= CLOSED.mergeBest(n) && r.comparisons <= CLOSED.mergeWorst(n), `${kind} ${n}`);
      assert.equal(r.moves, CLOSED.mergeMoves(n));
    }
  }
});

test("step forms reach the direct functions' results and counts, one comparison per step", () => {
  for (const kind of KINDS) for (const n of [1, 2, 7, 64, 100]) {
    const a = makeInput(kind, n, 5), ins = insertionSort(a), mer = mergeSort(a);
    const si = insertionSteps(a), sm = mergeSteps(a);
    let steps = 0;
    while (!si.state.done) { si.step(); steps++; }
    assert.deepEqual(si.state.a, ins.sorted);
    assert.deepEqual([si.state.comparisons, si.state.moves, si.state.shifts], [ins.comparisons, ins.moves, ins.shifts]);
    assert.ok(steps >= ins.comparisons && steps <= ins.comparisons + 1);
    sm.run();
    assert.deepEqual(sm.state.a, mer.sorted);
    assert.deepEqual([sm.state.comparisons, sm.state.moves], [mer.comparisons, mer.moves]);
  }
  const s = makeInput("sorted", 1000);
  for (const key of [0, 1, 499, 999, 1000, -3]) {
    const b = binarySteps(s, key).run(), l = linearSteps(s, key).run();
    assert.deepEqual([b.index, b.comparisons], [binarySearch(s, key).index, binarySearch(s, key).comparisons]);
    assert.deepEqual([l.index, l.comparisons], [linearSearch(s, key).index, linearSearch(s, key).comparisons]);
  }
  assert.deepEqual(Object.keys(STEPS), ["linear", "binary", "insertion", "merge"]);
});

test("control: binary search on unsorted input returns wrong answers, while linear search on the same input is always right", () => {
  for (const n of [64, 1024]) {
    const a = makeInput("random", n, 7);
    let wrong = 0;
    for (let k = 0; k < n; k++) {
      const r = binarySearch(a, k);
      if (r.index === -1 || a[r.index] !== k) wrong++;
      assert.ok(r.comparisons <= CLOSED.binaryMax(n), "still few comparisons");
      assert.equal(a[linearSearch(a, k).index], k);
    }
    assert.ok(wrong > n / 2, `binary search misses ${wrong} of ${n} keys present in unsorted input`);
  }
});

test("facts.json, when present, carries every block and agrees with the code", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  for (const sec of ["sources", "inputs", "search", "sorting", "closedForms", "steps", "controls", "timing", "film"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(f.closedForms.rows.every((r) => r.holds), "every closed form holds");
  assert.ok(f.controls.unsortedBinary.rows.every((r) => r.wrong > 0));
});
