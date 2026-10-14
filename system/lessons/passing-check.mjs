// "Check the check", the demo beside "A passing check can still be wrong": a tiny function,
// four tests the viewer switches on and off, six deliberate breaks (mutants) and one planted
// failure (the control). Pure: the function, the tests and the mutants are ordinary code here,
// run directly, so what the page reports is what the code does. No DOM, runs in Node.
//
// The function, the tests and the mutants are invented for this demo. The studies the film
// cites are shown beside it, from media/explainers/passing-check/evidence.json:
//   Inozemtseva and Holmes 2014: with suite size controlled, coverage and fault finding were
//     only low to moderately correlated.
//   Just et al. 2014: 73% of real faults were coupled to generated mutants; 17% to none.

export const CODE = [
  "function total(qty, unit) {",
  "  let sum = qty * unit;",
  "  if (qty >= 10) sum = sum * 0.9;   // 10% off for 10 or more",
  "  if (sum > 100) sum = sum - 5;     // 5 off over 100",
  "  return Math.round(sum * 100) / 100;",
  "}",
];

// The right version, written so each statement it runs is recorded: "2" to "5" are the lines as
// shown (1-based), "3+" and "4+" the discounts inside the two ifs. Six statements in all.
function make(variant = {}) {
  const v = { mul: (a, b) => a * b, bulk: (q) => q >= 10, rate: 0.9, over: (s) => s > 100, off: (s) => s - 5, round: (s) => Math.round(s * 100) / 100, ...variant };
  return (qty, unit, hit = new Set()) => {
    hit.add("2"); let sum = v.mul(qty, unit);
    hit.add("3"); if (v.bulk(qty)) { hit.add("3+"); sum = sum * v.rate; }
    hit.add("4"); if (v.over(sum)) { hit.add("4+"); sum = v.off(sum); }
    hit.add("5"); return v.round(sum);
  };
}
export const RIGHT = make();

// Tests: what each one calls, and what it checks. T4 runs every line and checks nothing.
export const TESTS = [
  { id: "t1", name: "one item at 5 costs 5", run: (f, hit) => f(1, 5, hit) === 5 },
  { id: "t2", name: "ten items at 2 cost 18 (the discount starts at 10)", run: (f, hit) => f(10, 2, hit) === 18 },
  { id: "t3", name: "thirty items at 5 cost 130 (both rules)", run: (f, hit) => f(30, 5, hit) === 130 },
  { id: "t4", name: "twelve items at 20: runs, checks nothing", run: (f, hit) => { f(12, 20, hit); return true; } },
];

// Mutants: one small break each, the kind a mutation tool makes.
export const MUTANTS = [
  { id: "m1", line: 3, what: "qty >= 10 became qty > 10", f: make({ bulk: (q) => q > 10 }) },
  { id: "m2", line: 3, what: "0.9 became 0.8", f: make({ rate: 0.8 }) },
  { id: "m3", line: 4, what: "sum > 100 became sum > 1000", f: make({ over: (s) => s > 1000 }) },
  { id: "m4", line: 4, what: "sum - 5 became sum + 5", f: make({ off: (s) => s + 5 }) },
  { id: "m5", line: 5, what: "the rounding was removed", f: make({ round: (s) => s }) },
  { id: "m6", line: 2, what: "qty * unit became qty + unit", f: make({ mul: (a, b) => a + b }) },
];
// The control: an implementation known to be wrong. A suite that passes it cannot fail.
export const CONTROL = { what: "a total() that always returns 0", f: () => 0 };

export const STATEMENTS = ["2", "3", "3+", "4", "4+", "5"];

// Run the chosen tests against one implementation: did every test pass, and which lines ran.
export function runSuite(on, f) {
  const hit = new Set(), results = TESTS.filter((t) => on.includes(t.id)).map((t) => ({ id: t.id, pass: t.run(f, hit) }));
  return { pass: results.every((r) => r.pass), results, hit };
}

// Everything the page shows for a choice of tests.
export function assess(on) {
  const right = runSuite(on, RIGHT);
  const mutants = MUTANTS.map((m) => ({ ...m, caught: on.length > 0 && !runSuite(on, m.f).pass }));
  const control = on.length > 0 && !runSuite(on, CONTROL.f).pass;
  const runnable = STATEMENTS;
  return {
    on, passes: right.pass, coverage: right.hit.size / runnable.length, linesRun: [...right.hit].sort(),
    mutants, caught: mutants.filter((m) => m.caught).length, controlFails: control,
  };
}

// A floating-point case the four tests never try: three items at 0.1. Shows why the surviving
// rounding mutant is a real fault and not a harmless change.
export const ROUNDING_CASE = { args: [3, 0.1], right: RIGHT(3, 0.1), mutant: MUTANTS[4].f(3, 0.1) };
