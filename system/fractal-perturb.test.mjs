// fractal-perturb.test.mjs: the deep-zoom arithmetic against ground truth.
// Run: node --test system/fractal-perturb.test.mjs system/fractal-hp.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { referenceOrbit, buildBLA, perturbPixel, directIterate, diffabs, packBLA, BLA_TEXELS } from "./fractal-perturb.js";
import { decToFixed, fixedToDec, bitsForScale } from "./fractal-hp.js";

// A deep Mandelbrot target well past a double's reach: 1e-30 wide, about 25 orders past float32.
const DEEP = {
  re: "-0.7436227627792091903930625607721105561797006142687856921130208924",
  im: "0.1318305311337870112915195543947448074486402760798047827036608098",
};

function pixelAt(centreRe, centreIm, ox, oy, bits) {
  const B = BigInt(bits);
  const add = (s, d) => fixedToDec(decToFixed(s, bits) + decToFixed(d.toExponential(17), bits), bits);
  return { re: add(centreRe, ox), im: add(centreIm, oy), B };
}

test("perturbation with rebasing matches direct BigInt iteration at 1e-35", () => {
  const scale = 1e-35, maxIter = 8000;
  const bits = bitsForScale(scale);
  const ref = referenceOrbit({ kind: "mandelbrot", cRe: DEEP.re, cIm: DEEP.im, maxIter, scale });
  let agree = 0, total = 0;
  for (let i = 0; i < 24; i++) {
    const ox = (Math.sin(i * 12.9898) * 0.5) * scale, oy = (Math.cos(i * 78.233) * 0.3) * scale;
    const p = pixelAt(DEEP.re, DEEP.im, ox, oy, bits);
    const truth = directIterate({ kind: "mandelbrot", re: p.re, im: p.im, maxIter, bits });
    const got = perturbPixel(ref, ox, oy, maxIter);
    total++;
    if (got.n === truth.n) agree++;
  }
  assert.ok(agree >= total - 1, `iteration counts agree on ${agree} of ${total} pixels`);
});

test("BLA skips most iterations and keeps the counts", () => {
  const scale = 1e-35, maxIter = 8000;
  const bits = bitsForScale(scale);
  const ref = referenceOrbit({ kind: "mandelbrot", cRe: DEEP.re, cIm: DEEP.im, maxIter, scale });
  const bla = buildBLA(ref, Math.log2(scale), { epsLog2: -53 });
  let agree = 0, total = 0, steps = 0, iters = 0;
  for (let i = 0; i < 24; i++) {
    const ox = (Math.sin(i * 3.7) * 0.5) * scale, oy = (Math.cos(i * 5.1) * 0.3) * scale;
    const plain = perturbPixel(ref, ox, oy, maxIter);
    const fast = perturbPixel(ref, ox, oy, maxIter, bla);
    total++; if (plain.n === fast.n) agree++;
    steps += fast.blaSteps; iters += fast.n;
  }
  assert.ok(agree >= total - 1, `BLA counts agree on ${agree} of ${total}`);
  assert.ok(steps > 0, "BLA was used");
});

test("Burning Ship and Tricorn perturbation match direct iteration", () => {
  for (const [kind, re, im] of [["burningship", "-1.7624682294912955264066234933171226959784", "-0.0273200001118173221671592174349563575296"], ["tricorn", "0.3071800649962832260474042221489039967874", "-0.6882435794589650601098494444788101467946"]]) {
    const scale = 1e-13, maxIter = kind === "tricorn" ? 25000 : 2000, bits = bitsForScale(scale);
    const ref = referenceOrbit({ kind, cRe: re, cIm: im, maxIter, scale });
    let agree = 0;
    const counts = new Set();
    for (let i = 0; i < 16; i++) {
      const ox = Math.sin(i) * 0.5 * scale, oy = Math.cos(i * 1.3) * 0.4 * scale;
      const p = pixelAt(re, im, ox, oy, bits);
      const got = perturbPixel(ref, ox, oy, maxIter).n;
      counts.add(got);
      if (got === directIterate({ kind, re: p.re, im: p.im, maxIter, bits }).n) agree++;
    }
    assert.ok(counts.size >= 6, `${kind}: the pixels escape at ${counts.size} different counts`);
    // Both points sit on a boundary chaotic enough that doubles cannot hold every count. Over 40
    // pixels a plain double iteration of the exact pixel matched the BigInt count 9 times (Ship)
    // and 11 times (Tricorn); perturbation in doubles matched 36 and 30, with or without rebasing.
    assert.ok(agree >= 9, `${kind}: ${agree} of 16 agree`);
  }
});

test("without rebasing a glitch shows: Pauldelbrot's criterion fires and counts go wrong", () => {
  // A reference near a minibrot nucleus far from the pixels: the classic glitch setting.
  const scale = 1e-6, maxIter = 2000;
  const re = "-0.743643887037158704752191506114774", im = "0.131825904205311970493132056385139";
  const bits = bitsForScale(scale);
  const ref = referenceOrbit({ kind: "mandelbrot", cRe: re, cIm: im, maxIter, scale });
  let rebased = 0, glitched = 0;
  for (let i = 0; i < 40; i++) {
    const ox = Math.sin(i * 7.1) * 0.5 * scale, oy = Math.cos(i * 3.3) * 0.5 * scale;
    const p = pixelAt(re, im, ox, oy, bits);
    const truth = directIterate({ kind: "mandelbrot", re: p.re, im: p.im, maxIter, bits }).n;
    const fixed = perturbPixel(ref, ox, oy, maxIter);
    if (fixed.n === truth) rebased++;
    const raw = perturbPixel(ref, ox, oy, maxIter, null, { rebase: false });
    if (raw.glitches > 0) glitched++;
  }
  assert.ok(rebased >= 39, `rebasing matches truth on ${rebased} of 40`);
  assert.ok(glitched > 0, "the criterion flags glitched pixels when rebasing is off");
});

test("diffabs is |c + d| - |c| in every sign case", () => {
  for (const [c, d] of [[1, 0.5], [1, -3], [-1, 0.5], [-1, 3], [0, -2], [0, 2]]) {
    assert.ok(Math.abs(diffabs(c, d) - (Math.abs(c + d) - Math.abs(c))) < 1e-15);
  }
});

test("packBLA writes three texels per entry", () => {
  const ref = referenceOrbit({ kind: "mandelbrot", cRe: "-0.75", cIm: "0.1", maxIter: 100, scale: 1e-3 });
  const bla = buildBLA(ref, Math.log2(1e-3));
  const packed = packBLA(bla);
  assert.equal(packed.length, bla.entries.length * BLA_TEXELS * 4);
  assert.equal(bla.levels[0].count, ref.len - 1);
});

test("the deep test point is not trivial: its pixels escape at a spread of counts", () => {
  const scale = 1e-35, maxIter = 8000;
  const ref = referenceOrbit({ kind: "mandelbrot", cRe: DEEP.re, cIm: DEEP.im, maxIter, scale });
  const ns = new Set();
  for (let i = 0; i < 24; i++) ns.add(perturbPixel(ref, Math.sin(i * 12.9898) * 0.5 * scale, Math.cos(i * 78.233) * 0.3 * scale, maxIter).n);
  assert.ok(ns.size >= 8 && ![...ns].every((n) => n === maxIter), `distinct counts: ${[...ns].join(",")}`);
});
