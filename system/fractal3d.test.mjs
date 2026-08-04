// fractal3d.test.mjs — shader-source contract for the 3D raymarcher's quality pass.
//
// The renderer's visible failures were never in the DEs (transcribed and sourced): they were in
// the shading. A full-spectrum cosine palette at the orbit trap's raw frequency turned near-
// chaotic trap values into per-pixel rainbow confetti; a fixed hit epsilon was simultaneously
// blobby up close and fizzing at distance; a shared ray origin painted concentric rings into the
// glow. Each fix below is only visible to a unit test through the generated source, so that is
// what these assert. Run: node --test system/fractal3d.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { _buildFragment3D } from "./fractal3d.js";

const TYPES = ["mandelbox", "mandelbulb"];

test("the trap material is restrained, and the confetti palette is gone", () => {
  for (const type of TYPES) {
    const src = _buildFragment3D(type, 1);
    assert.ok(src.includes("trapMaterial"), `${type}: trap-derived material present`);
    // The old palette wrapped every channel independently — the confetti generator.
    assert.ok(!src.includes("vec3(0.0, 0.33, 0.67)"), `${type}: full-spectrum cosine phases removed`);
    // The trap is compressed before banding, so adjacent-pixel chaos cannot become hue noise.
    assert.ok(src.includes("sqrt(clamp(trap"), `${type}: trap compressed before banding`);
  }
});

test("the hit epsilon follows the pixel cone", () => {
  for (const type of TYPES) {
    const src = _buildFragment3D(type, 1);
    assert.ok(src.includes("uniform float u_pixelAngle"), `${type}: pixel-angle uniform declared`);
    assert.ok(src.includes("max(EPSILON, u_pixelAngle * t)"), `${type}: epsilon scales with distance`);
  }
});

test("the ray origin is dithered so the glow has no shared-origin rings", () => {
  for (const type of TYPES) {
    const src = _buildFragment3D(type, 1);
    assert.ok(src.includes("ditherHash(gl_FragCoord.xy)"), `${type}: per-pixel start offset`);
  }
});

test("both occlusion estimates multiply the lighting, and neither adds to it", () => {
  for (const type of TYPES) {
    const src = _buildFragment3D(type, 1);
    assert.ok(/col \*= \(0\.25 \+ 0\.75 \* ao\) \* \(0\.35 \+ 0\.65 \* dao\);/.test(src),
      `${type}: step AO and 5-tap DE AO are multipliers`);
  }
});

test("the trap read for shading survives the normal taps", () => {
  // calcNormal calls de() four more times, each overwriting g_trap; shading must read the value
  // captured at the hit, or the material follows the last normal tap instead of the surface.
  for (const type of TYPES) {
    const src = _buildFragment3D(type, 1);
    const capture = src.indexOf("float trapAtHit = g_trap");
    const normal = src.indexOf("vec3 n = calcNormal(p)");
    assert.ok(capture !== -1 && normal !== -1 && capture < normal,
      `${type}: g_trap captured before calcNormal`);
    assert.ok(src.includes("trapMaterial(trapAtHit"), `${type}: shading reads the captured trap`);
  }
});

test("supersampling still compiles both fragment variants", () => {
  for (const type of TYPES) {
    for (const aa of [1, 4]) {
      const src = _buildFragment3D(type, aa);
      assert.ok(src.includes(`#define AA_SAMPLES ${aa === 4 ? 4 : 1}`), `${type}/aa${aa}`);
    }
  }
});
