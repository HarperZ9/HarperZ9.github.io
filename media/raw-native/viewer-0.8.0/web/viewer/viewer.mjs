// The verified viewer (roadmap M3 criterion 4, decision A4): open a glTF file, render it on the
// GPU through the WebGPU build of raw_native_cli, and show the frame beside its CPU reference,
// the error map between them and the GPU certificate. Every number on the page comes from the
// engine's own files; the page computes only the per-pixel error map for display.
import { loadRawNative, ppmToRGBA } from "../../wasm/raw-loader.mjs";

const $ = (id) => document.getElementById(id);
const state = { done: false, runs: [] };
window.__viewer = state;

function draw(canvas, img) {
  canvas.width = img.width; canvas.height = img.height;
  canvas.getContext("2d").putImageData(new ImageData(img.rgba, img.width, img.height), 0, 0);
}
// |GPU - CPU| per pixel, largest channel, scaled so 1/scale reads white; pixels either side leaves
// empty in the other are marked at full value.
export function errorMap(gpu, cpu, scale) {
  const n = gpu.width * gpu.height, out = new Uint8ClampedArray(n * 4);
  let worst = 0, sum = 0;
  for (let i = 0; i < n; ++i) {
    let e = 0;
    for (let c = 0; c < 3; ++c) e = Math.max(e, Math.abs(gpu.rgba[i * 4 + c] - cpu.rgba[i * 4 + c]) / 255);
    worst = Math.max(worst, e); sum += e;
    const v = Math.min(255, Math.round(e * scale * 255));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
  }
  return { width: gpu.width, height: gpu.height, rgba: out, worst, mean: sum / n };
}
function pgmToRGBA(bytes) {
  const head = new TextDecoder().decode(bytes.subarray(0, 64)).split(/\s+/);
  const w = +head[1], h = +head[2], start = bytes.length - w * h, rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; ++i) { const v = bytes[start + i]; rgba.set([v, v, v, 255], i * 4); }
  return { width: w, height: h, rgba };
}
function showCertificate(cert, exitCode, stdout) {
  const v = cert ? cert.verdict : "unverifiable";
  $("verdict").textContent = v;
  $("verdict").className = `verdict ${v}`;
  $("claim").textContent = cert ? cert.claim : `no certificate (exit ${exitCode}): ${stdout.split("\n").slice(-2).join(" ")}`;
  const rows = [];
  if (cert) {
    rows.push(["identity", cert.identity ?? "n/a"]);
    if (cert.adapter) rows.push(["adapter", [cert.adapter.description, cert.adapter.backend].filter(Boolean).join(", ")]);
    if (cert.coverage) rows.push(["coverage mismatch", `${cert.coverage.mismatch} (${(cert.coverage.mismatch_fraction * 100).toFixed(3)}%, bound ${(cert.coverage.bound * 100).toFixed(2)}%)`]);
    for (const c of cert.channels || []) rows.push([`${c.name} rmse`, `${c.rmse.toExponential(2)} (bound ${c.bound.toExponential(2)}) ${c.pass ? "pass" : "fail"}`]);
    if (cert.reason) rows.push(["reason", cert.reason]);
  }
  $("cert-table").replaceChildren(...rows.map(([k, val]) => {
    const tr = document.createElement("tr");
    tr.append(Object.assign(document.createElement("th"), { textContent: k }), Object.assign(document.createElement("td"), { textContent: String(val) }));
    return tr;
  }));
  $("cert-json").textContent = cert ? JSON.stringify(cert, null, 1) : stdout;
}

async function loadModule() {
  const q = new URLSearchParams(location.search), dir = q.get("dir") || "build-wasm-gpu";
  let m = q.get("m"), w = q.get("w");
  if (!m || !w) {
    const sums = await (await fetch("../../build-wasm-sums.json")).json();
    m = sums["wasm-gpu"].mjs; w = sums["wasm-gpu"].wasm;
  }
  return loadRawNative({ moduleUrl: `../../${dir}/raw-native-gpu.mjs`, moduleSha256: m, wasmUrl: `../../${dir}/raw-native-gpu.wasm`, wasmSha256: w });
}

let raw = null, runIndex = 0;
// Render the model whose files are { name: Uint8Array }; returns the run's record.
export async function view(files, opts = {}) {
  const FS = raw.module.FS, k = runIndex++, indir = `/in${k}`, outdir = `/out${k}`;
  FS.mkdir(indir); FS.mkdir(outdir);
  for (const [name, bytes] of Object.entries(files)) FS.writeFile(`${indir}/${name}`, bytes);
  const main = Object.keys(files).find((n) => /\.(gltf|glb)$/i.test(n));
  const size = String(opts.size || 256), args = ["--out", outdir, "--gpu", "--model", `${indir}/${main}`, "--width", size, "--height", size];
  if (!opts.rt) args.push("--no-rt");
  const t0 = performance.now();
  const r = await raw.runCliAsync(args);
  const ms = performance.now() - t0;
  const read = (p) => { try { return FS.readFile(`${outdir}/${p}`); } catch { return null; } };
  const certBytes = read("gpu_certificate.json"), gpuPpm = read("frame.ppm"), cpuPpm = read("cpu/frame.ppm"), aoErr = read("cpu/ao_error.pgm");
  const cert = certBytes ? JSON.parse(new TextDecoder().decode(certBytes)) : null;
  const run = { model: main, exitCode: r.exitCode, ms, verdict: cert ? cert.verdict : null, identity: cert ? cert.identity : null };
  showCertificate(cert, r.exitCode, r.stdout);
  if (gpuPpm && cpuPpm) {
    const g = ppmToRGBA(gpuPpm), c = ppmToRGBA(cpuPpm), scale = +$("scale").value;
    const e = errorMap(g, c, scale);
    draw($("gpu"), g); draw($("cpu"), c); draw($("err"), e);
    $("err-caption").textContent = `|GPU - CPU|, largest channel, x${scale}: worst ${e.worst.toFixed(4)}, mean ${e.mean.toExponential(2)}`;
    run.frames = { width: g.width, height: g.height }; run.errorWorst = e.worst; run.errorMean = e.mean;
  } else {
    for (const id of ["gpu", "cpu", "err"]) $(id).getContext("2d").clearRect(0, 0, $(id).width, $(id).height);
    $("err-caption").textContent = "no frames: the render did not complete";
  }
  if (aoErr) { draw($("ao"), pgmToRGBA(aoErr)); $("ao-wrap").hidden = false; run.aoError = true; } else { $("ao-wrap").hidden = true; }
  $("status").textContent = `${main}: exit ${r.exitCode}, ${(ms / 1000).toFixed(1)} s`;
  state.runs.push(run);
  return run;
}
// The owned assets, exported inside the page by raw_native_cli export-assets.
async function ownedAsset(name) {
  const FS = raw.module.FS, dir = `/assets${runIndex++}`;
  FS.mkdir(dir);
  await raw.runCliAsync(["export-assets", "--out", dir]);
  return { [`${name}.gltf`]: FS.readFile(`${dir}/${name}.gltf`), [`${name}.bin`]: FS.readFile(`${dir}/${name}.bin`) };
}

async function main() {
  $("status").textContent = "loading the engine";
  try {
    raw = await loadModule();
    $("version").textContent = raw.version;
    $("status").textContent = navigator.gpu ? "ready" : "WebGPU is not available in this browser";
    $("open").addEventListener("change", async (ev) => {
      const files = {};
      for (const f of ev.target.files) files[f.name] = new Uint8Array(await f.arrayBuffer());
      $("status").textContent = "rendering";
      await view(files, { size: +$("size").value, rt: $("rt").checked });
    });
    for (const name of ["raw-hero", "raw-hall"]) {
      $(name).addEventListener("click", async () => {
        $("status").textContent = `exporting ${name}`;
        await view(await ownedAsset(name), { size: +$("size").value, rt: $("rt").checked });
      });
    }
    const q = new URLSearchParams(location.search);
    if (q.get("asset")) await view(await ownedAsset(q.get("asset")), { size: +(q.get("size") || 256), rt: q.get("rt") === "1" });
    if (q.get("bytes")) {   // a check: a model file given inline (base64), named by ?name=
      const b = Uint8Array.from(atob(q.get("bytes")), (ch) => ch.charCodeAt(0));
      await view({ [q.get("name") || "model.glb"]: b }, { size: +(q.get("size") || 128) });
    }
  } catch (e) {
    state.error = String(e && e.stack || e);
    $("status").textContent = `error: ${state.error}`;
  }
  state.done = true;
}
main();
