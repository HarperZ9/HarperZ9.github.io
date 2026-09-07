// system/spatial-folded-depth.test.mjs
// Behavioral contracts for the authored Folded Light surface grammar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import * as core from "./spatial-core.js";
import { POINT_VS } from "./spatial-shaders.js";

const LAYERS = Object.freeze([
  { name: "deep_veil", depth: 0.95 },
  { name: "far_veil", depth: 0.75 },
  { name: "mid_veil", depth: 0.55 },
  { name: "near_veil", depth: 0.22 },
]);

test("Folded Light veil parameters include deterministic ribbon and aperture grammar", () => {
  const first = core.veilParams("folded-light-inhabited", LAYERS);
  const again = core.veilParams("folded-light-inhabited", LAYERS);
  assert.deepEqual(first, again);

  for (const veil of first) {
    assert.ok(veil.ribbonWidth >= 0.24 && veil.ribbonWidth <= 0.72, `${veil.name} ribbon width`);
    assert.ok(Math.abs(veil.ribbonOffset) <= 0.34, `${veil.name} ribbon offset`);
    assert.ok(veil.warpAmp >= 0.08 && veil.warpAmp <= 0.34, `${veil.name} warp amplitude`);
    assert.ok(Math.abs(veil.twist) >= 0.18 && Math.abs(veil.twist) <= 0.96, `${veil.name} twist`);
    assert.ok(veil.apertureFreq >= 2.0 && veil.apertureFreq <= 5.0, `${veil.name} aperture frequency`);
    assert.ok(veil.apertureSoft >= 0.10 && veil.apertureSoft <= 0.28, `${veil.name} aperture softness`);
    assert.ok(veil.ridgeFreq >= 16.0 && veil.ridgeFreq <= 32.0, `${veil.name} fine ridge frequency`);
    assert.ok(Number.isFinite(veil.aperturePhase), `${veil.name} aperture phase`);
  }

  const widths = first.map((veil) => veil.ribbonWidth);
  assert.ok(widths[0] > widths[3], "far/deep veils stay broader while the near veil reads as a tighter foreground fold");
});

test("foldedSurfaceSample produces bounded nonplanar surfaces with visible apertures", () => {
  assert.equal(typeof core.foldedSurfaceSample, "function");
  assert.equal(typeof core.foldedSurfaceStats, "function");
  const veils = core.veilParams("folded-light-inhabited", LAYERS);
  const stats = core.foldedSurfaceStats(veils, { cols: 19, rows: 19, aspect: 1 });

  assert.ok(stats.combinedVisibleRatio > 0.16 && stats.combinedVisibleRatio < 0.72, "combined surfaces must keep meaningful open space");
  assert.ok(stats.maxAbsX <= 2.25 && stats.maxAbsY <= 1.92, "surface bounds stay inside the camera proof volume");
  assert.ok(stats.minZ < -4.9 && stats.maxZ > -2.0, "near/mid/far layers remain separated in depth");

  for (const layer of stats.layers) {
    assert.ok(layer.visibleRatio > 0.06 && layer.visibleRatio < 0.58, `${layer.name} is a ribbon/aperture surface, not a full sheet`);
    assert.ok(layer.holeRatio > 0.03, `${layer.name} has real aperture support`);
    assert.ok(layer.zRange > 0.08, `${layer.name} has nonplanar z relief`);
  }

  const mid = veils.find((veil) => veil.name === "mid_veil");
  const a = core.foldedSurfaceSample(mid, { u: 0.18, v: 0.52, time: 0, aspect: 1 });
  const b = core.foldedSurfaceSample(mid, { u: 0.82, v: 0.52, time: 0, aspect: 1 });
  assert.notEqual(a.position[2], b.position[2], "one horizontal cut through a veil must not stay planar");
});

test("foldedSurfaceSample mirrors fragment aperture and edge visibility math", () => {
  const veil = Object.freeze({
    name: "fixture_veil",
    depth: 0.55,
    foldTilt: 0.30,
    foldFreq: 7.25,
    foldPhase: 0.80,
    driftRate: 0.06,
    ribbonWidth: 0.42,
    ribbonOffset: -0.10,
    warpAmp: 0.20,
    twist: 0.50,
    apertureFreq: 2.80,
    aperturePhase: 1.10,
    apertureSoft: 0.24,
    verticalBow: 0.07,
    surfaceScale: 1.0,
  });

  const aperture = core.foldedSurfaceSample(veil, { u: 0.435, v: 0.5275, time: 0, aspect: 1, drift: 0 });
  assert.ok(Math.abs(aperture.hole - 0.31919812388263163) < 1e-12, "apertureSoft must lower the fragment hole threshold");
  assert.ok(Math.abs(aperture.visible - 0.36424981012514523) < 1e-12, "aperture visibility must match fragment support");

  const edge = core.foldedSurfaceSample(veil, { u: 0.965, v: 0.49, time: 0, aspect: 1, drift: 0 });
  assert.ok(Math.abs(edge.visible - 0.5443382045137718) < 1e-12, "CPU visible support must include the shader edge falloff");
});

test("Folded Light keeps low-tier mesh cost bounded without collapsing the surface grid", () => {
  assert.equal(typeof core.veilGridSize, "function");
  assert.deepEqual(core.veilGridSize(), { cols: 96, rows: 96 });
  assert.deepEqual(core.veilGridSize({ tier: "standard", shaderQuality: "standard" }), { cols: 96, rows: 96 });
  assert.deepEqual(core.veilGridSize({ tier: "low", shaderQuality: "basic" }), { cols: 64, rows: 64 });
  assert.deepEqual(core.veilGridSize({ tier: "unknown", shaderQuality: "basic" }), { cols: 64, rows: 64 });
});

test("Folded Light point shaping is explicitly scoped to procedural veils", () => {
  assert.ok(POINT_VS.includes("uProceduralVeils"), "point shader needs a manifest-mode gate");
  assert.ok(/uProceduralVeils\s*>\s*0\.5/.test(POINT_VS), "folded-only point transform must not leak to other modes");
});

test("canonical Folded Light baseline fixture is portable and provenance-labelled", () => {
  const fixtureUrl = new URL("../tests/fixtures/folded-light-before.sample.json.gz", import.meta.url);
  assert.ok(existsSync(fixtureUrl), "canonical pre-edit Folded Light baseline fixture must ship with tests");
  const bytes = statSync(fixtureUrl).size;
  assert.ok(bytes > 1000 && bytes < 120000, `compressed fixture should stay small enough for source review, got ${bytes} bytes`);

  const fixture = JSON.parse(gunzipSync(readFileSync(fixtureUrl)).toString("utf8"));
  assert.equal(fixture.fixture, "folded-light-before-sample/v1");
  assert.equal(fixture.sourceCapture.sourcePath, ".superpowers/folded-light-depth/folded-before.sample.json");
  assert.equal(fixture.sourceCapture.width, 160);
  assert.equal(fixture.sourceCapture.height, 200);
  assert.equal(fixture.sourceCapture.rgbaValues, 128000);
  assert.equal(fixture.metrics.hash, 4075143942);
  assert.equal(fixture.metrics.litRatio, 0.7848125);
  assert.deepEqual(fixture.metrics.bbox, { minX: 0, minY: 0, maxX: 159, maxY: 199 });
  assert.equal(fixture.raw.length, 128000);
});
