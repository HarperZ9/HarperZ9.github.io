import test from "node:test";
import assert from "node:assert/strict";
import { MOD_SOURCES, evalSources, computeOffsets, modValue } from "./mod-matrix.js";

const ENV = { bass: 0.8, mid: 0.4, treble: 0.2, level: 0.5, mx: 0.25, my: 0.75, knobA: 1, knobB: 0, knobC: 0.5 };

test("every declared source evaluates inside its stated range", () => {
  for (const t of [0, 0.37, 2.5, 60.01, 3600]) {
    const v = evalSources(t, ENV);
    for (const s of MOD_SOURCES) {
      assert.ok(v[s.id] !== undefined, s.id + " missing");
      if (s.centered) assert.ok(v[s.id] >= -0.5 && v[s.id] <= 0.5, s.id + " out of centered range at t=" + t);
      else assert.ok(v[s.id] >= 0 && v[s.id] <= 1, s.id + " out of range at t=" + t);
    }
  }
});

test("LFOs are deterministic functions of time", () => {
  const a = evalSources(12.34, ENV), b = evalSources(12.34, ENV);
  assert.equal(a["lfo-sine"], b["lfo-sine"]);
  assert.equal(a["lfo-hold"], b["lfo-hold"]);
  const c = evalSources(13.1, ENV);
  assert.notEqual(a["lfo-sine"], c["lfo-sine"]);
});

test("random hold steps: constant within a step, changing across steps", () => {
  const v1 = evalSources(9.50, ENV)["lfo-hold"];
  const v2 = evalSources(10.05, ENV)["lfo-hold"];
  const v3 = evalSources(10.55, ENV)["lfo-hold"];
  assert.equal(v2, v3, "same hold step");
  assert.notEqual(v1, v2, "different hold step");
});

test("offsets sum per target, respect depth sign, and clamp", () => {
  const src = evalSources(0, ENV);
  const off = computeOffsets([
    { src: "bass", tgt: "bloom", depth: 0.5 },
    { src: "level", tgt: "bloom", depth: -0.2 },
    { src: "bass", tgt: "tw", depth: 1 },
    { src: "bass", tgt: "tw", depth: 1 },
    { src: "nonsense", tgt: "vig", depth: 1 },
    null,
  ], src);
  assert.ok(Math.abs(off.bloom - (0.8 * 0.5 - 0.5 * 0.2)) < 1e-9);
  assert.equal(off.tw, 1, "stacked routes clamp at +-1");
  assert.equal(off.vig, undefined, "unknown source contributes nothing");
});

test("modValue stays inside the slider bounds and is identity at zero offset", () => {
  assert.equal(modValue(160, 24, 360, 0), 160);
  assert.equal(modValue(160, 24, 360, 1), 360);
  assert.equal(modValue(160, 24, 360, -1), 24);
  assert.ok(Math.abs(modValue(50, 0, 100, 0.25) - 75) < 1e-9);
});
