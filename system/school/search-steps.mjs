// Step-by-step forms of lesson A26's searches and sorts, for a lab that
// animates in slices and a film that draws states. Each maker returns
// { state, step(), run() }: step() does one comparison (and the moves that
// follow it) and returns state; state.done is true once the work is over.
// The counting conventions are those of search.mjs, and search.test.mjs checks
// that every form reaches the direct function's result and counts.

function stepper(state, gen) {
  const it = gen(state);
  const step = () => { if (!state.done) { const r = it.next(); if (r.done) state.done = true; } return state; };
  const run = () => { while (!state.done) step(); return state; };
  return { state, step, run };
}

export function linearSteps(a, key) {
  const state = { kind: "linear", a: Int32Array.from(a), key, i: -1, comparisons: 0, index: -1, done: false };
  return stepper(state, function* (s) {
    for (let i = 0; i < s.a.length; i++) {
      s.i = i; s.comparisons++;
      if (s.a[i] === s.key) { s.index = i; return; }
      yield;
    }
  });
}

export function binarySteps(a, key) {
  const state = { kind: "binary", a: Int32Array.from(a), key, lo: 0, hi: a.length - 1, mid: -1, comparisons: 0, index: -1, done: false };
  return stepper(state, function* (s) {
    while (s.lo <= s.hi) {
      s.mid = (s.lo + s.hi) >>> 1; s.comparisons++;
      if (s.a[s.mid] === s.key) { s.index = s.mid; return; }
      if (s.a[s.mid] < s.key) s.lo = s.mid + 1; else s.hi = s.mid - 1;
      yield;
    }
  });
}

export function insertionSteps(input) {
  const state = { kind: "insertion", a: Int32Array.from(input), i: 0, j: -1, key: null, comparisons: 0, moves: 0, shifts: 0, done: false };
  return stepper(state, function* (s) {
    const a = s.a;
    for (let i = 1; i < a.length; i++) {
      const key = a[i];
      let j = i - 1;
      s.i = i; s.key = key;
      while (j >= 0) {
        s.j = j; s.comparisons++;
        const stop = a[j] <= key;
        if (!stop) { a[j + 1] = a[j]; s.shifts++; s.moves++; j--; }
        yield;
        if (stop) break;
      }
      if (j + 1 !== i) { a[j + 1] = key; s.moves++; }
    }
  });
}

// Merge sort without recursion in the generator: the same top-down split
// order, written as an explicit list of merges (lo, mid, hi) in the order the
// recursive version performs them.
export function mergeOrder(n) {
  const out = [];
  const walk = (lo, hi) => { if (hi - lo < 2) return; const mid = lo + ((hi - lo) >>> 1); walk(lo, mid); walk(mid, hi); out.push([lo, mid, hi]); };
  walk(0, n);
  return out;
}

export function mergeSteps(input) {
  const state = { kind: "merge", a: Int32Array.from(input), lo: 0, mid: 0, hi: 0, i: -1, j: -1, k: -1, comparisons: 0, moves: 0, done: false };
  return stepper(state, function* (s) {
    const a = s.a, aux = new Int32Array(a.length);
    for (const [lo, mid, hi] of mergeOrder(a.length)) {
      s.lo = lo; s.mid = mid; s.hi = hi;
      for (let k = lo; k < hi; k++) aux[k] = a[k];
      let i = lo, j = mid, k = lo;
      while (i < mid && j < hi) {
        s.i = i; s.j = j; s.k = k; s.comparisons++;
        a[k++] = aux[i] <= aux[j] ? aux[i++] : aux[j++]; s.moves++;
        yield;
      }
      while (i < mid) { a[k++] = aux[i++]; s.moves++; }
      while (j < hi) { a[k++] = aux[j++]; s.moves++; }
    }
  });
}

export const STEPS = Object.freeze({ linear: linearSteps, binary: binarySteps, insertion: insertionSteps, merge: mergeSteps });
