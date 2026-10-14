import { test } from "node:test";
import assert from "node:assert/strict";
import { valuesAt, withKey } from "./studio-timeline.js";

test("between two keys a control eases from one value to the other, and holds outside them", () => {
  const keys = [{ t: 1, values: { a: 0, b: 10 } }, { t: 3, values: { a: 100 } }];
  assert.equal(valuesAt(keys, 0).a, 0);
  assert.equal(valuesAt(keys, 1).a, 0);
  assert.equal(valuesAt(keys, 3).a, 100);
  assert.equal(valuesAt(keys, 9).a, 100);
  assert.equal(valuesAt(keys, 2).a, 50);            // the middle of an ease-in-out is the middle
  assert.ok(valuesAt(keys, 1.5).a < 25);             // eased, so slow at the start
  assert.equal(valuesAt(keys, 2).b, 10);             // a control in one key only holds its value
});

test("a key at the same time replaces the old one, and keys stay in time order", () => {
  let keys = withKey([], 2, { a: 1 });
  keys = withKey(keys, 0.5, { a: 2 });
  keys = withKey(keys, 2.001, { a: 3 });
  assert.deepEqual(keys.map((k) => [k.t, k.values.a]), [[0.5, 2], [2.001, 3]]);
});
