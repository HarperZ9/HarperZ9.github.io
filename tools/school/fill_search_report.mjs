// Sources and step-trace blocks for lesson A26 ("Search and sorting: the cost
// of looking"), split out of fill_search.mjs to keep each file short.
import { makeInput, insertionSort, mergeSort, binarySearch, linearSearch } from "../../system/school/search.mjs";
import { STEPS } from "../../system/school/search-steps.mjs";

export function sourcesBlock() {
  return {
    about: "What the sources are cited for and how far each was checked. Every count in the other blocks is this lesson's own measurement on its own code (system/school/search.mjs); the closed forms are checked against those counts exactly, which is what makes them trustworthy here, not the citation. Where a source's text could not be read, the entry says so and gives what was checked instead.",
    knuthVol3: {
      cite: "Donald E. Knuth, The Art of Computer Programming, Volume 3: Sorting and Searching, second edition, Addison-Wesley, 1998 (ISBN 0-201-89685-0)",
      read: "Not read: the book is not freely available. Checked: a bookseller's copy of the publisher's table of contents lists 'Sorting by Insertion' (page 80) and 'Sorting by Merging' (page 158) under internal sorting; the 5.2.1 and 5.2.4 numbers are the book's usual numbering and were not seen in that listing. Section 6.2.1 ('Searching an Ordered Table', Algorithm B, binary search) was not seen in any table of contents; the UNIX System III bsearch manual page and the illumos bsearch.c header (seen in web search results, not opened) state they are 'generalized from Knuth (6.2.1) Algorithm B', which confirms the section and algorithm name, not the bound.",
      citedFor: ["5.2.1: straight insertion; the link between the moves it makes and the inversions of the input (unverified wording)", "5.2.4: merge sorting (unverified wording; the worst-case count n log2 n - n + 1 for n a power of two is derived and measured here, not quoted)", "6.2.1: Algorithm B, binary search with three-way comparisons; at most floor(log2 n) + 1 comparisons for a successful search (unverified wording; measured here exactly for every key)"],
    },
    clrs: {
      cite: "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, fourth edition, MIT Press, 2022 (ISBN 978-0-262-04630-5), chapter 2 Getting Started",
      read: "Table of contents checked from a copy of the front matter: 2.1 Insertion sort (page 17), 2.2 Analyzing algorithms (page 25), 2.3 Designing algorithms (page 34, merge sort). The text of the sections was not read for this lesson.",
      citedFor: ["2.1 and 2.2: insertion sort, its best case on sorted input and its worst case on reversed input; the book counts running time in its own cost model, so the exact comparison counts n - 1 and n(n-1)/2 are derived here and checked by the counters, not quoted", "2.3: merge sort by divide and conquer"],
    },
    derived: {
      about: "Closed forms derived for this lesson, each checked exactly against the counters in search.test.mjs and in the closedForms block.",
      forms: ["binary search average over all n successful searches = 1 + ((n + 1) q - 2^(q+1) + 2) / n, q = floor(log2 n): the tree of probes has its leaves on two adjacent levels, so its internal path length is the minimum, sum over k = 1..n of floor(log2 k)", "insertion sort comparisons = inversions + (n - 1) - (keys that travel all the way to the front); on a random permutation of distinct keys the expectation is n(n-1)/4 + n - H_n, H_n the n-th harmonic number", "merge sort with n = 2^k: merging two runs of m takes between m and 2m - 1 comparisons, so the total lies between (n/2) log2 n and n log2 n - n + 1, and every level writes n elements, n log2 n moves"],
    },
  };
}

// A few states of each step form at n = 8 or 16, for the film to draw.
function trace(kind, make, pick) {
  const s = make(), frames = [pick(s.state)];
  while (!s.state.done) { s.step(); frames.push(pick(s.state)); }
  return { kind, steps: frames.length - 1, frames };
}

export function stepsBlock() {
  const sorted16 = makeInput("sorted", 16), rand8 = makeInput("random", 8, 3), rand16 = makeInput("random", 16, 3);
  const bin = trace("binary", () => STEPS.binary(sorted16, 11), (s) => ({ lo: s.lo, hi: s.hi, mid: s.mid, comparisons: s.comparisons, index: s.index }));
  const lin = trace("linear", () => STEPS.linear(rand16, 11), (s) => ({ i: s.i, comparisons: s.comparisons, index: s.index }));
  const ins = trace("insertion", () => STEPS.insertion(rand8), (s) => ({ a: Array.from(s.a), i: s.i, j: s.j, comparisons: s.comparisons, moves: s.moves }));
  const mer = trace("merge", () => STEPS.merge(rand8), (s) => ({ a: Array.from(s.a), lo: s.lo, mid: s.mid, hi: s.hi, comparisons: s.comparisons, moves: s.moves }));
  const agree = { binary: bin.frames.at(-1).index === binarySearch(sorted16, 11).index && bin.frames.at(-1).comparisons === binarySearch(sorted16, 11).comparisons, linear: lin.frames.at(-1).comparisons === linearSearch(rand16, 11).comparisons, insertion: ins.frames.at(-1).comparisons === insertionSort(rand8).comparisons && ins.frames.at(-1).moves === insertionSort(rand8).moves, merge: mer.frames.at(-1).comparisons === mergeSort(rand8).comparisons && mer.frames.at(-1).moves === mergeSort(rand8).moves };
  return { about: "Step forms (system/school/search-steps.mjs): each step() is one comparison and the moves that follow it. Frames record the state before the first step and after each step: binary search for 11 among 0..15 (lo, hi, mid), linear search for 11 in a random order of 0..15 (seed 3), insertion sort and merge sort of a random order of 0..7 (seed 3). agree: the last frame's answer and counts equal the direct function's.", inputs: { sorted16: Array.from(sorted16), random16: Array.from(rand16), random8: Array.from(rand8) }, binary: bin, linear: lin, insertion: ins, merge: mer, agree };
}
