// node --test system/media-engine/raw.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RAW_FILES, RAW_VERSION, RAW_VIEWS, rawParams, rawStatus, channelRGBA } from "./plugins/raw.mjs";

const dir = new URL(`../../media/raw-native/wasm-${RAW_VERSION}/`, import.meta.url);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the vendored raw-native files are the pinned v0.4.0 release bytes", () => {
  const sums = readFileSync(new URL("SHA256SUMS", dir), "utf8").trim().split("\n").map((l) => l.split(/\s+/));
  for (const f of Object.values(RAW_FILES)) {
    assert.equal(sha(readFileSync(new URL(f.name, dir))), f.sha256, f.name);
    assert.ok(sums.some(([h, n]) => n === f.name && h === f.sha256), f.name + " is in SHA256SUMS");
  }
});

test("views map to raw-native's own camera fields, and explicit fields win", () => {
  assert.deepEqual(rawParams({}), { width: 384, height: 384, eye: [4, 4, 6], target: [0, 1, 0], up: [0, 1, 0], fovy: 0.9 });
  assert.deepEqual(rawParams({ view: "close", size: 512 }).eye, RAW_VIEWS.close.eye);
  assert.equal(rawParams({ view: "close" }).fovy, 0.7);
  assert.equal(rawParams({ size: 999 }).width, 384, "an unlisted size falls back");
  assert.deepEqual(rawParams({ view: "high", eye: [1, 2, 3], tolerance: 0.1 }).eye, [1, 2, 3]);
  assert.equal(rawParams({ tolerance: 0.1 }).tolerance, 0.1);
});

test("status words: verified reads MATCH, refuted reads DRIFT, and a failure reads ERROR", () => {
  const exact = { pixels: 37996, rmse: 0.129436031, maxError: 0.609375, tolerance: 0.12 };
  const result = { version: "raw-native 0.4.0", backend: "cpu", fallback: "no WebGPU", ms: 250, frame: { width: 256, height: 256 }, certificate: { verdict: "refuted", exact } };
  assert.equal(rawStatus(result).find((s) => s.label === "AO certificate").verdict, "DRIFT");
  assert.equal(rawStatus({ ...result, certificate: { verdict: "verified", exact } }).find((s) => s.label === "AO certificate").verdict, "MATCH");
  assert.equal(rawStatus(null, new Error("no wasm"))[0].verdict, "ERROR");
  assert.equal(rawStatus(null)[0].verdict, "PENDING");
});

test("the GPU line reads the GPU certificate, and a fallback says why the CPU drew the frame", () => {
  const exact = { pixels: 37996, rmse: 0.129436031, maxError: 0.609375, tolerance: 0.12 };
  const base = { version: "raw-native 0.4.0", ms: 900, frame: { width: 256, height: 256 }, certificate: { verdict: "refuted", exact } };
  const gpuCertificate = { verdict: "verified", adapter: { vendor: "nvidia", architecture: "lovelace" }, timing_ms: { gpu: 7, cpu: 300 },
    channels: [{ name: "ao_rt", rmse: 4e-5, bound: 0.01 }, { name: "frame", rmse: 1e-5, bound: 0.01 }] };
  const gpu = rawStatus({ ...base, backend: "webgpu", gpuCertificate }).find((s) => s.label === "GPU frame");
  assert.equal(gpu.verdict, "MATCH");
  assert.match(gpu.detail, /ao_rt/);
  assert.match(gpu.detail, /nvidia lovelace/);
  assert.equal(rawStatus({ ...base, backend: "webgpu", gpuCertificate: { ...gpuCertificate, verdict: "refuted" } })
    .find((s) => s.label === "GPU frame").verdict, "DRIFT");
  const cpu = rawStatus({ ...base, backend: "cpu", fallback: "this browser has no WebGPU" }).find((s) => s.label === "GPU path");
  assert.equal(cpu.verdict, "UNVERIFIABLE");
  assert.match(cpu.detail, /no WebGPU/);
  assert.match(rawStatus({ ...base, backend: "webgpu", gpuCertificate })[0].detail, /raw-native-gpu\.wasm/);
});

test("an AO channel expands to opaque grey RGBA", () => {
  const r = { frame: { width: 2, height: 1, rgba: new Uint8Array(8) }, ao: { rt: new Uint8Array([10, 200]) } };
  assert.deepEqual([...channelRGBA(r, "ao_rt")], [10, 10, 10, 255, 200, 200, 200, 255]);
  assert.equal(channelRGBA(r, "frame"), r.frame.rgba);
});

test("the vendored wasm writes the same default certificate as the native release binaries", async () => {
  const { default: create } = await import(pathToFileURL(fileURLToPath(new URL(RAW_FILES.module.name, dir))).href);
  const mod = await create({ wasmBinary: readFileSync(new URL(RAW_FILES.wasm.name, dir)), print: () => {}, printErr: () => {} });
  mod.FS.mkdir("/out");
  assert.equal(mod.callMain(["--out", "/out"]), 0);
  // SHA-256 of certificate.json from raw_native_cli 0.4.0 on Windows (MSVC) and Linux (GCC), default view.
  assert.equal(sha(mod.FS.readFile("/out/certificate.json")), "302c4ec95a40625904cb523cd169af3dcd43208bbaa3e354f7a59df623b1b34b");
  assert.equal(sha(mod.FS.readFile("/out/frame.ppm")), "e276f24f4a2a23e7b43b61d2e45147446468bf8d99a75809675f2cea91edb06d");
});
