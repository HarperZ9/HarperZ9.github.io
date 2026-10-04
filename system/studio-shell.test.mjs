// node --test system/studio-shell.test.mjs
// The Studio shell's pure half: the shared undo history, the key chords, the source guide, and the
// Showcase fix that gives every system its own candidate terms. The browser half of the contract
// (the switch, the bar on screen, exact pixels after undo and after a round trip) is
// tests/studio-shell.cjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHistory, chordOf, isTextEntry, SOURCE_GUIDE, ACTION_ORDER } from "./studio-shell.js";
import { defaultTermsFor } from "./showcase/controls.js";
import { SHOWCASE_CONF, buildReport, recheck } from "./showcase/report.js";
import { SYSTEMS } from "./discovery/systems.js";
import { toRPN } from "./discovery/expr.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("history: undo and redo walk the recorded states exactly, per source", () => {
  const h = createHistory();
  assert.equal(h.undo("sketch"), null, "nothing to undo before anything is recorded");
  h.record("sketch", { strokes: 0 });
  assert.equal(h.canUndo("sketch"), false, "the first state is the start, not a step");
  h.record("sketch", { strokes: 1 });
  h.record("sketch", { strokes: 2 });
  h.record("fractal", { zoom: 1 });
  h.record("fractal", { zoom: 2 });
  assert.deepEqual(h.undo("sketch"), { strokes: 1 });
  assert.deepEqual(h.undo("sketch"), { strokes: 0 });
  assert.equal(h.undo("sketch"), null, "the start is the floor");
  assert.deepEqual(h.redo("sketch"), { strokes: 1 });
  assert.deepEqual(h.current("fractal"), { zoom: 2 }, "another source's history is untouched");
  assert.deepEqual(h.undo("fractal"), { zoom: 1 });
});

test("history: a new step after an undo drops the redo branch", () => {
  const h = createHistory();
  h.record("s", { v: 0 }); h.record("s", { v: 1 }); h.record("s", { v: 2 });
  h.undo("s");
  assert.equal(h.canRedo("s"), true);
  h.record("s", { v: 9 });
  assert.equal(h.canRedo("s"), false);
  assert.deepEqual(h.undo("s"), { v: 1 });
});

test("history: an unchanged state is not a step, and a restore is not recorded twice", () => {
  const h = createHistory();
  assert.equal(h.record("s", { a: [1, 2] }), true);
  assert.equal(h.record("s", { a: [1, 2] }), false);
  assert.equal(h.record("s", null), false, "a source with nothing to snapshot records nothing");
  assert.deepEqual(h.depth("s"), { past: 1, future: 0 });
});

test("history: snapshots are copies, so later edits never reach a stored step", () => {
  const h = createHistory();
  const live = { strokes: [[0.1, 0.2]] };
  h.record("s", live);
  live.strokes.push([0.3, 0.4]);
  h.record("s", live);
  const back = h.undo("s");
  assert.deepEqual(back, { strokes: [[0.1, 0.2]] });
  back.strokes.length = 0;
  assert.deepEqual(h.redo("s"), { strokes: [[0.1, 0.2], [0.3, 0.4]] });
  assert.deepEqual(h.undo("s"), { strokes: [[0.1, 0.2]] }, "mutating a returned state changes nothing stored");
});

test("history: the limit keeps the newest steps", () => {
  const h = createHistory({ limit: 3 });
  for (let i = 0; i < 6; i++) h.record("s", { i });
  assert.deepEqual(h.depth("s"), { past: 3, future: 0 });
  assert.deepEqual(h.undo("s"), { i: 4 });
  assert.deepEqual(h.undo("s"), { i: 3 });
  assert.equal(h.undo("s"), null);
});

test("key chords: Ctrl or Cmd with Z undoes, with Shift or Y redoes; Alt and bare keys do nothing", () => {
  assert.equal(chordOf({ ctrlKey: true, key: "z" }), "undo");
  assert.equal(chordOf({ metaKey: true, key: "Z", shiftKey: true }), "redo");
  assert.equal(chordOf({ ctrlKey: true, key: "y" }), "redo");
  assert.equal(chordOf({ ctrlKey: true, altKey: true, key: "z" }), null);
  assert.equal(chordOf({ key: "z" }), null);
  assert.equal(chordOf({ ctrlKey: true, key: "s" }), null);
});

test("key chords: a text field keeps the browser's own undo", () => {
  const el = (tagName, type) => ({ tagName, getAttribute: (k) => (k === "type" ? type : null) });
  assert.equal(isTextEntry(el("INPUT", "text")), true);
  assert.equal(isTextEntry(el("INPUT", "number")), true);
  assert.equal(isTextEntry(el("TEXTAREA")), true);
  assert.equal(isTextEntry({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextEntry(el("INPUT", "range")), false, "a slider is not text");
  assert.equal(isTextEntry(el("BUTTON")), false);
  assert.equal(isTextEntry(null), false);
});

test("the guide names every source in the Studio's menu, in plain public words", () => {
  const html = readFileSync(join(ROOT, "studio.html"), "utf8");
  const menu = html.slice(html.indexOf('id="studio-source"'), html.indexOf("rail-scroll"));
  const sources = [...menu.matchAll(/data-source="([a-z0-9]+)"/g)].map((m) => m[1]);
  assert.equal(sources.length, 25);
  assert.deepEqual(Object.keys(SOURCE_GUIDE).sort(), [...sources].sort());
  for (const [id, g] of Object.entries(SOURCE_GUIDE)) {
    assert.ok(g.name && g.purpose, id);
    assert.ok(g.purpose.length <= 120, `${id}: one sentence or two short ones`);
    assert.doesNotMatch(g.purpose, /\u2014|\u2013|operator|gate|lane|[A-Z]:\\/, `${id}: canon voice`);
  }
});

test("the action bar has one order", () => {
  assert.deepEqual([...ACTION_ORDER], ["primary", "undo", "redo", "export", "pin"]);
});

test("showcase: each system's default terms use only that system's variables", () => {
  for (const system of Object.keys(SHOWCASE_CONF)) {
    const terms = defaultTermsFor(system).split(",").map((s) => s.trim());
    assert.deepEqual(terms, SHOWCASE_CONF[system].basis);
    for (const t of terms) assert.doesNotThrow(() => toRPN(t, SYSTEMS[system].vars), `${system}: ${t}`);
  }
  // The bug of record: Kepler's terms kept for SHO name a variable SHO does not have.
  assert.throws(() => toRPN("x*vy", SYSTEMS.sho.vars), /unknown identifier: vy/);
  assert.throws(() => toRPN("x*vy", SYSTEMS.pendulum.vars), /unknown identifier: x/);
});

test("showcase: with its own terms, every system re-checks to MATCH", async () => {
  for (const system of Object.keys(SHOWCASE_CONF)) {
    const basis = defaultTermsFor(system).split(",").map((s) => s.trim());
    const bundle = await buildReport({ seed: "1", system, basis });
    const r = await recheck(bundle.report);
    assert.equal(r.verdict, "MATCH", `${system}: ${r.reason || ""}`);
  }
});
