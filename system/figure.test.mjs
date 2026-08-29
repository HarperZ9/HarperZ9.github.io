import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enhanceFigureRoot,
  enhancePrintRecords,
  nextPointIndex,
  shouldAnimate,
} from "./figure.js";


function makeClassList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); },
  };
}


function makeTarget(key) {
  const listeners = new Map();
  const attributes = new Map([["data-figure-key", key]]);
  return {
    classList: makeClassList(),
    focused: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, event) { listeners.get(type)?.(event); },
    focus() { this.focused = true; },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
  };
}


test("keyboard point navigation supports arrows and boundary keys", () => {
  assert.equal(nextPointIndex(0, "ArrowRight", 3), 1);
  assert.equal(nextPointIndex(2, "ArrowRight", 3), 0);
  assert.equal(nextPointIndex(0, "ArrowLeft", 3), 2);
  assert.equal(nextPointIndex(1, "Home", 3), 0);
  assert.equal(nextPointIndex(1, "End", 3), 2);
  assert.equal(nextPointIndex(1, "Enter", 3), 1);
  assert.equal(nextPointIndex(0, "ArrowRight", 0), -1);
});


test("progressive enhancement retains static content and synchronizes a table row", () => {
  const points = [makeTarget("alpha"), makeTarget("beta")];
  const rows = [makeTarget("alpha"), makeTarget("beta")];
  const root = {
    dataset: {},
    querySelectorAll(selector) {
      if (selector === "[data-figure-point]") return points;
      if (selector === "[data-figure-row]") return rows;
      return [];
    },
  };

  assert.equal(enhanceFigureRoot(root, { matches: false }), true);
  assert.equal(root.dataset.figureEnhanced, "true");
  assert.equal(points[0].getAttribute("tabindex"), "0");
  assert.equal(points[1].getAttribute("tabindex"), "-1");

  let prevented = false;
  points[0].dispatch("keydown", { key: "ArrowRight", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(root.dataset.figureActive, "true");
  assert.equal(points[1].focused, true);
  assert.equal(points[1].getAttribute("tabindex"), "0");
  assert.equal(points[1].classList.contains("is-active"), true);
  assert.equal(rows[1].classList.contains("is-active"), true);
  assert.equal(rows[0].classList.contains("is-active"), false);
});


test("reduced-motion preference disables figure motion without disabling navigation", () => {
  assert.equal(shouldAnimate({ matches: true }), false);
  assert.equal(shouldAnimate({ matches: false }), true);
  assert.equal(shouldAnimate(null), true);

  const point = makeTarget("alpha");
  const root = {
    dataset: {},
    querySelectorAll(selector) { return selector === "[data-figure-point]" ? [point] : []; },
  };
  assert.equal(enhanceFigureRoot(root, { matches: true }), true);
  assert.equal(root.dataset.figureMotion, "reduced");
});


test("print enhancement opens relationship records and restores their screen disclosure state", () => {
  const listeners = new Map();
  const printQuery = {
    matches: true,
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const disclosure = { dataset: {}, open: false };
  const doc = {
    querySelectorAll(selector) {
      return selector === "details.figure-records" ? [disclosure] : [];
    },
  };

  assert.equal(enhancePrintRecords(doc, printQuery), 1);
  assert.equal(disclosure.open, true);

  printQuery.matches = false;
  listeners.get("change")?.({ matches: false });
  assert.equal(disclosure.open, false);
  assert.equal("figurePrintWasOpen" in disclosure.dataset, false);
});
