// fractal3d-pro.test.mjs: the progressive 3D renderer's program sources.
// Run: node --test system/fractal3d-pro.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDE } from "./fractal3d-de.js";
import { buildSampleProgram, buildDisplayProgram } from "./fractal3d-pro-glsl.js";

test("each formula builds a de() of its own", () => {
  assert.match(buildDE("mandelbox"), /step_box\(z, dr, p\)/);
  assert.match(buildDE("mandelbulb"), /0\.5 \* log/);
  assert.match(buildDE("surf"), /step_surf/);
  assert.match(buildDE("menger"), /de_menger/);
  assert.match(buildDE("kleinian"), /de_kleinian/);
});

test("a hybrid applies its steps in turn, and a bulb step bounds the escape", () => {
  const src = buildDE("hybrid", ["box", "bulb", "surf"]);
  assert.match(src, /int s = i - \(i \/ 3\) \* 3;/);
  for (const s of ["step_box", "step_bulb", "step_surf"]) assert.ok(src.includes(s));
  assert.match(src, /dot\(z, z\) > 1e4/);
  assert.match(src, /r \/ abs\(dr\)/, "a fold in the mix takes the linear estimate");
});

test("the sample program carries PBR, lens, fog and the depth pick; the display tone-maps", () => {
  const s = buildSampleProgram("hybrid", ["box", "bulb"]);
  for (const k of ["vec3 brdf(", "u_aperture", "u_focus", "softShadow(", "ambientOcclusion(", "u_fog", "u_depthOut", "ramp("]) assert.ok(s.includes(k), k);
  const d = buildDisplayProgram();
  assert.ok(d.includes("aces(") && d.includes("encodeOut("));
});
