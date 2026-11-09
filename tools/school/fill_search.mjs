// Fill lesson A26's numbers ("Search and sorting: the cost of looking") so no
// number in the film or lab is typed by hand. Writes media/school/search/facts.json.
//
//   node tools/school/fill_search.mjs [media/school/search]
//
// Counts come from system/school/search.mjs over seeds 1 to 10. Wall times are
// this machine only. No GPU. One process at below-normal priority.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setPriority, cpus, platform } from "node:os";
import { KINDS, makeInput, linearSearch, binarySearch, insertionSort, mergeSort, inversions, isSorted, CLOSED, mergeWorstInput } from "../../system/school/search.mjs";
import { round, deep } from "./fill_gaming_report.mjs";
import { sourcesBlock, stepsBlock } from "./fill_search_report.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const outDir = process.argv[2] || "media/school/search";
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1), SIZES = Array.from({ length: 14 }, (_, i) => 2 ** (i + 3)), INS_MAX = 65536, LOOKUPS = 200, cost = {};
const timed = (k, f) => { const t = performance.now(), v = f(); cost[k] = (cost[k] ?? 0) + performance.now() - t; return v; };
const spread = (xs) => ({ mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs) });
const harmonic = (n) => { let h = 0; for (let k = 1; k <= n; k++) h += 1 / k; return h; };

function binaryRow(n) {
  const a = Int32Array.from({ length: n }, (_, i) => 2 * i), hit = [], miss = [];
  for (let k = 0; k < n; k++) hit.push(binarySearch(a, 2 * k).comparisons);
  for (let k = -1; k < 2 * n; k += 2) miss.push(binarySearch(a, k).comparisons);
  return { n, successful: { ...spread(hit), searches: n }, unsuccessful: { ...spread(miss), searches: n + 1 }, bound: CLOSED.binaryMax(n), exactAverage: CLOSED.binaryAvg(n) };
}

function linearRow(n) {
  const perSeed = SEEDS.map((s) => { const a = makeInput("random", n, s), r = rng(1000 + s); let sum = 0; for (let t = 0; t < LOOKUPS; t++) sum += linearSearch(a, Math.floor(r() * n)).comparisons; return sum / LOOKUPS; });
  return { n, successful: spread(perSeed), expected: CLOSED.linearAvg(n), missing: linearSearch(makeInput("random", n, 1), -1).comparisons, best: 1, worst: n };
}

function searchBlock() {
  const binary = timed("search", () => SIZES.map(binaryRow)), linear = timed("search", () => SIZES.map(linearRow));
  const last = SIZES.length - 1;
  return { about: `Searching n keys. binary: a sorted array of the even numbers 0, 2, .., 2(n - 1); successful searches for every key (n of them), unsuccessful for every odd gap from -1 to 2n - 1 (n + 1 of them); mean, min and max comparisons (one three-way comparison per probe), against the bound floor(log2 n) + 1 and the exact average 1 + ((n + 1) q - 2^(q+1) + 2) / n. linear: a random order of 0..n-1 for each of seeds ${SEEDS[0]} to ${SEEDS.at(-1)}, ${LOOKUPS} keys drawn at random per seed; mean, min and max are over the per-seed means, against (n + 1) / 2; a missing key always costs n.`, binary, linear,
    verdict: `At n = ${SIZES[last]}: binary search takes at most ${binary[last].successful.max} comparisons (bound ${binary[last].bound}), ${round(binary[last].successful.mean, 3)} on average; linear search takes ${round(linear[last].successful.mean, 1)} on average (seed means ${round(linear[last].successful.min, 1)} to ${round(linear[last].successful.max, 1)}, expected ${linear[last].expected}) and ${linear[last].missing} for a missing key.` };
}

function sortRow(kind, n) {
  const seeds = kind === "random" || kind === "few" ? SEEDS : [1], row = { kind, n, seeds: seeds.length };
  if (n <= INS_MAX) {
    const rs = seeds.map((s) => timed("insertion", () => insertionSort(makeInput(kind, n, s))));
    if (!rs.every((r) => isSorted(r.sorted))) throw new Error(`insertion sort failed ${kind} ${n}`);
    row.insertion = { comparisons: spread(rs.map((r) => r.comparisons)), moves: spread(rs.map((r) => r.moves)) };
  } else row.insertion = null;
  const ms = seeds.map((s) => timed("merge", () => mergeSort(makeInput(kind, n, s))));
  if (!ms.every((r) => isSorted(r.sorted))) throw new Error(`merge sort failed ${kind} ${n}`);
  row.merge = { comparisons: spread(ms.map((r) => r.comparisons)), moves: spread(ms.map((r) => r.moves)) };
  return row;
}

function sortingBlock() {
  const rows = KINDS.flatMap((k) => SIZES.map((n) => sortRow(k, n)));
  const t = performance.now(); insertionSort(makeInput("random", INS_MAX, 1)); const msAtMax = performance.now() - t;
  const g = (k, n) => rows.find((r) => r.kind === k && r.n === n), N = INS_MAX;
  const expectRandom = SIZES.filter((n) => n <= INS_MAX).map((n) => ({ n, measured: g("random", n).insertion.comparisons.mean, expected: (n * (n - 1)) / 4 + n - harmonic(n) }));
  return { about: `Sorting n keys of each kind (random: a permutation of 0..n-1; sorted; reversed; few: values 0 to 3), comparisons and moves as defined in search.mjs. Random and few use seeds ${SEEDS[0]} to ${SEEDS.at(-1)} (mean, min, max over seeds); sorted and reversed are the same for every seed, so one run. Insertion sort runs to n = ${INS_MAX} (no stop was needed: one random run there took ${round(msAtMax, 0)} ms on this machine; its work grows as n^2, so each doubling of n costs about 4 times as much). insertionRandom compares the measured mean on random input with the derived expectation n(n-1)/4 + n - H_n. merge sort runs to n = ${SIZES.at(-1)}.`, insertionStopsAt: INS_MAX, msOneRandomRunAtStop: msAtMax, rows, insertionRandom: expectRandom,
    verdict: `At n = ${N}, random input: insertion sort ${round(g("random", N).insertion.comparisons.mean, 0)} comparisons (expected ${round(expectRandom.at(-1).expected, 0)}), merge sort ${round(g("random", N).merge.comparisons.mean, 0)}. Reversed: insertion ${g("reversed", N).insertion.comparisons.mean} = n(n-1)/2; sorted: ${g("sorted", N).insertion.comparisons.mean} = n - 1. Merge sort at n = ${SIZES.at(-1)}: ${round(g("random", SIZES.at(-1)).merge.comparisons.mean, 0)} comparisons on random input (bounds ${CLOSED.mergeBest(SIZES.at(-1))} and ${CLOSED.mergeWorst(SIZES.at(-1))}).` };
}

function closedBlock(sorting, search) {
  const rows = [], add = (form, n, expected, measured, holds = measured === expected) => rows.push({ form, n, expected, measured, holds });
  for (const r of search.binary) { add("binary search max = floor(log2 n) + 1", r.n, r.bound, r.successful.max); add("binary search average (exact)", r.n, r.exactAverage, r.successful.mean, Math.abs(r.successful.mean - r.exactAverage) < 1e-9); add("binary search, unsuccessful, at most floor(log2 n) + 1", r.n, r.bound, r.unsuccessful.max, r.unsuccessful.max <= r.bound); }
  for (const n of SIZES) {
    const g = (k) => sorting.rows.find((r) => r.kind === k && r.n === n);
    if (n <= INS_MAX) { add("insertion worst = n(n-1)/2 (reversed)", n, CLOSED.insertionWorst(n), g("reversed").insertion.comparisons.mean); add("insertion best = n - 1 (sorted)", n, CLOSED.insertionBest(n), g("sorted").insertion.comparisons.mean); }
    add("merge best = (n/2) log2 n (sorted)", n, CLOSED.mergeBest(n), g("sorted").merge.comparisons.mean);
    add("merge worst = n log2 n - n + 1 (worst input)", n, CLOSED.mergeWorst(n), timed("merge", () => mergeSort(mergeWorstInput(n))).comparisons);
    add("merge moves = n log2 n (random)", n, CLOSED.mergeMoves(n), g("random").merge.moves.max, g("random").merge.moves.min === CLOSED.mergeMoves(n) && g("random").merge.moves.max === CLOSED.mergeMoves(n));
    const rnd = [g("random").merge.comparisons, g("few").merge.comparisons];
    add("merge random and few within [best, worst]", n, [CLOSED.mergeBest(n), CLOSED.mergeWorst(n)], [Math.min(...rnd.map((x) => x.min)), Math.max(...rnd.map((x) => x.max))], rnd.every((x) => x.min >= CLOSED.mergeBest(n) && x.max <= CLOSED.mergeWorst(n)));
  }
  for (const n of [8, 64, 512, 4096]) for (const kind of ["random", "few"]) { const a = makeInput(kind, n, 1); add(`insertion shifts = inversions (${kind})`, n, inversions(a), insertionSort(a).shifts); }
  return { about: "Every closed form against the counters, exactly (holds is strict equality, or for the binary average agreement to 1e-9, or for ranges containment). The binary-search rows use every successful key, so max is the true maximum, not a sample. Unsuccessful searches are only bounded above here.", rows, allHold: rows.every((r) => r.holds), count: rows.length };
}

function controlsBlock() {
  const rows = SIZES.map((n) => {
    const per = SEEDS.slice(0, n > 8192 ? 3 : 10).map((s) => { const a = makeInput("random", n, s); let wrong = 0, maxC = 0; for (let k = 0; k < n; k++) { const r = binarySearch(a, k); if (r.index === -1 || a[r.index] !== k) wrong++; maxC = Math.max(maxC, r.comparisons); } return { wrong, maxC }; });
    return { n, seeds: per.length, keys: n, wrong: Math.min(...per.map((p) => p.wrong)), wrongFraction: spread(per.map((p) => p.wrong / n)), maxComparisons: Math.max(...per.map((p) => p.maxC)), bound: CLOSED.binaryMax(n) };
  });
  return { about: "False-success control: binary search run on unsorted input (a random order of 0..n-1), searching for every key, all of which are present. wrongFraction: share of keys reported missing or at the wrong place (mean, min, max over seeds; 3 seeds from n = 16,384, 10 below); wrong: the fewest wrong answers in any seed. maxComparisons stays within floor(log2 n) + 1: the search is still fast, and it is wrong. Fewer comparisons is only a win when the precondition (sorted input) holds. Linear search on the same arrays finds every key (search.test.mjs).", unsortedBinary: { rows },
    verdict: `Binary search on unsorted input misses ${round(100 * rows[0].wrongFraction.mean, 1)} percent of keys at n = ${rows[0].n} and ${round(100 * rows.at(-1).wrongFraction.mean, 3)} percent at n = ${rows.at(-1).n}, while never using more than floor(log2 n) + 1 comparisons.` };
}

function median(f, reps) { const xs = []; for (let i = 0; i < reps; i++) { const t = performance.now(); f(); xs.push(performance.now() - t); } xs.sort((a, b) => a - b); return xs[reps >> 1]; }

function timingBlock() {
  const rows = [1024, 4096, 16384, 65536].map((n) => {
    const r = makeInput("random", n, 1), s = makeInput("sorted", n), keys = Int32Array.from({ length: 1000 }, (_, i) => (i * 7919) % n);
    return { n, linearSearchUs: (median(() => { for (const k of keys) linearSearch(r, k); }, 5) * 1000) / keys.length, binarySearchUs: (median(() => { for (let j = 0; j < 100; j++) for (const k of keys) binarySearch(s, k); }, 5) * 1000) / (100 * keys.length),
      insertionSortMs: median(() => insertionSort(r), 3), mergeSortMs: median(() => mergeSort(r), 5), builtinSortMs: median(() => Int32Array.from(r).sort(), 5) };
  });
  return { about: `Wall time in Node ${process.version} on this machine only (${cpus()[0]?.model ?? "unknown CPU"}, ${platform()}), one process at below-normal priority, median of 3 or 5 runs, random input seed 1. Searches in microseconds per lookup (1,000 keys; binary repeated 100 times), sorts in milliseconds per sort, including the counting. builtinSortMs is the engine's own typed-array sort, for scale. Another machine, engine or load gives other numbers; the comparison counts do not change.`, rows };
}

function filmBlock(search, sorting) {
  const pick = (k, alg) => sorting.rows.filter((r) => r.kind === k && r[alg]).map((r) => [r.n, r[alg].comparisons.mean]);
  const n = 65536;
  return { about: "What the film draws (Rerun knocking on shells one at a time against halving the beach). beach: n shells, the average knocks for a linear walk ((n + 1) / 2) against the most halvings binary search needs. curves: comparisons against n (random input, mean over seeds) for each method, for log-log plots.", beach: { shells: n, linearAverage: CLOSED.linearAvg(n), linearWorst: n, binaryMax: CLOSED.binaryMax(n) },
    curves: { linear: search.linear.map((r) => [r.n, r.successful.mean]), binary: search.binary.map((r) => [r.n, r.successful.mean]), insertion: pick("random", "insertion"), merge: pick("random", "merge") } };
}

function main() {
  const t0 = Date.now(), search = searchBlock(), sorting = sortingBlock();
  const blocks = { sources: sourcesBlock(), inputs: { about: "Seeded inputs (makeInput in search.mjs, the shared mulberry32 generator rng from tinyformer-ops.mjs): random is a Fisher-Yates permutation of 0..n-1; sorted and reversed are 0..n-1 forwards and backwards; few draws each value from 0 to 3. Sizes are the powers of two from 8 to 65,536.", sizes: SIZES, seeds: SEEDS, kinds: KINDS },
    search, sorting, closedForms: closedBlock(sorting, search), steps: stepsBlock(), controls: controlsBlock(), timing: timingBlock(), film: filmBlock(search, sorting) };
  blocks.cost = { about: "Milliseconds this fill spent in each part (this machine only), and the fill's wall time in seconds.", totals: { ...cost }, fillSeconds: (Date.now() - t0) / 1000 };
  const facts = { about: "Lesson A26, Search and sorting: the cost of looking. Computed by tools/school/fill_search.mjs from system/school/search.mjs and search-steps.mjs. Do not edit by hand. Comparison and move counts are exact and the same on every machine; wall times are this machine only. No GPU.",
    sourceSha256: Object.fromEntries(["search.mjs", "search-steps.mjs"].map((f) => [f, createHash("sha256").update(readFileSync(new URL(`../../system/school/${f}`, import.meta.url))).digest("hex")])),
    recipe: { sizes: [SIZES[0], SIZES.at(-1)], seeds: [SEEDS[0], SEEDS.at(-1)], insertionStopsAt: INS_MAX, linearLookupsPerSeed: LOOKUPS }, ...deep(blocks), seconds: 0 };
  facts.seconds = round((Date.now() - t0) / 1000, 1);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "facts.json"), JSON.stringify(facts) + "\n");
  console.log(JSON.stringify({ search: facts.search.verdict, sorting: facts.sorting.verdict, closed: { allHold: facts.closedForms.allHold, count: facts.closedForms.count }, controls: facts.controls.verdict, timing: facts.timing.rows, seconds: facts.seconds }, null, 1));
}

try { main(); } catch (e) { console.error("fill_search failed:", e); process.exit(1); }
