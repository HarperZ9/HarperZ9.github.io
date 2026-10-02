// t3-oklab-int.test.mjs: Telos Track A step T3, the integer colour path and Node/Python conformance.
// Rules and thresholds: tests/telos-track-a/PREREGISTRATION.md, section T3 and amendment 1 (path v2;
// v1 results are kept in results/t3-oklab-int-v1.json). The full-cube comparison
// (16,777,216 colours) runs in conformance-cube.mjs because it takes about a minute.
// Run: node --test tests/telos-track-a/t3-oklab-int.test.mjs
//   with TELOS_AUDIT_FRAMES=<dir holding index.json and the .rgba frames> for the 36 audit frames.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIN_Q24, M1_Q20, M2_Q20, RANGES_Q36, cbrtQ44toQ16, oklabQ36FromSrgb8, binsOfSrgb8, OKLAB_INT_SCHEMA,
} from "../../system/lib/sense-core/oklab-int.mjs";
import { layerTextAll } from "../../system/lib/sense-core/layers-int.mjs";
import { linearRgbToOklab, srgbToLinear } from "../../system/lib/sense-core/colour-perceptual.mjs";
import { randomImages } from "./lib/images.mjs";
import { xorshift32 } from "./lib/rng.mjs";
import { writeResult } from "./lib/results.mjs";
import { amendment1Sha256 } from "./prereg-hash.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, "py");
const results = {};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const py = (args, opts = {}) => execFileSync("python", args, { cwd: PY, encoding: "utf8", maxBuffer: 1 << 28, ...opts });

test("T3.const eq: both embedded constant sets equal a fresh 60-digit regeneration", () => {
  const gen = JSON.parse(py(["gen_oklab_int_constants.py"]));
  assert.equal(gen.schema, OKLAB_INT_SCHEMA);
  const js = { lin_q24: [...LIN_Q24], m1_q20: M1_Q20.map((r) => [...r]), m2_q20: M2_Q20.map((r) => [...r]),
    ranges_q36: { L: [...RANGES_Q36.L], a: [...RANGES_Q36.a], b: [...RANGES_Q36.b] } };
  const pyEmbedded = JSON.parse(py(["-c", "import json,oklab_int as o;print(json.dumps({'lin_q24':list(o.LIN_Q24),"
    + "'m1_q20':[list(r) for r in o.M1_Q20],'m2_q20':[list(r) for r in o.M2_Q20],'ranges_q36':{k:list(v) for k,v in o.RANGES_Q36.items()}}))"]));
  for (const k of ["lin_q24", "m1_q20", "m2_q20", "ranges_q36"]) {
    assert.deepEqual(js[k], gen[k], `JS ${k}`);
    assert.deepEqual(pyEmbedded[k], gen[k], `Python ${k}`);
  }
});

// Inputs the cube root sees: every LMS value of a seeded colour sample plus the range ends and
// 4,096 values spread over [0, 2^44 + 2^25].
function cbrtInputs() {
  const next = xorshift32(20261002);
  const xs = [0, 1, 2, 15, 16, 17, 2 ** 44, 2 ** 44 + 2 ** 24, 2 ** 44 + 2 ** 25];
  for (let i = 0; i < 4096; i++) xs.push(Math.floor((i / 4095) * (2 ** 44 + 2 ** 25)));
  for (let i = 0; i < 4000; i++) {
    const r = LIN_Q24[next() & 255], g = LIN_Q24[next() & 255], b = LIN_Q24[next() & 255];
    for (const row of M1_Q20) xs.push(row[0] * r + row[1] * g + row[2] * b);
  }
  return xs;
}

test("T3.cbrt eq: the cube root is the exact nearest integer (BigInt check) and Python agrees", () => {
  const xs = cbrtInputs();
  let bad = 0;
  for (const x of xs) {
    const t = BigInt(cbrtQ44toQ16(x)), n8 = BigInt(x) * 16n * 8n;
    const lo = t === 0n ? -1n : (2n * t - 1n) ** 3n, hi = (2n * t + 1n) ** 3n;
    if (!(lo <= n8 && n8 < hi)) bad++;
  }
  const pyOut = JSON.parse(py(["-c", "import json,sys,oklab_int as o;xs=json.load(sys.stdin);print(json.dumps([o.cbrt_q44_to_q16(x) for x in xs]))"],
    { input: JSON.stringify(xs) }));
  let diff = 0;
  xs.forEach((x, k) => { if (pyOut[k] !== cbrtQ44toQ16(x)) diff++; });
  results.cubeRoot = { inputs: xs.length, notNearest: bad, jsPyDiff: diff };
  assert.equal(bad, 0);
  assert.equal(diff, 0);
});

// Reported here on a sample; the pre-registered accuracy gate (amendment 1: at most 1e-4 per channel)
// runs over the full cube in conformance-cube.mjs. Note for the record: v1 measured 7.5e-4 on this
// sample, after a 2e-4 bound that had not been pre-registered was written here and failed.
test("T3.accuracy (reported): deviation of integer OKLab from float OKLab on 20,000 seeded colours", () => {
  const next = xorshift32(20261002);
  let worst = 0, sum = 0, worstAt = null;
  for (let i = 0; i < 20000; i++) {
    const r = next() & 255, g = next() & 255, b = next() & 255;
    const f = linearRgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
    const q = oklabQ36FromSrgb8(r, g, b).map((v) => v / 2 ** 36);
    const e = Math.max(...q.map((v, k) => Math.abs(v - f[k])));
    sum += e;
    if (e > worst) { worst = e; worstAt = [r, g, b]; }
  }
  results.integerVsFloat = { n: 20000, maxAbs: worst, meanMaxAbs: sum / 20000, worstAt };
  assert.ok(Number.isFinite(worst));
});

test("T3.bins: spot values (white, black, primaries) are as expected", () => {
  assert.deepEqual(binsOfSrgb8(255, 255, 255).filter((_, i) => i === 0 || i === 3), [63, 255]);
  assert.deepEqual(binsOfSrgb8(0, 0, 0).filter((_, i) => i === 0 || i === 3), [0, 0]);
});

function compareEntries(label, entries, jsEntries) {
  let imageAgree = 0, textAgree = 0;
  const firstMismatch = [];
  entries.forEach((p, i) => {
    const j = jsEntries[i];
    if (p.image_sha256 === j.image_sha256) imageAgree++;
    if (p.text === j.text) textAgree++;
    else if (firstMismatch.length < 2) {
      const a = p.text.split("\n"), b = j.text.split("\n");
      const line = a.findIndex((l, k) => l !== b[k]);
      firstMismatch.push({ name: j.name, line, py: a[line], js: b[line] });
    }
  });
  const textSha = sha(jsEntries.map((e) => e.text).join("\u0000"));
  results[label] = { n: entries.length, imageAgree, textAgree, firstMismatch, jsTextSetSha256: textSha };
  return { imageAgree, textAgree };
}

test("T3.images eq: layer text is byte-identical in Node and Python on 1,000 seeded random images", () => {
  const dir = mkdtempSync(join(tmpdir(), "telos-t3-"));
  try {
    const out = join(dir, "py.json");
    py(["layers_int.py", "random", "1000", out]);
    const pyEntries = JSON.parse(readFileSync(out, "utf8")).entries;
    const jsEntries = [...randomImages(1000)].map(({ name, w, h, px }) => ({ name, image_sha256: sha(px), text: layerTextAll(px, w, h, 4) }));
    assert.equal(pyEntries.length, 1000);
    const { imageAgree, textAgree } = compareEntries("randomImages", pyEntries, jsEntries);
    assert.equal(imageAgree, 1000, "the two generators must emit identical images first");
    assert.equal(textAgree, 1000);
    const achro = jsEntries.filter((e) => e.text.includes("achromatic:1")).length;
    results.randomImages.achromaticFlagged = achro;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const FRAMES = process.env.TELOS_AUDIT_FRAMES;
test("T3.frames eq: layer text is byte-identical in Node and Python on the 36 audit frames",
  { skip: FRAMES && existsSync(join(FRAMES, "index.json")) ? false : "TELOS_AUDIT_FRAMES not set to the audit frame directory" }, () => {
    const manifest = JSON.parse(readFileSync(join(HERE, "fixtures", "audit-frames-manifest.json"), "utf8")).frames;
    const jsEntries = manifest.map((f) => {
      const px = readFileSync(join(FRAMES, f.name + ".rgba"));
      assert.equal(sha(px), f.sha256, `${f.name} matches the committed manifest`);
      return { name: f.name, image_sha256: sha(px), text: layerTextAll(px, f.w, f.h, 4) };
    });
    const dir = mkdtempSync(join(tmpdir(), "telos-t3f-"));
    try {
      const out = join(dir, "py.json");
      py(["layers_int.py", "frames", FRAMES, out]);
      const byName = new Map(JSON.parse(readFileSync(out, "utf8")).entries.map((e) => [e.name, e]));
      const pyEntries = manifest.map((f) => byName.get(f.name));
      assert.equal(manifest.length, 36);
      const { imageAgree, textAgree } = compareEntries("auditFrames", pyEntries, jsEntries);
      results.auditFrames.achromaticFlagged = jsEntries.filter((e) => e.text.includes("achromatic:1")).map((e) => e.name);
      assert.equal(imageAgree, 36);
      assert.equal(textAgree, 36);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

test("T3 results file", () => {
  writeResult("t3-oklab-int", { schema: OKLAB_INT_SCHEMA, amendment_1_sha256: amendment1Sha256(), auditFramesDirSet: Boolean(FRAMES), results });
});
