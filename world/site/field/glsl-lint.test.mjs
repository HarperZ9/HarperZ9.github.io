import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint, findings } from "./glsl-lint.mjs";

const HEAD = "#version 300 es\nprecision highp float;\nuniform vec2 uRes; uniform float uT;\nout vec4 o;\n";
const CLEAN = HEAD + `const float EPS = 1e-4;
float sq(float x) { return x * x; }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes; float k = length(uv), safe = max(k, EPS);
  float a = sq(k) + 1.0 / safe + sqrt(max(uT, 0.0)) + log(1.0 + k * k) + pow(abs(uT), 1.5) + acos(clamp(uT, -1.0, 1.0));
  vec3 n = normalize(vec3(uv, 1.0)); // a comment with a / b and sqrt(x) must not count
  o = vec4(n * a / (1.0 + a * a), 1.0);
}`;
// one planted defect per rule: the body line that goes into main, or a whole-shader edit
const PLANTED = {
  "unused-uniform": (s) => s.replace("out vec4 o;", "uniform float uGhost;\nout vec4 o;"),
  "unused-function": (s) => s.replace("void main", "float dead(float x) { return x + 1.0; }\nvoid main"),
  "no-precision": (s) => s.replace("precision highp float;\n", ""),
  "low-precision": (s) => s.replace("uniform float uT;", "uniform mediump float uT;"),
  "literal-precision": (s) => s.replace("const float EPS = 1e-4;", "const float EPS = 1e-4; const float TAU = 6.28318530718;"),
  "sin-hash": (s) => s.replace("float k = length(uv)", "float k = length(uv) + fract(sin(uv.x * 12.9898) * 43758.5453)"),
  div: (s) => s.replace("1.0 / safe", "1.0 / k"),
  sqrt: (s) => s.replace("sqrt(max(uT, 0.0))", "sqrt(uT)"),
  log: (s) => s.replace("log(1.0 + k * k)", "log(k)"),
  pow: (s) => s.replace("pow(abs(uT), 1.5)", "pow(uT - 0.5, 2.0)"),
  acos: (s) => s.replace("acos(clamp(uT, -1.0, 1.0))", "acos(uT)"),
  normalize: (s) => s.replace("normalize(vec3(uv, 1.0))", "normalize(vec3(uv, uT))"),
};
const opts = { nonzero: ["uRes"] };

test("the clean fixture has no findings", () => assert.deepEqual(lint(CLEAN, opts), []));
for (const [rule, plant] of Object.entries(PLANTED)) {
  test(`planted defect is caught: ${rule}`, () => {
    const src = plant(CLEAN); assert.notEqual(src, CLEAN, "the plant changed nothing");
    const f = lint(src, opts);
    assert.deepEqual([...new Set(f.map((x) => x.rule))], [rule], JSON.stringify(f));
  });
}
test("a finding reports the line it sits on", () => {
  const f = lint(PLANTED.sqrt(CLEAN), opts);
  assert.equal(f.length, 1); assert.ok(f[0].text.includes("sqrt(uT)")); assert.equal(f[0].line, 9);
});
test("a guard held in a local, a ternary or a constant is seen", () => {
  const body = (l) => HEAD + `const float R = 2.0;\nvoid main() { float x = uT * uRes.x; ${l} o = vec4(x); }`;
  for (const ok of ["float d = max(x, 1e-3); x = 1.0 / d;", "x = 1.0 / (x > 0.5 ? 2.0 : R);", "x /= R * 3.0;", "x = 1.0 / (d2(x) + 1.0);".replace("d2(x)", "x * x"), "x = 2.0e-6 / (R * R);"]) assert.deepEqual(lint(body(ok), opts), [], ok);
  for (const bad of ["float d = x - 1.0; x = 1.0 / d;", "x = 1.0 / (x > 0.5 ? 2.0 : x);", "x /= x - R;", "x = 1.0 / 0.0;"]) assert.equal(lint(body(bad), opts).map((f) => f.rule).join(), "div", bad);
});
test("the shipped shaders add no finding beyond the baseline", async () => {
  const base = JSON.parse(readFileSync(new URL("./glsl-lint.baseline.json", import.meta.url), "utf8")), now = await findings();
  assert.deepEqual(Object.keys(now).sort(), Object.keys(base).sort(), "the shader list changed: run node world/site/field/glsl-lint.mjs --write and review the diff");
  for (const [name, list] of Object.entries(now)) {
    const left = [...base[name]], fresh = [];
    for (const f of list) { const i = left.indexOf(f); if (i < 0) fresh.push(f); else left.splice(i, 1); }
    assert.deepEqual(fresh, [], `${name}: new findings. Guard them, or review and run node world/site/field/glsl-lint.mjs --write`);
  }
});
test("the baseline holds no unused uniform, low precision or sin hash", async () => {
  const base = JSON.parse(readFileSync(new URL("./glsl-lint.baseline.json", import.meta.url), "utf8"));
  for (const list of Object.values(base)) for (const f of list) assert.ok(!/^(unused-uniform|low-precision|sin-hash|no-precision) /.test(f), f);
});
