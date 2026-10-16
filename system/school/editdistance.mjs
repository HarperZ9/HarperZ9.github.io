// Lesson A27, "Dynamic programming: remember what you already worked out".
// Pure ES module, no DOM and no dependencies: the lab page, a worker and the
// Node fill script share it.
//
// Levenshtein distance with unit costs (insert 1, delete 1, substitute 1, a
// match 0), computed four ways that must agree:
//   table / tableSteps   the Wagner and Fischer (1974) table: D[i][j] is the
//                        distance between the first i letters of a and the
//                        first j of b; one cell at a time, row by row.
//   naive                the recursion straight from the definition, no
//                        memory; it counts its calls.
//   memo                 the same recursion that remembers each answer; it
//                        counts the cells it computes ((m+1)(n+1)
//                        when both strings are non-empty; one when either is empty).
//   bfs                  breadth-first search over single edits (in
//                        editdistance.test.mjs and the fill): an independent
//                        check that does not use the recurrence at all.
// The greedy matcher is a control: a plausible shortcut that is wrong.

export const OPS = Object.freeze({ START: 0, MATCH: 1, SUB: 2, DEL: 3, INS: 4 });
export const OP_NAMES = Object.freeze(["start", "match", "substitute", "delete", "insert"]);

// The choice for cell (i, j) given its three neighbours; ties go to the
// diagonal, then delete, then insert (a fixed order so traceback is repeatable).
function choose(D, w, a, b, i, j) {
  if (i === 0 && j === 0) return [0, OPS.START];
  if (i === 0) return [D[j - 1] + 1, OPS.INS];
  if (j === 0) return [D[(i - 1) * w] + 1, OPS.DEL];
  const same = a[i - 1] === b[j - 1], diag = D[(i - 1) * w + j - 1] + (same ? 0 : 1), up = D[(i - 1) * w + j] + 1, left = D[i * w + j - 1] + 1;
  if (diag <= up && diag <= left) return [diag, same ? OPS.MATCH : OPS.SUB];
  return up <= left ? [up, OPS.DEL] : [left, OPS.INS];
}

// One-cell-at-a-time form: state.D and state.choice are (m+1) x (n+1) row-major
// arrays, -1 where not yet filled; state.i, state.j the cell just filled.
export function tableSteps(a, b) {
  const m = a.length, n = b.length, w = n + 1, cells = (m + 1) * w;
  const state = { a, b, m, n, D: new Int32Array(cells).fill(-1), choice: new Int8Array(cells).fill(-1), i: -1, j: -1, filled: 0, cells, distance: null, done: cells === 0 };
  const step = () => {
    if (state.done) return state;
    const k = state.filled, i = Math.floor(k / w), j = k % w, [v, op] = choose(state.D, w, a, b, i, j);
    state.D[k] = v; state.choice[k] = op; state.i = i; state.j = j; state.filled++;
    if (state.filled === cells) { state.done = true; state.distance = v; }
    return state;
  };
  const run = () => { while (!state.done) step(); return state; };
  return { state, step, run };
}

export function table(a, b) {
  const s = tableSteps(a, b).run();
  return { distance: s.distance, D: s.D, choice: s.choice, cells: s.cells, m: s.m, n: s.n };
}

export const distance = (a, b) => table(a, b).distance;

// One optimal alignment by walking the recorded choices back from (m, n).
export function traceback(t, a, b) {
  const w = t.n + 1, ops = [];
  let i = t.m, j = t.n;
  while (i > 0 || j > 0) {
    const op = t.choice[i * w + j];
    if (op === OPS.MATCH || op === OPS.SUB) { ops.push({ op: OP_NAMES[op], i: i - 1, j: j - 1, from: a[i - 1], to: b[j - 1] }); i--; j--; }
    else if (op === OPS.DEL) { ops.push({ op: "delete", i: i - 1, j, from: a[i - 1], to: "" }); i--; }
    else { ops.push({ op: "insert", i, j: j - 1, from: "", to: b[j - 1] }); j--; }
  }
  ops.reverse();
  const top = ops.map((o) => o.from || "-").join(""), bottom = ops.map((o) => o.to || "-").join(""), marks = ops.map((o) => ({ match: " ", substitute: "s", delete: "d", insert: "i" })[o.op]).join("");
  return { ops, top, bottom, marks, cost: ops.filter((o) => o.op !== "match").length };
}

// The recursion from the definition, with no memory. Every non-border call
// makes all three sub-calls (no shortcut on a match), so the call count obeys
// T(i, 0) = T(0, j) = 1 and T(i, j) = 1 + T(i-1, j) + T(i, j-1) + T(i-1, j-1).
export function naive(a, b) {
  let calls = 0;
  const lev = (i, j) => {
    calls++;
    if (i === 0) return j;
    if (j === 0) return i;
    return Math.min(lev(i - 1, j) + 1, lev(i, j - 1) + 1, lev(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1));
  };
  const d = lev(a.length, b.length);
  return { distance: d, calls };
}

// The call count of naive, from its recurrence, without running it.
export function naiveCalls(m, n) {
  const T = Array.from({ length: m + 1 }, () => new Float64Array(n + 1).fill(1));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) T[i][j] = 1 + T[i - 1][j] + T[i][j - 1] + T[i - 1][j - 1];
  return T[m][n];
}

// The same recursion with memory: computed counts cache misses (cells worked
// out), calls counts every call including the ones answered from memory.
export function memo(a, b) {
  const w = b.length + 1, seen = new Int32Array((a.length + 1) * w).fill(-1);
  let calls = 0, computed = 0;
  const lev = (i, j) => {
    calls++;
    const k = i * w + j;
    if (seen[k] >= 0) return seen[k];
    computed++;
    const v = i === 0 ? j : j === 0 ? i : Math.min(lev(i - 1, j) + 1, lev(i, j - 1) + 1, lev(i - 1, j - 1) + (a[i - 1] === b[j - 1] ? 0 : 1));
    seen[k] = v;
    return v;
  };
  const d = lev(a.length, b.length);
  return { distance: d, calls, computed };
}

// Control: walk both strings left to right; equal letters pass, unequal ones
// are substituted, and whatever is left over is inserted or deleted. It is a
// valid edit script, so it is never below the true distance, and one early
// insertion shifts everything after it, so it is often above.
export function greedy(a, b) {
  const k = Math.min(a.length, b.length);
  let cost = Math.abs(a.length - b.length);
  for (let i = 0; i < k; i++) if (a[i] !== b[i]) cost++;
  return cost;
}

// Independent check: the fewest single edits from a to b, found by breadth-first
// search over strings. Inserted and substituted letters come from the letters
// of a and b (any other letter can never help). Only for short strings.
export function bfsDistance(a, b, limit = 2e6) {
  if (a === b) return 0;
  const letters = [...new Set(a + b)], seen = new Set([a]);
  let frontier = [a];
  for (let d = 1; frontier.length; d++) {
    const next = [];
    for (const s of frontier) {
      const out = [];
      for (let i = 0; i <= s.length; i++) for (const c of letters) out.push(s.slice(0, i) + c + s.slice(i));
      for (let i = 0; i < s.length; i++) { out.push(s.slice(0, i) + s.slice(i + 1)); for (const c of letters) if (c !== s[i]) out.push(s.slice(0, i) + c + s.slice(i + 1)); }
      for (const t of out) { if (t === b) return d; if (!seen.has(t)) { seen.add(t); next.push(t); } }
      if (seen.size > limit) return null;
    }
    frontier = next;
  }
  return null;
}

// Pairs for the lesson: two classic pairs with known distances and short
// sentences the guides might say (each under 40 characters).
export const CLASSIC = Object.freeze([
  { a: "kitten", b: "sitting", known: 3, source: "widely used example; checked here by search over edits" },
  { a: "intention", b: "execution", known: 5, source: "Jurafsky and Martin, Speech and Language Processing, section 2.9 (unit costs; 8 when a substitution costs 2)" },
]);
export const SENTENCES = Object.freeze([
  ["check the tide table first", "check the tide tables first"],
  ["halve the beach", "half the beach"],
  ["knock on every shell", "knock on each shell"],
  ["low tide is at noon", "the low tide is at noon"],
  ["write it down once", "write it down, once"],
  ["remember what you worked out", "remember what we worked out"],
]);
