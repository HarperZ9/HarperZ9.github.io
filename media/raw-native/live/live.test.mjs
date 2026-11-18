// The live renderer's contracts that need no GPU: the engine files and scenes hold their pins, the functions lifted
// from the engine are there and unchanged, the tree the tracers walk finds every hit a scan finds (and a planted
// fault in the tree is caught), and the sky gives the engine's numbers.
//
//   node --test media/raw-native/live/live.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PINNED, lift, passesOf } from "./engine.mjs";
import { PINS, SCENES } from "./scene.mjs";
import { skyModel, sunDirection } from "./sky.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const sums = (dir) => Object.fromEntries(readFileSync(path.join(dir, "SHA256SUMS"), "utf8").trim().split("\n").map((l) => l.split(/\s+/).reverse()));

test("every engine file matches its pin, in engine.mjs and in SHA256SUMS", () => {
  const dir = path.join(here, "engine-sf-cac3416"), listed = sums(dir);
  assert.deepEqual(Object.keys(listed).sort(), Object.keys(PINNED).sort());
  for (const [name, want] of Object.entries(PINNED)) {
    assert.equal(sha(path.join(dir, name)), want, name);
    assert.equal(listed[name], want, name);
  }
});

test("the scenes match the hashes the engine commits (evidence/m3-assets.json at cac34166)", () => {
  const dir = path.join(here, "..", "assets"), listed = sums(dir);
  for (const [asset, [json, bin]] of Object.entries(PINS)) {
    assert.equal(sha(path.join(dir, `${asset}.gltf`)), json, asset);
    assert.equal(sha(path.join(dir, `${asset}.bin`)), bin, asset);
    assert.equal(listed[`${asset}.bin`], bin, asset);
    const def = Object.values(SCENES).find((s) => s.asset === asset);
    assert.equal(def.bytes, readFileSync(path.join(dir, `${asset}.bin`)).length + readFileSync(path.join(dir, `${asset}.gltf`)).length, `${asset}: the size the page states`);
  }
});

test("the engine's passes and functions are lifted as written", () => {
  const dir = path.join(here, "engine-sf-cac3416");
  const post = passesOf(readFileSync(path.join(dir, "post.wgsl"), "utf8"));
  assert.deepEqual(Object.keys(post).sort(), ["post_gtao", "post_ssr", "post_taa"]);
  const passes = readFileSync(path.join(dir, "passes.wgsl"), "utf8");
  for (const name of ["wt_frame", "wt_hit", "bvert", "bhit", "invDir", "bvhBlocked"]) {
    const f = lift(passes, name);
    assert.ok(f.startsWith(`fn ${name}(`) && f.endsWith("}"), name);
    assert.ok(passes.includes(f), `${name} is a verbatim slice`);
  }
  assert.throws(() => lift(passes, "no_such_function"), /not found/);
});

// the tree from the worker, walked here the way bvhBlocked walks it on the GPU
async function buildTree(positions) {
  const src = readFileSync(path.join(here, "bvh-worker.mjs"), "utf8").replace(/self\.onmessage[\s\S]*$/, "export { build };");
  const mod = await import("data:text/javascript," + encodeURIComponent(src));
  return mod.build(positions);
}
function hitTri(o, d, a, b, c) {   // Moller-Trumbore, any hit with t > 1e-4
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det, t0 = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const u = (t0[0] * p[0] + t0[1] * p[1] + t0[2] * p[2]) * inv; if (u < 0 || u > 1) return false;
  const q = [t0[1] * e1[2] - t0[2] * e1[1], t0[2] * e1[0] - t0[0] * e1[2], t0[0] * e1[1] - t0[1] * e1[0]];
  const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv; if (v < 0 || u + v > 1) return false;
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv > 1e-4;
}
function walk(tree, o, d) {
  const { nodes, btris } = tree, iv = d.map((x) => (x !== 0 ? 1 / x : x >= 0 ? 1e30 : -1e30)), stack = [0];
  const v = (t, k) => [btris[9 * t + 3 * k], btris[9 * t + 3 * k + 1], btris[9 * t + 3 * k + 2]];
  while (stack.length) {
    const n = stack.pop() * 8;
    let t0 = 0, t1 = 1e30;
    for (let k = 0; k < 3; k++) { const a = (nodes[n + k] - o[k]) * iv[k], b = (nodes[n + 4 + k] - o[k]) * iv[k]; t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b)); }
    if (!(t0 <= t1)) continue;
    const first = nodes[n + 3], count = nodes[n + 7];
    if (count > 0) { for (let k = 0; k < count; k++) if (hitTri(o, d, v(first + k, 0), v(first + k, 1), v(first + k, 2))) return true; continue; }
    stack.push(first + 1, first);
  }
  return false;
}

test("the tree finds every hit a scan finds, and a planted fault is caught", async () => {
  let s = 12345;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  const nt = 3000, pos = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) { const c = [r() * 20 - 10, r() * 20 - 10, r() * 20 - 10]; for (let k = 0; k < 9; k++) pos[9 * t + k] = c[k % 3] + (r() - 0.5) * 1.2; }
  const tree = await buildTree(pos);
  assert.equal(new Set(tree.order).size, nt, "every triangle is in the tree once");
  for (let i = 0; i < tree.nodes.length / 8; i++) assert.ok(tree.nodes[8 * i + 7] <= 4, "leaves of up to 4");
  // rays from outside towards a random triangle's neighbourhood, so most of them hit and some miss
  const rays = Array.from({ length: 400 }, () => {
    const o = [r() * 30 - 15, r() * 30 - 15, r() * 30 - 15], t = Math.floor(r() * nt);
    const aim = [0, 1, 2].map((k) => (pos[9 * t + k] + pos[9 * t + 3 + k] + pos[9 * t + 6 + k]) / 3 + (r() - 0.5) * 2);
    const d = aim.map((v, k) => v - o[k]), l = Math.hypot(...d);
    return [o, d.map((x) => x / l)];
  });
  const tri = (t, k) => [pos[9 * t + 3 * k], pos[9 * t + 3 * k + 1], pos[9 * t + 3 * k + 2]];
  const scan = ([o, d]) => { for (let t = 0; t < nt; t++) if (hitTri(o, d, tri(t, 0), tri(t, 1), tri(t, 2))) return true; return false; };
  const want = rays.map(scan), got = rays.map(([o, d]) => walk(tree, o, d));
  assert.ok(want.filter(Boolean).length > 50, "the rays hit something");
  assert.deepEqual(got, want);
  // planted: shrink the root's box to nothing; the walk must now miss hits the scan finds
  const bad = { ...tree, nodes: tree.nodes.slice() };
  for (let k = 0; k < 3; k++) { bad.nodes[k] = 1e6; bad.nodes[4 + k] = 1e6; }
  assert.notDeepEqual(rays.map(([o, d]) => walk(bad, o, d)), want);
});

test("the sky is the engine's: Preetham zenith and sun at noon, turbidity 2.5", () => {
  const sky = skyModel([0, 1, 0]);
  // sky.cpp: Yz = 1000 ((4.0453 T - 4.9710) tan(chi) - 0.2155 T + 2.4192), chi = (4/9 - T/120) pi at the zenith
  const chi = (4 / 9 - 2.5 / 120) * Math.PI;
  assert.ok(Math.abs(sky.zenith - 1000 * ((4.0453 * 2.5 - 4.971) * Math.tan(chi) - 0.2155 * 2.5 + 2.4192)) < 1e-6);
  // the sun straight up: m = 1, tau = 0.08 + 0.025 x 2.5
  assert.ok(Math.abs(sky.sunE[1] - 1e5 * Math.exp(-0.1425)) < 1e-6);
  assert.ok(sky.amb[2].every((v, k) => v > sky.amb[3][k]), "more light from above than below");
  const sun = sunDirection(90, 30);
  assert.ok(Math.abs(Math.hypot(...sun) - 1) < 1e-12 && Math.abs(sun[1] - 0.5) < 1e-12);
});
