// raw-native in the browser: hash-checked loader for the WebAssembly build.
//
//   import { loadRawNative } from "./raw-loader.mjs";
//   const raw = await loadRawNative({
//     moduleUrl: "raw-native.mjs", moduleSha256: "<hex>",
//     wasmUrl: "raw-native.wasm",  wasmSha256: "<hex>",
//   });
//   const run = raw.render({ width: 256, height: 256, eye: [4, 4, 6] });
//   run.certificate   // parsed certificate.json (raw-cert/2)
//   run.frame         // { width, height, rgba: Uint8ClampedArray } from frame.ppm
//   run.files         // every output file as Uint8Array, by name
//
// Both files are fetched as bytes and checked against the expected SHA-256
// before any of their code runs. A mismatch throws and nothing is executed.
// Works on the main thread and in a Worker (no DOM access).

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchChecked(url, expected, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} for ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (expected) {
    const actual = await sha256Hex(bytes);
    if (actual !== expected.toLowerCase()) {
      throw new Error(`${label}: SHA-256 mismatch (expected ${expected}, got ${actual})`);
    }
  }
  return bytes;
}

// Parse binary PPM (P6, maxval 255) into RGBA.
export function ppmToRGBA(bytes) {
  let pos = 0;
  const fields = [];
  while (fields.length < 4) {
    while (bytes[pos] === 0x20 || bytes[pos] === 0x0a || bytes[pos] === 0x0d || bytes[pos] === 0x09) pos++;
    let s = "";
    while (pos < bytes.length && bytes[pos] > 0x20) s += String.fromCharCode(bytes[pos++]);
    fields.push(s);
  }
  pos++; // the single whitespace byte after maxval
  const [magic, w, h, maxv] = [fields[0], +fields[1], +fields[2], +fields[3]];
  if (magic !== "P6" || maxv !== 255) throw new Error("frame.ppm: expected P6 with maxval 255");
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = pos; i < w * h; i++, j += 3) {
    rgba[4 * i] = bytes[j];
    rgba[4 * i + 1] = bytes[j + 1];
    rgba[4 * i + 2] = bytes[j + 2];
    rgba[4 * i + 3] = 255;
  }
  return { width: w, height: h, rgba };
}

// Turn a params object into CLI flags. Keys match the params-file names.
export function paramsToFlags(p = {}) {
  const flags = [];
  const vec = (v) => v.join(",");
  if (p.width) flags.push("--width", String(p.width));
  if (p.height) flags.push("--height", String(p.height));
  for (const [key, flag] of [["eye", "--eye"], ["target", "--target"], ["up", "--up"],
    ["prev_eye", "--prev-eye"], ["prev_target", "--prev-target"], ["prev_up", "--prev-up"]]) {
    if (p[key]) flags.push(flag, vec(p[key]));
  }
  if (p.fovy !== undefined) flags.push("--fovy", String(p.fovy));
  if (p.tolerance !== undefined) flags.push("--tolerance", String(p.tolerance));
  if (p.rt === false) flags.push("--no-rt");
  if (p.threads) flags.push("--threads", String(p.threads));
  return flags;
}

export async function loadRawNative({ moduleUrl, moduleSha256, wasmUrl, wasmSha256, importDirect = false }) {
  if (!wasmSha256) throw new Error("loadRawNative: wasmSha256 is required");
  const wasmBinary = await fetchChecked(wasmUrl, wasmSha256, "raw-native.wasm");
  let factory;
  if (importDirect) {
    // The pthreads build spawns workers from its own URL, so it must be imported
    // by URL. Only the wasm bytes are hash-checked in this mode.
    factory = (await import(new URL(moduleUrl, location.href).href)).default;
  } else {
    if (!moduleSha256) throw new Error("loadRawNative: moduleSha256 is required");
    const code = await fetchChecked(moduleUrl, moduleSha256, "raw-native.mjs");
    const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    try {
      factory = (await import(blobUrl)).default;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }
  let lines = [];
  const absoluteWasmUrl = new URL(wasmUrl, location.href).href;
  const mod = await factory({
    wasmBinary,
    // The glue resolves the wasm path even when wasmBinary is supplied; point it
    // at the real URL so a blob-imported module does not resolve against blob:.
    locateFile: (path) => (path.endsWith(".wasm") ? absoluteWasmUrl : new URL(path, absoluteWasmUrl).href),
    print: (s) => lines.push(s),
    printErr: (s) => lines.push(s),
  });

  function runCli(args) {
    lines = [];
    const exitCode = mod.callMain(args);
    return { exitCode, stdout: lines.join("\n") };
  }
  let runIndex = 0;
  function render(params = {}) {
    const dir = `/run${runIndex++}`;
    mod.FS.mkdir(dir);
    const t0 = performance.now();
    const { exitCode, stdout } = runCli(["--out", dir, ...paramsToFlags(params)]);
    const ms = performance.now() - t0;
    const files = {};
    for (const name of mod.FS.readdir(dir)) {
      if (name === "." || name === "..") continue;
      files[name] = mod.FS.readFile(`${dir}/${name}`);
      mod.FS.unlink(`${dir}/${name}`);
    }
    mod.FS.rmdir(dir);
    const text = (n) => (files[n] ? new TextDecoder().decode(files[n]) : null);
    return {
      exitCode, stdout, ms, files,
      certificate: files["certificate.json"] ? JSON.parse(text("certificate.json")) : null,
      arenaCertificate: files["arena_certificate.json"] ? JSON.parse(text("arena_certificate.json")) : null,
      frame: files["frame.ppm"] ? ppmToRGBA(files["frame.ppm"]) : null,
    };
  }
  function bench(params = {}, runs = 5) {
    const { exitCode, stdout } = runCli(["--bench", String(runs), ...paramsToFlags(params)]);
    if (exitCode !== 0) throw new Error(`bench failed: ${stdout}`);
    return JSON.parse(stdout.trim().split("\n").pop());
  }
  const version = runCli(["--version"]).stdout.trim();
  return { render, bench, runCli, version, module: mod };
}
