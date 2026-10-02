// conformance-cube.mjs: Track A step T3, all 16,777,216 sRGB colours through the integer OKLab path in
// Node and in Python (numpy), compared bin for bin at L6/ab6 and L8. Gate (pre-registered): 0 mismatches.
// Reported, not gated: integer bins against the float64 prototype's bins, and Node float bins against
// numpy float bins (the review's inference that float cube roots disagree across engines).
// Run: node tests/telos-track-a/conformance-cube.mjs        (about a minute; writes results/t3-cube.json
//      when TELOS_WRITE_RESULTS=1; exits 1 when the gate fails)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeCube, OKLAB_INT_SCHEMA } from "../../system/lib/sense-core/oklab-int.mjs";
import { linearRgbToOklab } from "../../system/lib/sense-core/colour-perceptual.mjs";
import { writeResult } from "./lib/results.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, "py");
const CH = ["L6", "a6", "b6", "L8"];
const sha = (b) => createHash("sha256").update(b).digest("hex");

function compare(a, b) {
  const per = [0, 0, 0, 0];
  let colours = 0;
  const first = [];
  for (let i = 0; i < a.length; i += 4) {
    let any = false;
    for (let k = 0; k < 4; k++) if (a[i + k] !== b[i + k]) { per[k]++; any = true; }
    if (any) {
      colours++;
      if (first.length < 5) { const c = i / 4; first.push({ rgb: [c >> 16, (c >> 8) & 255, c & 255], a: [...a.slice(i, i + 4)], b: [...b.slice(i, i + 4)] }); }
    }
  }
  return { coloursDiffering: colours, perChannel: Object.fromEntries(CH.map((c, k) => [c, per[k]])), first };
}

// Node float64 path with the same bin rule as cube_bins.py float mode, on Node's own linear table.
function floatCubeNode() {
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) { const c = i / 255; lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  const R = { L: [0, 1], a: [-0.234, 0.277], b: [-0.312, 0.199] };
  const fbin = (v, ch, bits) => { const [lo, hi] = R[ch], n = (1 << bits) - 1; const q = Math.floor((v - lo) / (hi - lo) * n + 0.5); return q < 0 ? 0 : q > n ? n : q; };
  const out = new Uint8Array(16777216 * 4);
  for (let r = 0; r < 256; r++) for (let g = 0; g < 256; g++) for (let b = 0; b < 256; b++) {
    const [L, A, B] = linearRgbToOklab(lut[r], lut[g], lut[b]);
    const o = ((r << 16) | (g << 8) | b) * 4;
    out[o] = fbin(L, "L", 6); out[o + 1] = fbin(A, "a", 6); out[o + 2] = fbin(B, "b", 6); out[o + 3] = fbin(L, "L", 8);
  }
  return { out, lut };
}

const dir = mkdtempSync(join(tmpdir(), "telos-cube-"));
try {
  let t = Date.now();
  const jsInt = encodeCube();
  const tJs = Date.now() - t;
  t = Date.now();
  execFileSync("python", ["cube_bins.py", "int", join(dir, "int.bin")], { cwd: PY, stdio: "inherit" });
  const tPy = Date.now() - t;
  const pyInt = new Uint8Array(readFileSync(join(dir, "int.bin")));
  const gate = compare(jsInt, pyInt);

  execFileSync("python", ["cube_bins.py", "float", join(dir, "float.bin")], { cwd: PY, stdio: "inherit" });
  const pyFloat = new Uint8Array(readFileSync(join(dir, "float.bin")));
  const lutBuf = readFileSync(join(dir, "float.bin.lut"));
  const pyLut = new Float64Array(lutBuf.buffer.slice(lutBuf.byteOffset, lutBuf.byteOffset + lutBuf.length));
  const { out: jsFloat, lut: jsLut } = floatCubeNode();
  let lutDiff = 0;
  for (let i = 0; i < 256; i++) if (jsLut[i] !== pyLut[i]) lutDiff++;

  const body = {
    schema: OKLAB_INT_SCHEMA,
    colours: 16777216,
    gate: { ...gate, pass: gate.coloursDiffering === 0 && pyInt.length === jsInt.length },
    sha256: { nodeInt: sha(jsInt), pythonInt: sha(pyInt), nodeFloat: sha(jsFloat), numpyFloat: sha(pyFloat) },
    seconds: { nodeInt: tJs / 1000, pythonInt: tPy / 1000 },
    reported: {
      integerVsNumpyFloat: compare(jsInt, pyFloat),
      nodeFloatVsNumpyFloat: { ...compare(jsFloat, pyFloat), linearTableEntriesDiffering: lutDiff },
    },
  };
  writeResult("t3-cube", body);
  console.log(JSON.stringify({ gate: body.gate, seconds: body.seconds,
    integerVsNumpyFloat: body.reported.integerVsNumpyFloat.perChannel,
    nodeFloatVsNumpyFloat: body.reported.nodeFloatVsNumpyFloat.perChannel, lutDiff }, null, 1));
  process.exitCode = body.gate.pass ? 0 : 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
