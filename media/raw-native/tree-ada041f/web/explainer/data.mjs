// Data binding: load the numbers a film draws (JSON, or NumPy .npy arrays) and check them
// against the hashes their producer recorded, so a frame can say where every number came from.
//
//   const d = await loadBundle(new URL("attention/data.json", import.meta.url));
//   d.json.accuracy.repeat            // a number the film shows
//   d.arrays["residual.npy"].data     // Float32Array, row-major, shape d.arrays[...].shape
//   d.verified                        // true when every listed file matched its SHA-256
// parseNpy() reads format versions 1 to 3, little-endian f2, f4, f8, i1/u1, i2/u2, i4/u4, C order.

const DTYPES = {
  "<f2": [2, (v, o) => half(v.getUint16(o, true))], "<f4": [4, (v, o) => v.getFloat32(o, true)], "<f8": [8, (v, o) => v.getFloat64(o, true)],
  "|i1": [1, (v, o) => v.getInt8(o)], "|u1": [1, (v, o) => v.getUint8(o)], "<i2": [2, (v, o) => v.getInt16(o, true)],
  "<u2": [2, (v, o) => v.getUint16(o, true)], "<i4": [4, (v, o) => v.getInt32(o, true)], "<u4": [4, (v, o) => v.getUint32(o, true)],
};

// IEEE 754 binary16 to a number.
export function half(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}

export function parseNpy(buf) {
  const bytes = new Uint8Array(buf);
  const magic = String.fromCharCode(...bytes.subarray(0, 6));
  if (magic !== "\x93NUMPY") throw new Error("parseNpy: not an .npy file");
  const major = bytes[6], v = new DataView(buf instanceof ArrayBuffer ? buf : bytes.buffer, bytes.byteOffset);
  const hlen = major === 1 ? v.getUint16(8, true) : v.getUint32(8, true), hstart = major === 1 ? 10 : 12;
  const header = new TextDecoder().decode(bytes.subarray(hstart, hstart + hlen));
  const descr = /'descr':\s*'([^']+)'/.exec(header)?.[1];
  const fortran = /'fortran_order':\s*True/.test(header);
  const shape = (/'shape':\s*\(([^)]*)\)/.exec(header)?.[1] || "").split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  if (!DTYPES[descr]) throw new Error(`parseNpy: dtype ${descr} is not supported`);
  if (fortran) throw new Error("parseNpy: Fortran order is not supported");
  const [size, read] = DTYPES[descr], n = shape.reduce((a, b) => a * b, 1), off = hstart + hlen;
  if (bytes.length < off + n * size) throw new Error(`parseNpy: ${n * size} data bytes expected, ${bytes.length - off} found`);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = read(v, off + i * size);
  return { dtype: descr, shape, data };
}

export async function sha256Hex(buf) {
  const d = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A data bundle: a JSON file whose "files" map names array files beside it and their SHA-256.
export async function loadBundle(url, { fetcher = globalThis.fetch } = {}) {
  const get = async (u) => { const r = await fetcher(u); if (!r.ok) throw new Error(`${u}: HTTP ${r.status}`); return r.arrayBuffer(); };
  const jbuf = await get(url);
  const json = JSON.parse(new TextDecoder().decode(jbuf));
  const arrays = {}, checks = {};
  for (const [name, want] of Object.entries(json.files || {})) {
    const buf = await get(new URL(name, url).href);
    const got = await sha256Hex(buf);
    checks[name] = { want, got, ok: got === want };
    if (name.endsWith(".npy")) arrays[name] = parseNpy(buf);
  }
  return { json, arrays, checks, verified: Object.values(checks).every((c) => c.ok), jsonSha256: await sha256Hex(jbuf) };
}

// Small helpers for binding numbers to marks.
export const extent = (a) => { let lo = Infinity, hi = -Infinity; for (const x of a) { if (x < lo) lo = x; if (x > hi) hi = x; } return [lo, hi]; };
// The value at quantile q (0..1) of a sample of a large array (every step-th value), for colour ranges.
export function quantile(a, q, step = 1) {
  const s = [];
  for (let i = 0; i < a.length; i += step) s.push(a[i]);
  s.sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
}
export const argmax = (a) => { let k = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i; return k; };
export function topk(a, k) { return [...a.keys()].sort((i, j) => a[j] - a[i]).slice(0, k); }
// Format a bound number for the screen: "pct" 0.9578 -> "95.8%", "int" 370325 -> "370,325", "f2" -> 2 places.
export function show(x, kind = "f2") {
  if (kind === "pct") return (100 * x).toFixed(1) + "%";
  if (kind === "pct0") return Math.round(100 * x) + "%";
  if (kind === "int") return Math.round(x).toLocaleString("en-US");
  const m = /^f(\d)$/.exec(kind);
  return m ? x.toFixed(+m[1]) : String(x);
}
