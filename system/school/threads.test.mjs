// Tests for lesson K21, "Threads, workgroups and memory".
// Run: node --test system/school/threads.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
// No GPU is used: the emulator runs the kernels in JavaScript.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { wgsl, KINDS, makeInputs, cpuReference, checkOutput, emulate, createEmulation, countSegments, threadMap, idleClosedForm, contiguousClosedForm, SPEC, WARP, CANARY } from "./threads.mjs";

const FACTS_URL = new URL("../../media/school/threads/facts.json", import.meta.url);
const run = (kind, n, wg, extra = {}) => { const { a, b } = makeInputs(n, 3); return { ...emulate({ kind, n, wg, a, b, pad: 64, ...extra }), want: cpuReference(a, b, kind === "strided" ? "strided" : "add", n, extra.stride ?? 1) }; };

test("the emulated kernels equal the CPU reference bit for bit, at sizes that are and are not multiples of the workgroup", () => {
  for (const n of [1, 31, 32, 1000, 1024, 4099]) for (const wg of [1, 32, 48, 64, 256]) {
    const r = run("add", n, wg);
    assert.ok(checkOutput(r.out, r.want, { pad: 64 }).ok, `add n ${n} wg ${wg}`);
  }
  const s = run("strided", 4096, 64, { stride: 32 });
  assert.ok(checkOutput(s.out, s.want, { pad: 64 }).ok);
  assert.notDeepEqual(Array.from(s.want.slice(0, 64)), Array.from(run("add", 4096, 64).want.slice(0, 64)), "the strided walk reads other elements");
});

test("broken kernels are caught: off by one writes past the end, a missing bound check writes many, a short bound misses the last element", () => {
  const n = 1000, wg = 64;
  const off = run("offByOne", n, wg, { oob: "buffer" }), none = run("noGuard", n, wg, { oob: "buffer" }), short = run("short", n, wg);
  const cOff = checkOutput(off.out, off.want, { pad: 64 }), cNone = checkOutput(none.out, none.want, { pad: 64 }), cShort = checkOutput(short.out, short.want, { pad: 64 });
  assert.equal(off.oobStores, 1); assert.equal(cOff.canaryHit, 1); assert.equal(cOff.ok, false);
  assert.equal(none.oobStores, idleClosedForm(n, wg)); assert.equal(cNone.canaryHit, Math.min(64, idleClosedForm(n, wg))); assert.equal(cNone.ok, false);
  assert.equal(cShort.mismatches, 1); assert.equal(cShort.first, n - 1); assert.equal(cShort.ok, false);
  const clamp = run("offByOne", n, wg, { oob: "clamp" }), cClamp = checkOutput(clamp.out, clamp.want, { pad: 64 });
  assert.equal(cClamp.ok, false, "a clamped stray write lands on the last element and is caught");
  const drop = run("offByOne", n, wg, { oob: "discard" }), cDrop = checkOutput(drop.out, drop.want, { pad: 64 });
  assert.equal(cDrop.ok, true, "a discarded stray write leaves the output right: the output check alone cannot see it");
  assert.equal(drop.oobStores, 1, "the emulator's store count still sees it");
  const good = run("add", n, wg, { oob: "buffer" });
  assert.equal(good.oobStores, 0); assert.equal(good.oobLoads, 0);
});

test("idle threads and workgroups are exact for sizes that are not multiples of the workgroup size", () => {
  for (const [n, wg] of [[1000, 64], [1000, 256], [1024, 64], [1, 256], [65537, 128]]) {
    const r = run("add", n, wg);
    assert.equal(r.workgroups, Math.ceil(n / wg));
    assert.equal(r.idleThreads, idleClosedForm(n, wg));
    assert.equal(r.loads, 2 * n); assert.equal(r.stores, n);
  }
  assert.equal(idleClosedForm(1000, 64), 24);
  const r48 = run("add", 960, 48);
  assert.equal(r48.partialWarps, 20, "a 48-wide workgroup is one full and one half warp");
  assert.equal(r48.emptyLanes, 20 * 16);
  assert.equal(run("add", 64 * 70000, 64).dispatchesNeeded, 2, "70,000 workgroups exceed one dimension's 65,535");
});

test("contiguous access costs ceil(4n / segment) transactions per array; strided access costs one per thread once the stride spans a segment", () => {
  for (const n of [1024, 4096, 1000]) for (const seg of [32, 128]) {
    const r = run("add", n, 64);
    assert.equal(r.transactions[seg].a, contiguousClosedForm(n, seg), `n ${n} seg ${seg}`);
    assert.equal(r.transactions[seg].out, contiguousClosedForm(n, seg));
  }
  assert.equal(contiguousClosedForm(32, 128), 1, "one full warp of 4-byte words: one 128-byte segment");
  assert.equal(contiguousClosedForm(32, 32), 4, "and four 32-byte transactions, as the CUDA guide's example says");
  const n = 8192;
  for (const S of [32, 64]) {
    const r = run("strided", n, 64, { stride: S });
    assert.equal(r.transactions[128].a, n, `stride ${S}: every thread its own 128-byte segment`);
    assert.equal(r.transactions[32].a, n);
    assert.equal(r.transactions[128].out, contiguousClosedForm(n, 128), "the write side stays contiguous");
  }
  const s2 = run("strided", n, 64, { stride: 2 }), s8 = run("strided", n, 64, { stride: 8 });
  assert.ok(s2.transactions[128].a === 2 * contiguousClosedForm(n, 128), `stride 2 spans twice the bytes (${s2.transactions[128].a})`);
  assert.equal(s8.transactions[32].a, n, "8 floats = 32 bytes: each thread its own 32-byte transaction");
  const w48 = run("add", 4800, 48);
  assert.ok(w48.transactions[128].a > contiguousClosedForm(4800, 128), "48-wide workgroups split warps off 128-byte boundaries");
});

test("segment counting and the thread map", () => {
  assert.equal(countSegments([0, 1, 2, 31], 128), 1);
  assert.equal(countSegments([0, 32, 64], 128), 3);
  assert.equal(countSegments([], 32), 0);
  const m = threadMap({ n: 40, wg: 16 });
  assert.equal(m.length, 48);
  assert.equal(m.filter((t) => !t.runs).length, 8);
  assert.deepEqual(m[17], { workgroup: 1, local: 1, global: 17, warp: 0, runs: true, reads: 17, writes: 17, outOfBounds: false });
  assert.equal(threadMap({ kind: "offByOne", n: 40, wg: 16 }).filter((t) => t.outOfBounds).length, 1);
});

test("step-at-a-time emulation gives the same result as one call", () => {
  const { a, b } = makeInputs(5000, 2), one = emulate({ n: 5000, wg: 64, a, b }), e = createEmulation({ n: 5000, wg: 64, a, b });
  while (!e.done) e.step(7);
  const r = e.result();
  assert.deepEqual(r.transactions, one.transactions);
  assert.deepEqual(Array.from(r.out), Array.from(one.out));
});

test("WGSL strings: one entry point, an overridable workgroup size, and the guard each kind is meant to have", () => {
  for (const k of KINDS) { const s = wgsl(k); assert.match(s, /override WG: u32 = 64;/); assert.match(s, /@compute @workgroup_size\(WG\)/); assert.match(s, /out\[i\] = a\[j\] \+ b\[j\];/); }
  assert.match(wgsl("add"), /if \(i >= p\.n\) \{ return; \}/);
  assert.match(wgsl("offByOne"), /if \(i > p\.n\)/);
  assert.doesNotMatch(wgsl("noGuard"), /return;/);
  assert.match(wgsl("strided"), /\(i % p\.rows\) \* p\.stride \+ i \/ p\.rows/);
  assert.throws(() => wgsl("nope"));
  assert.ok(SPEC.webgpu.maxComputeInvocationsPerWorkgroup >= SPEC.webgpu.maxComputeWorkgroupSizeX);
  assert.equal(WARP, SPEC.cuda.warpSize);
  assert.equal(CANARY, -1234.5);
});

test("facts.json, when present, carries every block and agrees with the emulator", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  for (const sec of ["spec", "grouping", "traffic", "controls", "speed", "film"]) assert.ok(f[sec].about.length > 60, sec);
  const r = run("add", 1000, 64);
  assert.equal(f.grouping.rows.find((x) => x.n === 1000 && x.wg === 64).idleThreads, r.idleThreads);
});
