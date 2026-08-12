import test from "node:test";
import assert from "node:assert/strict";
import { clothLayout, chartLayout } from "./weave-render.js";
import { computeDraft } from "./weave-engine.js";

const draft = computeDraft(new Float32Array(24 * 16).fill(0.5), 24, 16, "twill22", { toneDrive: 0 });

test("cloth layout fits the budget with a positive thread size", () => {
  const L = clothLayout(draft, 1280, 800);
  assert.ok(L.threadPx >= 3 && L.threadPx <= 14);
  assert.equal(L.w, draft.ends * L.threadPx);
  assert.equal(L.h, draft.picks * L.threadPx);
  assert.ok(L.w <= 1280 + draft.ends && L.h <= 800 + draft.picks);
});

test("chart quadrants do not overlap and drawdown matches the grid", () => {
  const L = chartLayout(draft, 1200);
  assert.equal(L.drawdown.w, draft.ends * L.cell);
  assert.equal(L.drawdown.h, draft.picks * L.cell);
  assert.equal(L.threading.h, draft.shafts * L.cell);
  assert.equal(L.tieup.w, draft.treadles * L.cell);
  assert.ok(L.tieup.x >= L.threading.x + L.threading.w, "tieup sits right of threading");
  assert.ok(L.drawdown.y >= L.threading.y + L.threading.h, "drawdown sits below threading");
  assert.equal(L.treadling.x, L.tieup.x, "treadling aligns under the tieup");
  assert.equal(L.treadling.y, L.drawdown.y, "treadling aligns beside the drawdown");
  assert.ok(L.width > 0 && L.height > 0);
});

test("chart cell size stays positive for a dense draft", () => {
  const dense = computeDraft(new Float32Array(240 * 160).fill(0.5), 240, 160, "satin5", { toneDrive: 0 });
  const L = chartLayout(dense, 1200);
  assert.ok(L.cell >= 3);
});
