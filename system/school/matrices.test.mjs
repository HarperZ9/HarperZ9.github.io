// Tests for lesson F2, "Matrices move space".
// Run: node --test system/school/matrices.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  apply, applyAll, compose, det, columns, grid, moveGrid, polygonArea, orderDemo, matVec, attentionFinale,
  QUARTER_TURN, STRETCH_X, SHEAR_X, IDENTITY, UNIT_SQUARE,
} from "./matrices.mjs";
import { rng } from "./tinyformer.mjs";

const root = new URL("../../", import.meta.url);
const MODEL = JSON.parse(readFileSync(new URL("media/school/attention/model.json", root), "utf8"));
const FILM = JSON.parse(readFileSync(new URL("media/school/attention/facts.json", root), "utf8"));

const close = (a, b, tol = 1e-12) => a.every((r, i) => (Array.isArray(r) ? close(r, b[i], tol) : Math.abs(r - b[i]) <= tol));
function randomMatrix(r) { return [[r() * 4 - 2, r() * 4 - 2], [r() * 4 - 2, r() * 4 - 2]]; }

// A composition that multiplies in the wrong order (B A instead of A B):
// the control the associativity test must catch.
const transposedCompose = (A, B) => compose(B, A);

function associativityHolds(composeFn, trials = 200) {
  const r = rng(11);
  for (let t = 0; t < trials; t++) {
    const A = randomMatrix(r), B = randomMatrix(r), v = [r() * 2 - 1, r() * 2 - 1];
    if (!close(apply(composeFn(A, B), v), apply(A, apply(B, v)), 1e-9)) return false;
  }
  return true;
}

test("columns are the images of the unit arrows", () => {
  for (const M of [QUARTER_TURN, STRETCH_X, SHEAR_X, [[1.5, -0.25], [0.5, 2]]]) {
    const [c0, c1] = columns(M);
    assert.deepEqual(apply(M, [1, 0]), c0);
    assert.deepEqual(apply(M, [0, 1]), c1);
  }
  assert.deepEqual(apply(QUARTER_TURN, [1, 0]), [0, 1], "a quarter turn sends east to north");
});

test("(AB)v = A(Bv) for random matrices", () => {
  assert.ok(associativityHolds(compose));
});

test("control: a transposed composition fails (AB)v = A(Bv)", () => {
  assert.equal(associativityHolds(transposedCompose), false);
});

test("order matters: quarter turn and horizontal stretch do not commute", () => {
  const d = orderDemo();
  assert.equal(d.commute, false);
  assert.deepEqual(d.AB, [[0, -1], [2, 0]]);
  assert.deepEqual(d.BA, [[0, -2], [1, 0]]);
  assert.deepEqual(d.onArrow.AB, [0, 2], "stretch then turn: east arrow ends two up");
  assert.deepEqual(d.onArrow.BA, [0, 1], "turn then stretch: east arrow ends one up");
  assert.equal(orderDemo(STRETCH_X, IDENTITY).commute, true, "the check can see commuting pairs");
});

test("determinant is the area scale of the unit square, and multiplies under composition", () => {
  const r = rng(12);
  for (let t = 0; t < 50; t++) {
    const A = randomMatrix(r), B = randomMatrix(r);
    assert.ok(Math.abs(polygonArea(applyAll(A, UNIT_SQUARE)) - det(A)) < 1e-12);
    assert.ok(Math.abs(det(compose(A, B)) - det(A) * det(B)) < 1e-9);
  }
  assert.equal(det(QUARTER_TURN), 1);
  assert.equal(det(STRETCH_X), 2);
  assert.equal(det(SHEAR_X), 1);
});

test("grid moves line by line and straight lines stay straight", () => {
  const g = grid(2, 8);
  assert.equal(g.length, 10);
  const moved = moveGrid(SHEAR_X, g);
  for (const line of moved) {
    const [a, b] = [line[0], line.at(-1)];
    for (const p of line) {
      const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
      assert.ok(Math.abs(cross) < 1e-9, "point off its line");
    }
  }
  assert.deepEqual(matVec([[1, 2, 3], [0, 1, 0]], [1, 1, 1]), [6, 1]);
});

test("finale: the film's query, key and score are one matrix times one vector", () => {
  const f = attentionFinale(MODEL);
  assert.equal(f.layer, FILM.layer, "same layer as the film");
  assert.equal(f.head, FILM.head, "same head as the film");
  assert.equal(f.dHead, FILM.dHead);
  assert.equal(f.xQuery.length, 32);
  assert.equal(f.Wq.length, 32);
  assert.equal(f.Wq[0].length, 16);
  assert.equal(f.readingWord, "the");
  assert.equal(f.answerWord, "kettle");
  for (let j = 0; j < 16; j++) {
    assert.ok(Math.abs(f.q[j] - FILM.q[j]) <= 1e-4, `q[${j}] ${f.q[j]} vs ${FILM.q[j]}`);
    assert.ok(Math.abs(f.k[j] - FILM.k[j]) <= 1e-4, `k[${j}] ${f.k[j]} vs ${FILM.k[j]}`);
  }
  assert.ok(Math.abs(f.qkRaw - FILM.qkRaw) <= 1e-4, `qkRaw ${f.qkRaw} vs ${FILM.qkRaw}`);
  assert.equal(f.maxDiffFromForward, 0, "bit-identical to the forward pass buffer");
  assert.ok(Math.abs(f.scaled - f.forwardScore) < 1e-4, "q.k / sqrt(16) is the forward pass's score");
  // Recomputing q as a plain matVec on the transposed slice agrees too.
  const WqT = f.Wq[0].map((_, j) => f.Wq.map((r) => r[j]));
  const q2 = matVec(WqT, f.xQuery).map((v, j) => v + f.bq[j]);
  assert.ok(close(q2, f.q, 1e-5));
});

test("finale control: the other head's slice does not reproduce the film's numbers", () => {
  const f = attentionFinale(MODEL, { layer: FILM.layer, head: 1 - FILM.head });
  assert.ok(Math.abs(f.qkRaw - FILM.qkRaw) > 1e-2, `wrong head gave ${f.qkRaw}`);
});
