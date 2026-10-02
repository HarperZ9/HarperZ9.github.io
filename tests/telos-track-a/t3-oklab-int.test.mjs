// t3-oklab-int.test.mjs: Telos Track A step T3, the integer colour path and Node/Python conformance.
// Rules and thresholds: tests/telos-track-a/PREREGISTRATION.md, section T3. The full-cube comparison
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
  LIN_Q20, M1_Q20, M2_Q20, RANGES_Q36, CBRT_Q16, oklabQ36FromSrgb8, binsOfSrgb8,
} from "../../system/lib/sense-core/oklab-int.mjs";
import { layerTextAll } from "../../system/lib/sense-core/layers-int.mjs";
import { linearRgbToOklab, srgbToLinear } from "../../system/lib/sense-core/colour-perceptual.mjs";
import { randomImages } from "./lib/images.mjs";
import { xorshift32 } from "./lib/rng.mjs";
import { writeResult } from "./lib/results.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, "py");
const results = {};
const sha = (b) => createHash("sha256").update(b).digest("hex");
const py = (args, opts = {}) => execFileSync("python", args, { cwd: PY, encoding: "utf8", maxBuffer: 1 << 28, ...opts });

test("T3.const eq: both embedded constant sets equal a fresh 60-digit regeneration", () => {
  const gen = JSON.parse(py(["gen_oklab_int_constants.py"]));
  const js = { lin_q20: [...LIN_Q20], m1_q20: M1_Q20.map((r) => [...r]), m2_q20: M2_Q20.map((r) => [...r]),
    ranges_q36: { L: [...RANGES_Q36.L], a: [...RANGES_Q36.a], b: [...RANGES_Q36.b] } };
  const pyEmbedded = JSON.parse(py(["-c", "import json,oklab_int as o;print(json.dumps({'lin_q20':list(o.LIN_Q20),"
    + "'m1_q20':[list(r) for r in o.M1_Q20],'m2_q20':[list(r) for r in o.M2_Q20],'ranges_q36':{k:list(v) for k,v in o.RANGES_Q36.items()}}))"]));
  for (const k of ["lin_q20", "m1_q20", "m2_q20", "ranges_q36"]) {
    assert.deepEqual(js[k], gen[k], `JS ${k}`);
    assert.deepEqual(pyEmbedded[k], gen[k], `Python ${k}`);
  }
});

test("T3.cbrt eq: the JS and Python cube-root tables are identical and correctly rounded", () => {
  const pyTable = JSON.parse(py(["-c", "import json,oklab_int as o;print(json.dumps(o.CBRT_Q16))"]));
  assert.equal(pyTable.length, 65537);
  let diff = 0;
  for (let x = 0; x <= 65536; x++) if (pyTable[x] !== CBRT_Q16[x]) diff++;
  assert.equal(diff, 0);
  // Correct rounding against BigInt arithmetic: (2t - 1)^3 <= 8 x 2^32 < (2t + 1)^3 for t = table[x].
  let bad = 0;
  for (let x = 0; x <= 65536; x++) {
    const t = BigInt(CBRT_Q16[x]), n8 = BigInt(x) * 8n * 4294967296n;
    const lo = t === 0n ? -1n : (2n * t - 1n) ** 3n, hi = (2n * t + 1n) ** 3n;
    if (!(lo <= n8 && n8 < hi)) bad++;
  }
  results.cbrtTable = { entries: 65537, jsPyDiff: diff, notCorrectlyRounded: bad };
  assert.equal(bad, 0);
});

// Reported, not gated. A 2e-4 bound was first written here without being pre-registered; v1 measured
// 7.5e-4 on this sample (2.0e-3 at worst on the cube, near black), so the bound was wrong, and the
// check now only records the deviation. See BUILD-T0-T3 and the v2 amendment.
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
  writeResult("t3-oklab-int", { auditFramesDirSet: Boolean(FRAMES), results });
});
