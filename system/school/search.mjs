// Lesson A26, "Search and sorting: the cost of looking". Pure ES module, no DOM
// and no dependencies beyond the shared seeded generator: the lab page, a
// worker and the Node fill script share it.
//
// Counting conventions (every closed form below depends on them):
//   linearSearch   one comparison per element looked at (key === a[i]).
//   binarySearch   one three-way comparison per probe (key against a[mid],
//                  mid = floor((lo + hi) / 2)), counted once even though it
//                  decides less, equal or greater. This is the comparison
//                  model of Knuth's Algorithm B (TAOCP vol. 3, 6.2.1).
//   insertionSort  one comparison per test a[j] > key; moves = elements
//                  shifted one place right plus keys written to a new place.
//                  Shifts alone equal the number of inversions.
//   mergeSort      top-down, split at floor(n / 2); one comparison per
//                  a[i] <= b[j] inside a merge; moves = elements written into
//                  their merged place (the copy back is not counted).
import { rng } from "./tinyformer-ops.mjs";

export const KINDS = Object.freeze(["random", "sorted", "reversed", "few"]);

// Seeded input of n numbers. random: a permutation of 0..n-1 (distinct keys,
// Fisher-Yates); sorted and reversed: 0..n-1 in order and backwards; few: each
// value drawn from 0..3, so most keys repeat.
export function makeInput(kind, n, seed = 1) {
  const a = new Int32Array(n), r = rng(seed);
  if (kind === "few") { for (let i = 0; i < n; i++) a[i] = Math.floor(r() * 4); return a; }
  for (let i = 0; i < n; i++) a[i] = kind === "reversed" ? n - 1 - i : i;
  if (kind === "random") for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
  else if (kind !== "sorted" && kind !== "reversed") throw new Error(`unknown kind ${kind}`);
  return a;
}

export function linearSearch(a, key) {
  for (let i = 0; i < a.length; i++) if (a[i] === key) return { index: i, comparisons: i + 1 };
  return { index: -1, comparisons: a.length };
}

export function binarySearch(a, key) {
  let lo = 0, hi = a.length - 1, comparisons = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    comparisons++;
    if (a[mid] === key) return { index: mid, comparisons };
    if (a[mid] < key) lo = mid + 1; else hi = mid - 1;
  }
  return { index: -1, comparisons };
}

export function insertionSort(input) {
  const a = Int32Array.from(input);
  let comparisons = 0, moves = 0, shifts = 0;
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0) {
      comparisons++;
      if (a[j] <= key) break;
      a[j + 1] = a[j]; shifts++; j--;
    }
    if (j + 1 !== i) { a[j + 1] = key; moves++; }
  }
  return { sorted: a, comparisons, moves: moves + shifts, shifts };
}

function merge(a, aux, lo, mid, hi, c) {
  for (let k = lo; k < hi; k++) aux[k] = a[k];
  let i = lo, j = mid, k = lo;
  while (i < mid && j < hi) { c.comparisons++; a[k++] = aux[i] <= aux[j] ? aux[i++] : aux[j++]; c.moves++; }
  while (i < mid) { a[k++] = aux[i++]; c.moves++; }
  while (j < hi) { a[k++] = aux[j++]; c.moves++; }
}

function sortRange(a, aux, lo, hi, c) {
  if (hi - lo < 2) return;
  const mid = lo + ((hi - lo) >>> 1);
  sortRange(a, aux, lo, mid, c); sortRange(a, aux, mid, hi, c);
  merge(a, aux, lo, mid, hi, c);
}

export function mergeSort(input) {
  const a = Int32Array.from(input), c = { comparisons: 0, moves: 0 };
  sortRange(a, new Int32Array(a.length), 0, a.length, c);
  return { sorted: a, ...c };
}

// Inversions (pairs i < j with a[i] > a[j]) by brute force: an independent
// count that insertion sort's shifts must equal (Knuth 5.2.1 relates the two).
export function inversions(a) {
  let n = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) n++;
  return n;
}

export const isSorted = (a) => { for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) return false; return true; };
export const log2 = (n) => Math.log2(n);
const flog2 = (n) => 31 - Math.clz32(n);

// Closed forms (n >= 1). Each is checked exactly against the counters in
// search.test.mjs and in the fill.
export const CLOSED = Object.freeze({
  // Successful binary search on n sorted distinct keys: at most floor(log2 n) + 1.
  binaryMax: (n) => flog2(n) + 1,
  // Average over all n successful searches: 1 + (internal path length) / n,
  // with the minimum internal path length sum_{k=1..n} floor(log2 k) =
  // (n + 1) q - 2^(q+1) + 2, q = floor(log2 n). Binary search's tree has its
  // leaves on two adjacent levels, so it attains the minimum.
  binaryAvg: (n) => { const q = flog2(n); return 1 + ((n + 1) * q - 2 ** (q + 1) + 2) / n; },
  linearAvg: (n) => (n + 1) / 2,
  insertionWorst: (n) => (n * (n - 1)) / 2,
  insertionBest: (n) => n - 1,
  // Merge sort, n a power of two: sorted input gives (n/2) log2 n, the least;
  // n log2 n - n + 1 is the most (every merge of m + m runs to 2m - 1).
  mergeBest: (n) => (n / 2) * Math.log2(n),
  mergeWorst: (n) => n * Math.log2(n) - n + 1,
  mergeMoves: (n) => n * Math.log2(n),
});

// An input that makes top-down merge sort do its most comparisons: the
// interleaving that makes every merge alternate between its runs.
export function mergeWorstInput(n) {
  const out = new Int32Array(n);
  const fill = (vals, lo) => {
    if (vals.length === 1) { out[lo] = vals[0]; return; }
    const m = vals.length >>> 1, left = [], right = [];
    vals.forEach((v, i) => (i % 2 === 0 ? left : right).push(v));
    fill(left.slice(0, vals.length - m), lo); fill(right.concat(left.slice(vals.length - m)), lo + vals.length - m);
  };
  fill(Array.from({ length: n }, (_, i) => i), 0);
  return out;
}
