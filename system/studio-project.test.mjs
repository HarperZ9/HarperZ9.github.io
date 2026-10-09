import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "./studio-store.js";
import { buildProject, readProject, applyProject, PROJECT_SCHEMA } from "./studio-project.js";

function memory() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; }

test("a project holds every kept session and the source on stage, and nothing else", () => {
  const store = createStore({ storage: memory() });
  store.save("sketch", { strokes: [1, 2] });
  store.save("fractal", { view: { x: 1 } });
  const doc = buildProject(store, ["sketch", "fractal", "loom"], "fractal", new Date("2026-10-09T00:00:00Z"));
  assert.equal(doc.schema, PROJECT_SCHEMA);
  assert.equal(doc.active, "fractal");
  assert.deepEqual(Object.keys(doc.sessions).sort(), ["fractal", "sketch"]);
  assert.equal(doc.savedAt, "2026-10-09T00:00:00.000Z");
});

test("opening a project writes its sessions into another browser's store exactly", () => {
  const a = createStore({ storage: memory() });
  a.save("sketch", { strokes: [[0, 0, 1, 1]] });
  a.save("gallery", { seed: "x", layers: ["contour"] });
  const text = JSON.stringify(buildProject(a, ["sketch", "gallery"], "gallery"));
  const b = createStore({ storage: memory() });
  const read = readProject(text, ["sketch", "gallery", "loom"]);
  assert.ok(read.ok);
  assert.equal(read.active, "gallery");
  const r = applyProject(b, read);
  assert.deepEqual(r.written.sort(), ["gallery", "sketch"]);
  assert.deepEqual(b.load("sketch").state, { strokes: [[0, 0, 1, 1]] });
  assert.deepEqual(b.load("gallery").state, { seed: "x", layers: ["contour"] });
});

test("a file that is not a project is refused whole, and unknown sources are skipped, not written", () => {
  assert.equal(readProject("{", ["sketch"]).ok, false);
  assert.equal(readProject(JSON.stringify({ schema: "other/1", sessions: {} }), ["sketch"]).ok, false);
  assert.equal(readProject(JSON.stringify({ schema: PROJECT_SCHEMA }), ["sketch"]).ok, false);
  const read = readProject(JSON.stringify({ schema: PROJECT_SCHEMA, sessions: { sketch: {}, nope: { a: 1 } }, active: "nope" }), ["sketch"]);
  assert.deepEqual(read.known, ["sketch"]);
  assert.deepEqual(read.skipped, ["nope"]);
  assert.equal(read.active, null);
  const store = createStore({ storage: memory() });
  applyProject(store, read);
  assert.equal(store.load("nope").state, null);
});
