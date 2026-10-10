// fractal-gradient.test.mjs: gradient import, the histogram table, colouring settings.
// Run: node --test system/fractal-gradient.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGradient, resample, sampleImage, rgbToHex } from "./fractal-gradient.js";
import { histogramTable, CDF_BINS } from "./fractal-gl-colour.js";
import { colourSettings, COLOUR_MODES, ORBIT_GLSL, COLOURIZE_GLSL, fullOrbit, orbitSource } from "./fractal-colouring.js";

test("a colour list keeps its colours, in order", () => {
  const { stops, format } = parseGradient("#000 #ff0000, rgb(0, 128, 255) #fff");
  assert.equal(format, "colour list");
  assert.deepEqual(stops, [[0, 0, 0], [255, 0, 0], [0, 128, 255], [255, 255, 255]]);
});

test("a CSS gradient honours its positions and resamples in OKLab", () => {
  const { stops, format } = parseGradient("linear-gradient(90deg, #000000 0%, #ffffff 25%, #000000 100%)");
  assert.equal(format, "CSS gradient");
  assert.equal(stops.length, 3);
  assert.deepEqual(stops[0], [0, 0, 0]);
  // Halfway along is a third of the way back from white to black: a light grey, not mid-grey.
  assert.ok(stops[1][0] > 140 && stops[1][0] < 230, `middle stop ${stops[1]}`);
  assert.deepEqual(stops[2], [0, 0, 0]);
});

test("a Fractint map and a GIMP gradient each come in as sixteen stops", () => {
  const map = Array.from({ length: 256 }, (_, i) => `${i} ${255 - i} 128`).join("\n");
  const m = parseGradient(map);
  assert.equal(m.format, "Fractint map");
  assert.equal(m.stops.length, 16);
  assert.deepEqual(m.stops[0], [0, 255, 128]);
  assert.deepEqual(m.stops[15], [255, 0, 128]);
  const ggr = "GIMP Gradient\nName: Test\n2\n0.0 0.25 0.5 1 0 0 1 0 1 0 1 0 0\n0.5 0.75 1.0 0 1 0 1 0 0 1 1 0 0\n";
  const g = parseGradient(ggr);
  assert.equal(g.format, "GIMP gradient");
  assert.equal(g.stops.length, 16);
  assert.deepEqual(g.stops[0], [255, 0, 0]);
  assert.deepEqual(g.stops[15], [0, 0, 255]);
});

test("nonsense is refused with a reason", () => {
  assert.throws(() => parseGradient(""), /nothing/);
  assert.throws(() => parseGradient("just words"), /at least two colours/);
});

test("an image row and resampling produce sixteen stops", () => {
  const row = new Uint8ClampedArray(100 * 4);
  for (let x = 0; x < 100; x++) { row[x * 4] = x * 2.55; row[x * 4 + 3] = 255; }
  const s = sampleImage(row);
  assert.equal(s.length, 16);
  assert.ok(s[0][0] < 5 && s[15][0] > 245);
  assert.equal(rgbToHex([255, 128, 0]), "#ff8000");
  assert.equal(resample([{ pos: 0, rgb: [10, 20, 30] }, { pos: 1, rgb: [10, 20, 30] }], 4).length, 4);
});

test("the histogram table is a monotone CDF ending at one", () => {
  const mus = Float32Array.from({ length: 1000 }, (_, i) => (i % 100) + 0.5);
  const t = histogramTable(mus, 0, 100);
  assert.equal(t.length, CDF_BINS * 4);
  let prev = -1;
  for (let b = 0; b < CDF_BINS; b++) {
    const v = t[b * 4] * 65536 + t[b * 4 + 1] * 256 + t[b * 4 + 2];
    assert.ok(v >= prev); prev = v;
  }
  assert.equal(prev, 16777215);
});

test("colouring settings default to the original look, and the GLSL names every mode", () => {
  const s = colourSettings({});
  assert.equal(s.mode, 0);
  assert.equal(s.density, 1);
  assert.equal(COLOUR_MODES.length, 8);
  assert.equal(colourSettings({ colouring: { mode: "histogram" } }).mode, 7);
  assert.match(ORBIT_GLSL, /void orbitStep\(vec2 z, vec2 zp, vec2 c\)/);
  for (let m = 1; m <= 7; m++) assert.ok(COLOURIZE_GLSL.includes(`m == ${m}`), `mode ${m} in colourize()`);
});

test("only the trap and TIA modes compile the full orbit statistics, and the ramp runs once", () => {
  // A software rasteriser runs every branch, so per-iteration work and ramp calls a mode does not
  // read still cost the frame; the default frame ran 15 times slower on SwiftShader before this.
  const body = ORBIT_GLSL.slice(ORBIT_GLSL.indexOf("void orbitStep"));
  const full = body.indexOf("#ifdef ORBIT_FULL"), end = body.indexOf("#endif");
  assert.ok(full > 0 && end > full, "the trap and TIA updates sit behind ORBIT_FULL");
  assert.ok(body.slice(0, full).includes("o_cross"), "the cross distance is kept in every variant");
  assert.ok(!body.slice(0, full).includes("pow("), "no TIA power outside the full variant");
  assert.equal((COLOURIZE_GLSL.slice(COLOURIZE_GLSL.indexOf("vec3 colourize")).match(/ramp\(/g) || []).length, 1, "colourize calls the ramp once");
  const want = { smooth: false, distance: false, "trap-point": true, "trap-line": true, "trap-cross": true, "trap-image": true, tia: true, histogram: false };
  for (const [mode, f] of Object.entries(want)) assert.equal(fullOrbit({ colouring: { mode } }), f, mode);
  assert.equal(fullOrbit({}), false, "no colouring is the smooth default");
  assert.equal(orbitSource("void main(){}", false), "void main(){}");
  assert.equal(orbitSource("#version 300 es\nvoid main(){}", true), "#version 300 es\n#define ORBIT_FULL 1\nvoid main(){}");
  assert.equal(orbitSource("void main(){}", true), "#define ORBIT_FULL 1\nvoid main(){}");
});