// A small CBOR decoder and encoder (RFC 8949), enough for C2PA claims, assertions and COSE
// signatures. Decoding keeps byte strings as Uint8Array, maps with text or integer keys as plain
// objects, tags as { tag, value } and the exact encoded bytes of the top value.

const td = new TextDecoder("utf-8", { fatal: false });

function head(b, i) {
  const ib = b[i], major = ib >> 5, ai = ib & 31;
  if (ai < 24) return [major, ai, i + 1];
  if (ai === 24) return [major, b[i + 1], i + 2];
  if (ai === 25) return [major, (b[i + 1] << 8) | b[i + 2], i + 3];
  if (ai === 26) return [major, ((b[i + 1] << 24) >>> 0) + (b[i + 2] << 16) + (b[i + 3] << 8) + b[i + 4], i + 5];
  if (ai === 27) {
    let v = 0n;
    for (let k = 1; k <= 8; k++) v = (v << 8n) | BigInt(b[i + k]);
    return [major, v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v, i + 9];
  }
  if (ai === 31) return [major, -1, i + 1];
  throw new Error("cbor: bad length");
}

function half(h) {
  const e = (h >> 10) & 31, f = h & 1023, s = h & 0x8000 ? -1 : 1;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

function item(b, i, depth) {
  if (depth > 64) throw new Error("cbor: too deep");
  if (i >= b.length) throw new Error("cbor: truncated");
  const [major, n, j] = head(b, i);
  switch (major) {
    case 0: return [n, j];
    case 1: return [typeof n === "bigint" ? -1n - n : -1 - n, j];
    case 2: case 3: {
      if (n === -1) {
        const parts = []; let k = j;
        while (b[k] !== 0xff) { const [p, nk] = item(b, k, depth + 1); parts.push(p); k = nk; }
        return [major === 3 ? parts.join("") : bytesConcat(parts), k + 1];
      }
      if (j + n > b.length) throw new Error("cbor: truncated");
      const s = b.subarray(j, j + n);
      return [major === 3 ? td.decode(s) : s, j + n];
    }
    case 4: {
      const out = []; let k = j;
      if (n === -1) { while (b[k] !== 0xff) { const [v, nk] = item(b, k, depth + 1); out.push(v); k = nk; } return [out, k + 1]; }
      for (let c = 0; c < n; c++) { const [v, nk] = item(b, k, depth + 1); out.push(v); k = nk; }
      return [out, k];
    }
    case 5: {
      const out = {}; let k = j;
      for (let c = 0; n === -1 ? b[k] !== 0xff : c < n; c++) {
        const [key, k1] = item(b, k, depth + 1); const [v, k2] = item(b, k1, depth + 1);
        out[typeof key === "object" ? JSON.stringify(key) : String(key)] = v; k = k2;
      }
      return [out, n === -1 ? k + 1 : k];
    }
    case 6: { const [v, k] = item(b, j, depth + 1); return [{ tag: n, value: v }, k]; }
    default: {
      const ai = b[i] & 31;
      if (ai === 20) return [false, j]; if (ai === 21) return [true, j];
      if (ai === 22) return [null, j]; if (ai === 23) return [undefined, j];
      if (ai === 25) return [half(n), j];
      if (ai === 26) return [new DataView(b.buffer, b.byteOffset + i + 1, 4).getFloat32(0), j];
      if (ai === 27) return [new DataView(b.buffer, b.byteOffset + i + 1, 8).getFloat64(0), j];
      return [n, j];
    }
  }
}

export function bytesConcat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Decode one CBOR value from the start of bytes.
export function cborDecode(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return item(b, 0, 0)[0];
}

function encHead(major, n) {
  if (n < 24) return [(major << 5) | n];
  if (n < 256) return [(major << 5) | 24, n];
  if (n < 65536) return [(major << 5) | 25, n >> 8, n & 255];
  return [(major << 5) | 26, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Encode the small subset COSE's Sig_structure needs: arrays, text, byte strings, integers.
export function cborEncode(v) {
  if (Array.isArray(v)) return bytesConcat([Uint8Array.from(encHead(4, v.length)), ...v.map(cborEncode)]);
  if (v instanceof Uint8Array) return bytesConcat([Uint8Array.from(encHead(2, v.length)), v]);
  if (typeof v === "string") { const s = new TextEncoder().encode(v); return bytesConcat([Uint8Array.from(encHead(3, s.length)), s]); }
  if (Number.isInteger(v)) return Uint8Array.from(v >= 0 ? encHead(0, v) : encHead(1, -1 - v));
  if (v === null) return Uint8Array.of(0xf6);
  throw new Error("cbor: cannot encode " + typeof v);
}
