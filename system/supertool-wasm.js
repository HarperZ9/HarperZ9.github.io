// system/supertool-wasm.js
// Thin WebAssembly loader for the BuildLang-compiled Super-Tool kernel (system/bld/supertool_kernel.bld).
// Works identically in Node.js (tests) and the browser (studio.html / playground).

const NOOP_ENV = Object.freeze({
  env: {
    print_i64: () => {},
    print_u64: () => {},
    print_f64: () => {},
    print_bool: () => {},
    print_str: () => {},
  },
});

let cachedPromise = null;

export async function loadSupertoolWasm(wasmUrl = "system/wasm/supertool_kernel.wasm") {
  if (cachedPromise) return cachedPromise;
  cachedPromise = (async () => {
    let bytes;
    if (typeof window === "undefined") {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const url = await import("node:url");
      const here = path.dirname(url.fileURLToPath(import.meta.url));
      bytes = fs.readFileSync(path.join(here, "wasm", "supertool_kernel.wasm"));
    } else {
      const resp = await fetch(wasmUrl);
      if (!resp.ok) throw new Error(`supertool-wasm: HTTP ${resp.status} loading ${wasmUrl}`);
      bytes = await resp.arrayBuffer();
    }
    const { instance } = await WebAssembly.instantiate(bytes, NOOP_ENV);
    return instance.exports;
  })();
  return cachedPromise;
}
