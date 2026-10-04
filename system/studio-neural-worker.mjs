// studio-neural-worker.mjs: draws the living neural instruments' frames off the main thread.
//
// Message in:  { id, seed, instrument: "field"|"solid", W, H, time, palette }
// Message out: { id, instrument, W, H, buf, RW, RH, verified }   (buf transferred)
//              { id, error }
// The page copies `buf` onto its canvas (studio-neural.js). The networks are built once per
// (seed, instrument). On the first frame of each network the fast kernels are checked against the
// network's own eval on a 32 x 32 sample; on any difference the worker draws with the reference
// functions instead, and says so in `verified`.

import { buildCppn, buildNeuralSdf, neuralSeed } from "./neural.js?v=20261003-neural-rest";
import { fastCppn, referenceCppn, fastSdf, fieldPixels, solidPixels, solidSize } from "./neural-kernels.mjs?v=20261003-neural-rest";

let key = "";
let net = null;
let verified = false;

function build(seed, instrument) {
  const seedNum = neuralSeed(seed);
  if (instrument === "solid") {
    const sdf = buildNeuralSdf(seedNum);
    const fast = fastSdf(sdf);
    verified = true;
    for (let i = 0; i < 32 && verified; i += 1) {
      for (let j = 0; j < 32; j += 1) {
        const x = (i / 31) * 4 - 2, y = (j / 31) * 3 - 1.5, z = ((i * 7 + j * 13) % 32) / 31 * 4 - 2;
        if (!Object.is(fast(x, y, z), sdf.dist(x, y, z))) { verified = false; break; }
      }
    }
    return { seedNum, dist: verified ? fast : (x, y, z) => sdf.dist(x, y, z) };
  }
  const cppn = buildCppn(seedNum);
  const fast = fastCppn(cppn);
  const ref = referenceCppn(cppn);
  const a = new Float64Array(3), b = new Float64Array(3);
  verified = true;
  for (let i = 0; i < 32 && verified; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      const x = (i / 31) * 2.4 - 1.2, y = (j / 31) * 2.4 - 1.2;
      fast(x, y, a); ref(x, y, b);
      if (!Object.is(a[0], b[0]) || !Object.is(a[1], b[1]) || !Object.is(a[2], b[2])) { verified = false; break; }
    }
  }
  return { seedNum, colorAt: verified ? fast : ref };
}

self.onmessage = (e) => {
  const { id, seed, instrument, W, H, time, palette } = e.data || {};
  try {
    const k = instrument + "|" + seed;
    if (k !== key) { net = build(seed, instrument); key = k; }
    if (instrument === "solid") {
      const { RW, RH } = solidSize(W, H);
      const buf = new Uint8ClampedArray(RW * RH * 4);
      solidPixels(net.dist, W, H, time, palette, net.seedNum, buf);
      self.postMessage({ id, instrument, W, H, RW, RH, buf, verified }, [buf.buffer]);
    } else {
      const buf = new Uint8ClampedArray(W * H * 4);
      if (!fieldPixels(net.colorAt, W, H, time, palette, buf)) { self.postMessage({ id, error: "grid too small" }); return; }
      self.postMessage({ id, instrument, W, H, buf, verified }, [buf.buffer]);
    }
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
