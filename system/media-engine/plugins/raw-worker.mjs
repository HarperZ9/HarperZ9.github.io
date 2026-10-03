// system/media-engine/plugins/raw-worker.mjs
// Runs the raw-native WebAssembly build off the main thread. The loader fetches the module and the
// wasm, checks both against the SHA-256 the page pinned, and only then runs them.
//
// In:  { id, files: { loader, module, moduleSha256, wasm, wasmSha256 }, params }
// Out: { id, ok: true, version, ms, exitCode, certificate, arenaCertificate, frame, ao: { rt, ss, error } }
//      { id, ok: false, error }
// Every buffer in the reply is transferred, not copied.

let raw = null;

async function load(files) {
  if (!raw) {
    raw = import(files.loader).then(({ loadRawNative }) => loadRawNative({
      moduleUrl: files.module, moduleSha256: files.moduleSha256,
      wasmUrl: files.wasm, wasmSha256: files.wasmSha256,
    }));
    raw.catch(() => { raw = null; });
  }
  return raw;
}

// Binary PGM (P5, maxval 255) to its grey bytes.
function pgm(bytes) {
  if (!bytes) return null;
  let pos = 0;
  const fields = [];
  while (fields.length < 4) {
    while (bytes[pos] === 0x20 || bytes[pos] === 0x0a || bytes[pos] === 0x0d || bytes[pos] === 0x09) pos++;
    let s = "";
    while (pos < bytes.length && bytes[pos] > 0x20) s += String.fromCharCode(bytes[pos++]);
    fields.push(s);
  }
  if (fields[0] !== "P5" || fields[3] !== "255") return null;
  return bytes.slice(pos + 1, pos + 1 + (+fields[1]) * (+fields[2]));
}

self.onmessage = async ({ data }) => {
  const { id, files, params } = data;
  try {
    const r = (await load(files)).render(params);
    const ao = { rt: pgm(r.files["ao_rt.pgm"]), ss: pgm(r.files["ao_ss.pgm"]), error: pgm(r.files["ao_error.pgm"]) };
    const frame = r.frame ? { width: r.frame.width, height: r.frame.height, rgba: new Uint8Array(r.frame.rgba.buffer) } : null;
    const transfer = [frame && frame.rgba.buffer, ao.rt && ao.rt.buffer, ao.ss && ao.ss.buffer, ao.error && ao.error.buffer].filter(Boolean);
    self.postMessage({ id, ok: true, version: (await raw).version, ms: r.ms, exitCode: r.exitCode,
      certificate: r.certificate, arenaCertificate: r.arenaCertificate, frame, ao }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};
