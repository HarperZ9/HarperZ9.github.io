// Tests for lesson F1, "Vectors: a list of numbers is a place".
// Run: node --test system/school/vectors.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dot, length, cosine, distance, nearest, loadTables, hiddenByWord, CATEGORIES, categoryOf,
  neighbourShare, permutation, shuffled, measureTable, chanceShare, pca2,
} from "./vectors.mjs";
import { VOCAB } from "./corpus.mjs";
import { rng } from "./tinyformer.mjs";

const root = new URL("../../", import.meta.url);
const MODEL = JSON.parse(readFileSync(new URL("media/school/attention/model.json", root), "utf8"));

// A dot product that drops the last term: the control the identity tests must catch.
const brokenDot = (a, b) => { let s = 0; for (let i = 0; i < a.length - 1; i++) s += a[i] * b[i]; return s; };

const randomVec = (r, n) => Array.from({ length: n }, () => r() * 2 - 1);

// |a - b|^2 = |a|^2 + |b|^2 - 2 |a||b| cos(a, b): ties cosine to distance.
function cosineIdentityHolds(dotFn, trials = 100) {
  const r = rng(21);
  for (let t = 0; t < trials; t++) {
    const a = randomVec(r, 8), b = randomVec(r, 8);
    const la = Math.sqrt(dotFn(a, a)), lb = Math.sqrt(dotFn(b, b));
    const lhs = distance(a, b) ** 2, rhs = la * la + lb * lb - 2 * la * lb * cosine(a, b, dotFn);
    if (Math.abs(lhs - rhs) > 1e-9) return false;
  }
  return true;
}

test("arithmetic: dot, length, cosine, distance", () => {
  assert.equal(dot([1, 2, 3], [4, 5, 6]), 32);
  assert.equal(length([3, 4]), 5);
  assert.equal(distance([1, 1], [4, 5]), 5);
  assert.ok(Math.abs(cosine([1, 0], [0, 2])) < 1e-15, "perpendicular arrows");
  assert.ok(Math.abs(cosine([1, 2], [2, 4]) - 1) < 1e-12, "same direction, any length");
  assert.ok(Math.abs(cosine([1, 2], [-1, -2]) + 1) < 1e-12);
  assert.throws(() => dot([1], [1, 2]));
});

test("cosine identity: |a-b|^2 = |a|^2 + |b|^2 - 2|a||b|cos", () => {
  assert.ok(cosineIdentityHolds(dot));
});

test("control: a dot product that drops the last term fails the cosine identity", () => {
  assert.equal(cosineIdentityHolds(brokenDot), false);
});

test("nearest: excludes itself, sorted, metric aware", () => {
  const table = [[1, 0], [0.9, 0.1], [0, 1], [10, 0.5]];
  const byCos = nearest(table, 0, 3, "cosine").map((n) => n.index);
  assert.deepEqual(byCos, [3, 1, 2], "cosine ignores length: [10, 0.5] points nearly east");
  const byDist = nearest(table, 0, 3, "distance").map((n) => n.index);
  assert.deepEqual(byDist, [1, 2, 3], "distance does not");
});

test("tables load from model.json with the right shapes", () => {
  const t = loadTables(MODEL);
  assert.equal(t.wte.length, 46);
  assert.equal(t.wte[0].length, 32);
  assert.equal(t.wout.length, 46);
  assert.equal(t.wout[0].length, 32);
  const V = 46, D = 32, w = VOCAB.indexOf("kettle");
  assert.equal(t.wout[w][5], t.model.params.wout[5 * V + w], "wout rows are readout columns");
  assert.equal(t.wte[w][5], t.model.params.wte[w * D + 5]);
});

test("categories cover the vocabulary exactly once", () => {
  const all = Object.values(CATEGORIES).flat();
  assert.equal(all.length, VOCAB.length);
  assert.equal(new Set(all).size, VOCAB.length);
  assert.equal(categoryOf().length, VOCAB.length);
});

test("permutation is a seeded permutation and the shuffle keeps geometry", () => {
  const p = permutation(46, 7);
  assert.deepEqual(p.slice().sort((a, b) => a - b), Array.from({ length: 46 }, (_, i) => i));
  assert.deepEqual(p, permutation(46, 7));
  assert.notDeepEqual(p, permutation(46, 8));
  const t = loadTables(MODEL), s = shuffled(t.wte, 7);
  assert.deepEqual(s.map(length).sort(), t.wte.map(length).sort(), "same vectors, new owners");
});

test("measurement: trained word tables beat the shuffle control", () => {
  const t = loadTables(MODEL), labels = categoryOf(t.words);
  for (const [name, table] of [["wte", t.wte], ["wout", t.wout]]) {
    const m = measureTable(table, labels, { seeds: 200 });
    assert.ok(m.beatsControl.top1 && m.beatsControl.topk, `${name}: ${JSON.stringify(m)}`);
    assert.ok(Math.abs(m.control.top1.mean - chanceShare(labels)) < 0.03, "control sits at chance");
  }
});

test("measurement control: a shuffled table does not beat the shuffle control", () => {
  const t = loadTables(MODEL), labels = categoryOf(t.words);
  const m = measureTable(shuffled(t.wout, 999), labels, { seeds: 200, seed0: 5000 });
  assert.equal(m.beatsControl.topk, false, JSON.stringify(m));
});

test("hidden states: per-word averages after layer 1 exist for every word", () => {
  const t = loadTables(MODEL), h = hiddenByWord(t.model, 1, 64);
  assert.equal(h.table.length, 46);
  assert.ok(h.count.every((c) => c > 0), "every word appears as input in the held-out rows");
});

test("pca2: deterministic, orthonormal axes, recovers a planted plane", () => {
  const r = rng(31);
  // Four mirror images of each point, so x and y are exactly uncorrelated
  // and the true axes are x then y.
  const table = [];
  for (let i = 0; i < 10; i++) {
    const a = 1 + r() * 5, b = r() * 2;
    for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) table.push([sa * a, sb * b, 0.01 * (r() - 0.5), 0.01 * (r() - 0.5)]);
  }
  const p = pca2(table);
  assert.deepEqual(p, pca2(table));
  assert.ok(Math.abs(dot(p.axes[0], p.axes[1])) < 1e-8);
  assert.ok(Math.abs(length(p.axes[0]) - 1) < 1e-9);
  assert.ok(Math.abs(p.axes[0][0] - 1) < 1e-4, "first axis is x");
  assert.ok(Math.abs(Math.abs(p.axes[1][1]) - 1) < 1e-4, "second axis is y");
  assert.ok(p.varianceShare > 0.999);
  assert.ok(p.axisShare[0] >= p.axisShare[1]);
  const t = loadTables(MODEL), q = pca2(t.wout);
  assert.equal(q.coords.length, 46);
  assert.ok(q.varianceShare > 0 && q.varianceShare < 1);
});

test("neighbourShare on a planted two-cluster table is perfect", () => {
  const table = [[1, 0.1], [1, 0.2], [1, 0.3], [0.1, 1], [0.2, 1], [0.3, 1]];
  const labels = ["a", "a", "a", "b", "b", "b"];
  assert.deepEqual(neighbourShare(table, labels, 2), { top1: 1, topk: 1 });
});
